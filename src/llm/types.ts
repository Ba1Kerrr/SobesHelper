export type ChatRole = "system" | "user" | "assistant";

export interface ImageAttachment {
  // data: URL, e.g. "data:image/png;base64,...."
  dataUrl: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // Only honored by providers that support it (currently: Claude Code CLI).
  attachments?: ImageAttachment[];
}

export interface AskOptions {
  signal?: AbortSignal;
}

export interface LLMChunk {
  delta: string;
}

export interface LLMProvider {
  name: string;
  ask(messages: ChatMessage[], options: AskOptions): AsyncIterable<LLMChunk>;
}
