# Interview Assistant

A stealth live copilot for technical interviews on Windows. It listens to the call, transcribes it in real time, and answers in a small always-on-top window that's excluded from screen capture - so it never appears in a screen share or a recording.

## What this is not

This tool never interacts with the interview call itself - no auto-typing into a shared editor, no clicking around in someone else's UI, no injecting anything into the meeting. The only inputs are: what the app hears (system audio via screen-share capture), what you paste or screenshot, and what you type into its own window. Everything it produces stays in its own window until you decide to say it out loud yourself. It's a second pair of eyes reading the problem with you, not a hand on someone else's keyboard.

## Features

- **Multi-provider answers** - OpenAI-compatible API, [Ollama](https://ollama.com) (local, free), or the Claude Code CLI (rides your existing subscription, no separate API key). Switch any time in Settings, no restart.
- **Multi-provider transcription** - Deepgram (nova-3, recommended) or 60db, with real language selection (Auto-detect works but picking your actual language is more reliable).
- **Modes** - Coding / Explain / Behavioral, each with its own system prompt and a color-coded pill in the header. Cycle with a hotkey.
- **Chat interface** - message history, type a question directly or let it auto-answer from the live transcript, quick-action presets (ask now, analyze the screen, summarize the conversation).
- **Resume context** - paste your resume once in Settings, it's included on every question automatically.
- **Knowledge Base** - upload reference files (PDF, text, images) that stay in context for the whole session.
- **Obsidian notes viewer** - point it at a vault folder, browse and preview `.md` notes, pull one into the Knowledge Base with one click.
- **Interview recordings** - optionally saves the captured system audio (`.webm`) per meeting, with a browsable list and inline playback.
- **Spoken answers (TTS)** - 60db text-to-speech, off by default, with output device and volume control so playback doesn't get picked up by your own mic.
- **Stealth window** - content-protected (invisible to `getDisplayMedia`/screen recording), hidden from the taskbar and Alt-Tab, lives in the system tray, adjustable opacity, global hotkey to toggle click-through.
- **HUD** - a tiny separate status readout (listening / click-through state) that stays visible even when the main window is hidden, also excluded from screen capture.
- **Rebindable global hotkeys** - defaults use triple-modifier combos to avoid colliding with other apps; if one still conflicts, Settings shows which and lets you type a replacement live.
- **Usage stats** - questions answered, average response time, listening sessions, recordings saved - all local, nothing leaves your machine.
- **Jobs (hh.ru)** - search and auto-apply to HH.ru vacancies, track your responses, and pin the vacancy you're currently interviewing for so its context feeds into every answer. Backed by a vendored [hh-applicant-tool](https://github.com/s3rgeym/hh-applicant-tool) (see Credits) driven through a local Python bridge process - requires a Python interpreter, see Setup.

## Architecture

Two windows, both `BrowserWindow`s with `setContentProtection(true)`:

- **Main window** (`src/pages/OverlayPage.tsx`) - the whole app: chat, Settings, Knowledge Base, Notes, Recordings, Jobs, switched via header icons rather than separate windows/routes. Owns the STT capture pipeline (`getDisplayMedia` → PCM → `send-audio` IPC), the LLM request flow, and recording-to-disk.
- **HUD window** (`src/pages/HudPage.tsx`) - read-only, click-through, always-on-top status pill.

Main process (`src/index.ts`) owns both windows, the system tray, global hotkeys, and every filesystem/network operation that can't run in a sandboxed renderer (LLM calls, STT WebSocket connections, clipboard, screen capture, file I/O). The renderer talks to it entirely through a typed `window.electronAPI` bridge (`src/preload.ts` + `src/electron-api.d.ts`).

LLM providers are a small pluggable abstraction under `src/llm/` (`types.ts`, `router.ts`, `providers/{openaiCompat,ollama,claudeCode}.ts`) - adding a new provider means implementing one `ask()` generator, nothing else changes.

## Setup

```bash
npm install
npm start
```

On first launch, open Settings (⚙️ in the header) and configure:
1. A model provider (OpenAI-compatible API key, or point at a local Ollama, or the Claude Code CLI).
2. A transcription provider (Deepgram or 60db API key) and your actual language.

Everything else (resume, knowledge base, Obsidian vault, recordings folder, hotkeys) is optional.

The **Jobs** tab needs a separate Python interpreter (3.11+):

```bash
cd python
pip install -r requirements.txt
playwright install chromium   # only needed for the hh.ru login flow
```

If `python` isn't the right interpreter on your machine (e.g. you're using a specific venv), set the
full path in Settings → "Jobs (hh.ru)" → Python Interpreter Path, then use "Test connection" to verify.

```bash
npm run make   # build a distributable
```

## Default hotkeys

| Hotkey | Action |
|---|---|
| `Ctrl+Alt+Shift+O` | Show/hide the main window |
| `Ctrl+Alt+Shift+Enter` | Ask now (send the live transcript buffer) |
| `Ctrl+Shift+M` | Cycle mode |
| `Ctrl+Alt+Shift+X` | Clear the transcript buffer |
| `Ctrl+Shift+L` | Toggle click-through |

All of these are rebindable in Settings if one conflicts with something else you run.

## Credits

- Forked from [nohairblingbling/Interview-Assistant](https://github.com/nohairblingbling/Interview-Assistant), the original Electron app this project started from.
- Several features (HUD status indicator, click-through/cursor-protection concept, quick-action presets, rebindable hotkeys) were inspired by the changelog of [sobes.tech](https://sobes.tech), a commercial interview-copilot product - implemented independently here from scratch, not derived from their code.
- [s3rgeym/hh-applicant-tool](https://github.com/s3rgeym/hh-applicant-tool) (by s3rgeym) - its Python package is vendored under `python/hh_applicant_tool/` and powers the Jobs tab, with the author's direct permission to include it here. It's driven through `python/bridge.py`, a small JSON-RPC-over-stdio adapter around its existing `ui/api.py` `Api` class; the UI itself is a from-scratch React reimplementation, not a copy of its pywebview-based one. See `python/README.md` for details.

## License

MIT - see [LICENSE](./LICENSE). This does not extend to third-party projects linked above under their own licenses.
