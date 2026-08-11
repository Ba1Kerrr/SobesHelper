import { spawn } from "child_process";
import { app } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import readline from "readline";
import type { Readable } from "stream";
import type { AskOptions, ChatMessage, ImageAttachment, LLMChunk, LLMProvider } from "../types";

export interface ClaudeCodeConfig {
  cliPath?: string;
  model?: string;
}

// The bare `claude -p` CLI only takes a text prompt, but its Read tool can
// open image files - so attachments get written to disk and referenced by
// path instead of being inlined as data.
function saveAttachmentToTemp(attachment: ImageAttachment): string {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(attachment.dataUrl);
  const ext = match ? match[1] : "png";
  const base64Data = match ? match[2] : attachment.dataUrl;
  const filePath = path.join(
    app.getPath("temp"),
    `claude-attachment-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`
  );
  fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
  return filePath;
}

function flattenMessages(messages: ChatMessage[]): string {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => {
      const speaker = m.role === "assistant" ? "Assistant" : "User";
      let text = `${speaker}: ${m.content}`;
      if (m.attachments?.length) {
        const paths = m.attachments.map(saveAttachmentToTemp);
        text += `\n[Attached image(s) - use your Read tool to view before answering: ${paths.join(", ")}]`;
      }
      return text;
    })
    .join("\n\n");
  return [...systemParts, conversation].filter(Boolean).join("\n\n");
}

// Bridges a stdout stream into an async generator of lines, so a plain
// `for await` loop can consume them as they arrive instead of waiting for
// the process to close - a pull queue fed by readline's 'line'/'close'
// events, since Node has no built-in "async-iterate a live stream of text
// lines" primitive.
async function* readLines(stream: Readable): AsyncGenerator<string> {
  const rl = readline.createInterface({ input: stream });
  const queue: string[] = [];
  let notify: (() => void) | null = null;
  let ended = false;

  rl.on("line", (line) => {
    queue.push(line);
    notify?.();
    notify = null;
  });
  rl.on("close", () => {
    ended = true;
    notify?.();
    notify = null;
  });

  while (true) {
    while (queue.length) yield queue.shift()!;
    if (ended) return;
    await new Promise<void>((resolve) => (notify = resolve));
  }
}

// Shells out to the `claude` CLI in headless print mode. Rides the user's
// existing Claude Code login/subscription instead of a separate Anthropic
// API key.
//
// The prompt is written to the child's stdin, NOT passed as a CLI argument.
// On Windows, spawn(..., {shell:true}) runs the command through cmd.exe,
// which mangles long, multi-line, non-ASCII arguments - a flattened prompt
// with embedded newlines would get truncated at the first line break, so the
// CLI only ever saw a couple of words (observed in practice: the model kept
// replying as if it had received nothing but "You" - the first word of the
// system preamble). stdin has no such parsing/quoting step, so this is the
// robust way to hand it arbitrary text of any length or script.
//
// Streaming: `--output-format stream-json --include-partial-messages
// --verbose` (all three required together - the CLI rejects stream-json
// without --verbose) emits newline-delimited JSON events as the response is
// generated. The one we care about is
// {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}}
// - yielded the moment each arrives, which is what actually fixes perceived
// latency (previously the whole CLI run was buffered and yielded as one
// chunk at the end). "thinking_delta" events are internal reasoning, not
// the answer, and are skipped. The trailing {"type":"result","result":"..."}
// line is a safety net: if nothing streamed as text_delta (older CLI,
// unexpected shape), that full text is yielded once at the end exactly like
// the old behavior - no regression for that case.
export function createClaudeCodeProvider(config: ClaudeCodeConfig): LLMProvider {
  return {
    name: "claude_code",
    async *ask(messages: ChatMessage[], options: AskOptions): AsyncIterable<LLMChunk> {
      const bin = config.cliPath || "claude";
      const args = ["-p", "--output-format", "stream-json", "--include-partial-messages", "--verbose"];
      if (config.model) args.push("--model", config.model);

      const child = spawn(bin, args, { shell: process.platform === "win32" });

      let stderr = "";
      let streamedAny = false;
      let fallbackResult: string | null = null;
      let spawnError: Error | null = null;

      const onAbort = () => child.kill();
      options.signal?.addEventListener("abort", onAbort);

      child.on("error", (err: NodeJS.ErrnoException) => {
        spawnError =
          err.code === "ENOENT"
            ? new Error(
                'Claude Code CLI not found. Install it and make sure "claude" is on PATH, or set a custom path in Settings.'
              )
            : err;
      });
      child.stderr?.on("data", (chunk) => (stderr += chunk.toString()));

      child.stdin?.write(flattenMessages(messages), "utf-8");
      child.stdin?.end();

      try {
        for await (const line of readLines(child.stdout!)) {
          if (!line.trim()) continue;
          let evt: any;
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }

          if (evt.type === "stream_event" && evt.event?.type === "content_block_delta") {
            const delta = evt.event.delta;
            if (delta?.type === "text_delta" && delta.text) {
              streamedAny = true;
              yield { delta: delta.text };
            }
          } else if (evt.type === "result" && typeof evt.result === "string") {
            fallbackResult = evt.result;
          }
        }
      } finally {
        options.signal?.removeEventListener("abort", onAbort);
      }

      const exitCode: number = await new Promise((resolve) => child.on("close", (code) => resolve(code ?? 0)));

      if (spawnError) throw spawnError;
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (exitCode !== 0 && !streamedAny && !fallbackResult) {
        throw new Error(stderr.trim() || `Claude Code CLI exited with code ${exitCode}`);
      }

      if (!streamedAny && fallbackResult) yield { delta: fallbackResult };
    },
  };
}
