import type { AskOptions, ChatMessage, LLMChunk, LLMProvider } from "../types";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

export function createOllamaProvider(config: OllamaConfig): LLMProvider {
  return {
    name: "ollama",
    async *ask(messages: ChatMessage[], options: AskOptions): AsyncIterable<LLMChunk> {
      const baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/$/, "");

      // attachments aren't supported here (Claude Code CLI only) - strip them
      // so the request body only has fields Ollama actually understands.
      const plainMessages = messages.map(({ role, content }) => ({ role, content }));

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model || "llama3",
            messages: plainMessages,
            stream: true,
          }),
          signal: options.signal,
        });
      } catch (err: any) {
        throw new Error(
          `Could not reach Ollama at ${baseUrl}. Is "ollama serve" running? (${err?.message || err})`
        );
      }

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText} ${text}`.trim());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }

          if (parsed.error) {
            throw new Error(`Ollama error: ${parsed.error}`);
          }
          const delta = parsed?.message?.content;
          if (delta) yield { delta };
          if (parsed?.done) return;
        }
      }
    },
  };
}
