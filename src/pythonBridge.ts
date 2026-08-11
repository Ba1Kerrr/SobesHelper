import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import readline from "readline";
import { app } from "electron";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

// One long-lived interpreter, not spawned per call - importing the vendored
// hh_applicant_tool package and building its argparse subcommand tree takes
// real time we don't want to pay on every button click. Talks JSON-RPC over
// stdin/stdout, one line per message - see python/bridge.py.
let bridgeProcess: ChildProcessWithoutNullStreams | null = null;
let requestCounter = 0;
const pending = new Map<number, PendingRequest>();
let onEvent: ((data: any) => void) | null = null;

function getVendorDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "python") : path.join(app.getAppPath(), "python");
}

function startBridge(pythonPath: string): ChildProcessWithoutNullStreams {
  const vendorDir = getVendorDir();
  const child = spawn(pythonPath, ["bridge.py"], {
    cwd: vendorDir,
    shell: process.platform === "win32",
  });

  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)!;
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.result);
    } else if (msg.type) {
      onEvent?.(msg);
    }
  });

  child.stderr.on("data", (chunk) => {
    console.error("[hh-bridge]", chunk.toString());
  });

  const fail = (err: Error) => {
    if (bridgeProcess === child) bridgeProcess = null;
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  };
  child.on("exit", (code) => fail(new Error(`Python bridge exited (code ${code})`)));
  child.on("error", (err: NodeJS.ErrnoException) => {
    fail(
      err.code === "ENOENT"
        ? new Error(`Python interpreter not found at "${pythonPath}". Set the correct path in Settings.`)
        : err
    );
  });

  return child;
}

export function setHHEventListener(listener: (data: any) => void): void {
  onEvent = listener;
}

export function callHHTool(pythonPath: string, method: string, params: Record<string, any> = {}): Promise<any> {
  if (!bridgeProcess) {
    bridgeProcess = startBridge(pythonPath || "python");
  }
  const id = ++requestCounter;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    bridgeProcess!.stdin.write(JSON.stringify({ id, method, params }) + "\n", "utf-8");
  });
}

export function killHHBridge(): void {
  bridgeProcess?.kill();
  bridgeProcess = null;
}
