import OpenAI from "openai";
import type { AskOptions, ChatMessage, LLMChunk, LLMProvider } from "../types";
import { normalizeApiBaseUrl } from "../util";

export interface OpenAICompatConfig {
  apiKey: string;
  apiBase?: string;
  model?: string;
}

export function createOpenAICompatProvider(config: OpenAICompatConfig): LLMProvider {
  return {
    name: "openai",
    async *ask(messages: ChatMessage[], options: AskOptions): AsyncIterable<LLMChunk> {
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: normalizeApiBaseUrl(config.apiBase),
      });

      // attachments aren't supported here (Claude Code CLI only) - strip them
      // so the API doesn't choke on an unrecognized message field.
      const plainMessages = messages.map(({ role, content }) => ({ role, content }));

      const stream = await client.chat.completions.create(
        {
          model: config.model || "gpt-4o",
          messages: plainMessages as OpenAI.Chat.ChatCompletionMessageParam[],
          stream: true,
        },
        { signal: options.signal }
      );

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield { delta };
      }
    },
  };
}
