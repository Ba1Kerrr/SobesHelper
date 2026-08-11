import argparse
import importlib
import inspect
import io
import json
import logging
import sys
import threading
from contextlib import redirect_stdout
from pathlib import Path

# On Windows, stdio otherwise defaults to the console's codepage (cp1251/
# cp866), which mangles the Cyrillic vacancy/employer names that make up
# most of this API's actual data - Node reads these pipes as UTF-8.
sys.stdout.reconfigure(encoding="utf-8", newline="\n")
sys.stdin.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from hh_applicant_tool.main import HHApplicantTool  # noqa: E402
from hh_applicant_tool.ui.api import Api, _ProgressHandler  # noqa: E402

_stdout_lock = threading.Lock()
# Captured once, before anything ever wraps sys.stdout - both apply_vacancies
# (inherited from Api, unmodified) and run_operation below run the operation
# under redirect_stdout(_PrintCapture()) so that operation's own print()
# calls become progress events instead of raw text on our JSON-line stdout.
# _send_progress (overridden below) used to write straight to sys.stdout,
# which meant every progress event emitted *during* that redirect wrote back
# into the very same _PrintCapture that produced it - infinite reentrant
# recursion, deadlocked on _stdout_lock (a plain, non-reentrant Lock) on the
# very first progress line. Empirically confirmed by tracing run_operation
# step by step: it hung forever the moment a captured print() tried to emit
# a progress event, with no exception and no timeout. Writing to this fixed
# reference instead of the dynamic sys.stdout global sidesteps it entirely.
_real_stdout = sys.stdout


def _emit(payload: dict) -> None:
    with _stdout_lock:
        _real_stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        _real_stdout.flush()


class BridgeApi(Api):
    # The base Api normally pushes these through a pywebview window's
    # evaluate_js - there is no window here, so re-route them as plain
    # stdout JSON lines the Node side can broadcast to the renderer.
    def _send_progress(self, current: int, total: int, message: str = "") -> None:
        _emit({"type": "progress", "current": current, "total": total, "message": message})

    def _send_auth_event(self, event: str, message: str = "") -> None:
        _emit({"type": "auth", "event": event, "message": message})

    # Api only ever wires up apply_vacancies as its own method - every other
    # CLI operation (update_resumes, reply_employers, clear_negotiations,
    # ...) shares the exact same Operation/Namespace/setup_parser/run shape,
    # so one generic runner covers all of them instead of a bespoke method
    # per operation. `name` is the operations/<name>.py module name.
    def run_operation(self, name: str, params: dict | None = None) -> dict:
        params = dict(params or {})
        # Only create_resume needs this (its `template` arg is positional,
        # not a --flag) - _params_to_argv only knows how to emit flags.
        positional = [str(p) for p in params.pop("_positional", [])]

        try:
            mod = importlib.import_module(f"hh_applicant_tool.operations.{name}")
        except ImportError as e:
            return {"status": "error", "message": f"Unknown operation: {name} ({e})"}

        op = mod.Operation()
        parser = argparse.ArgumentParser()
        op.setup_parser(parser)
        argv = positional + self._params_to_argv(params)
        try:
            args = parser.parse_args(argv, namespace=mod.Namespace())
        except SystemExit:
            return {"status": "error", "message": "Invalid parameters"}

        # Mirrors what the real CLI's HHApplicantTool.run() does before
        # dispatching. clear_skipped goes further still and reads a literal
        # tool.args attribute (not one of the individually-assigned fields
        # _assign_args sets) - empirically confirmed by running it through
        # this bridge: AttributeError until tool.args is set explicitly too.
        self._tool._assign_args(args)
        self._tool.args = args

        handler = _ProgressHandler(self)
        pkg_logger = logging.getLogger("hh_applicant_tool")
        pkg_logger.addHandler(handler)

        api_self = self

        class _PrintCapture(io.StringIO):
            def write(self_inner, s: str) -> int:
                s = s.rstrip("\n")
                if s:
                    handler._count += 1
                    api_self._send_progress(handler._count, 0, s)
                return len(s)

        try:
            # clear_skipped's run() takes only (self, tool) - every other
            # operation takes (self, tool, args). Checked via introspection
            # rather than a TypeError retry so a real bug inside run() can't
            # be mistaken for an arity mismatch.
            run_params = list(inspect.signature(op.run).parameters)
            with redirect_stdout(_PrintCapture()):
                if len(run_params) >= 2:
                    op.run(self._tool, args)
                else:
                    op.run(self._tool)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e) or e.__class__.__name__}
        finally:
            pkg_logger.removeHandler(handler)


def _build_tool() -> HHApplicantTool:
    tool = HHApplicantTool()
    # Mirrors what _assign_args() would set from a bare/default argparse
    # Namespace - we never go through the CLI parser here.
    tool.config_dir = None
    tool.profile_id = None
    tool.api_delay = None
    tool.user_agent = None
    tool.proxy_url = None
    tool.openai_proxy_url = None
    tool.verbosity = 0
    tool.config_path.mkdir(parents=True, exist_ok=True)
    return tool


def _handle(api: Api, request_id, method: str, params: dict) -> None:
    fn = getattr(api, method, None)
    if fn is None or method.startswith("_"):
        _emit({"id": request_id, "error": f"unknown method: {method}"})
        return
    try:
        result = fn(**params)
    except Exception as e:
        _emit({"id": request_id, "error": str(e) or e.__class__.__name__})
        return
    _emit({"id": request_id, "result": result})


def main() -> None:
    tool = _build_tool()
    api = BridgeApi(tool)
    active: list[threading.Thread] = []

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            _emit({"id": None, "error": f"invalid json: {e}"})
            continue

        request_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params") or {}
        # Each call runs on its own thread so a slow one (network calls,
        # apply_vacancies' search loop) can't block the next request from
        # being read off stdin - matches how the upstream Api was already
        # designed to be hit concurrently from pywebview's JS bridge.
        active = [t for t in active if t.is_alive()]
        t = threading.Thread(target=_handle, args=(api, request_id, method, params), daemon=True)
        active.append(t)
        t.start()

    # stdin closed (parent process killed us or piped EOF) - give in-flight
    # quick calls a moment to finish writing before the interpreter tears
    # down, otherwise a daemon thread mid-write can crash at shutdown.
    for t in active:
        t.join(timeout=2)


if __name__ == "__main__":
    main()
