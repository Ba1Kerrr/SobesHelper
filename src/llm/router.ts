import type { AskOptions, ChatMessage, LLMChunk, LLMProvider } from "./types";
import { MODE_SYSTEM_PROMPTS, type InterviewMode } from "./modes";
import { createOpenAICompatProvider } from "./providers/openaiCompat";
import { createOllamaProvider } from "./providers/ollama";
import { createClaudeCodeProvider } from "./providers/claudeCode";

export type LLMProviderKey = "openai" | "ollama" | "claude_code";

export function getProvider(config: any, providerKeyOverride?: LLMProviderKey): LLMProvider {
  const providerKey: LLMProviderKey = providerKeyOverride || config.llm_provider || "openai";

  switch (providerKey) {
    case "ollama":
      return createOllamaProvider({
        baseUrl: config.ollama_base_url,
        model: config.ollama_model,
      });
    case "claude_code":
      return createClaudeCodeProvider({
        cliPath: config.claude_code_path,
        model: config.claude_code_model,
      });
    case "openai":
    default:
      return createOpenAICompatProvider({
        apiKey: config.openai_key,
        apiBase: config.api_base,
        model: config.gpt_model,
      });
  }
}

export async function* askWithMode(
  config: any,
  mode: InterviewMode,
  messages: ChatMessage[],
  options: AskOptions
): AsyncIterable<LLMChunk> {
  const systemPrompt = MODE_SYSTEM_PROMPTS[mode] || MODE_SYSTEM_PROMPTS.coding;
  const withSystem: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

  const primaryKey: LLMProviderKey = config.llm_provider || "openai";
  const primary = getProvider(config, primaryKey);

  // Only fall back if the primary failed before producing a single chunk -
  // the user hasn't seen any answer yet, so a full retry on another
  // provider is a clean recovery. A failure mid-stream is left alone
  // instead: splicing in a second provider's continuation would produce a
  // answer stitched from two different models, which is worse than just
  // surfacing the error with whatever partial text already showed.
  let yieldedAny = false;
  try {
    for await (const chunk of primary.ask(withSystem, options)) {
      yieldedAny = true;
      yield chunk;
    }
  } catch (err) {
    if (yieldedAny || options.signal?.aborted) throw err;
    const fallbackKey: LLMProviderKey | undefined = config.llm_fallback_provider || undefined;
    if (!fallbackKey || fallbackKey === primaryKey) throw err;
    const fallback = getProvider(config, fallbackKey);
    yield* fallback.ask(withSystem, options);
  }
}
