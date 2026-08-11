import type { InterviewMode } from "../contexts/InterviewContext";

export interface QuestionDetection {
  isLikelyQuestion: boolean;
  confidence: "high" | "low";
  suggestedMode: InterviewMode | null;
}

const QUESTION_WORDS = [
  "кто", "что", "где", "когда", "почему", "зачем", "как", "ли", "разве", "неужели",
  "сколько", "какой", "какая", "какое", "какие", "чем", "куда", "откуда",
];

const IMPERATIVE_OPENERS = ["расскажи", "объясни", "опиши", "приведи пример", "покажи", "напиши"];

const CODING_HINTS = ["код", "алгоритм", "функци", "сложност", "leetcode", "структур данных", "массив", "sql"];
const BEHAVIORAL_HINTS = [
  "расскажи о случае", "конфликт", "опыт работы", "твоя роль", "команд", "провал", "ошибк",
  "сложная ситуац", "почему ты",
];
const EXPLAIN_HINTS = ["что такое", "разница между", "как работает", "объясни"];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function suggestMode(text: string): InterviewMode | null {
  if (containsAny(text, BEHAVIORAL_HINTS)) return "behavioral";
  if (containsAny(text, CODING_HINTS)) return "coding";
  if (containsAny(text, EXPLAIN_HINTS)) return "explain";
  return null;
}

// Fast, synchronous, no I/O - covers the large majority of real interview
// fragments (trailing "?", a Russian question word, or an imperative
// "explain/describe/tell me about" opener all read as clearly a question).
export function detectQuestion(rawText: string): QuestionDetection {
  const text = normalize(rawText);
  const suggestedMode = suggestMode(text);

  if (!text) return { isLikelyQuestion: false, confidence: "high", suggestedMode: null };

  if (text.endsWith("?")) {
    return { isLikelyQuestion: true, confidence: "high", suggestedMode };
  }

  const words = text.split(/\s+/);
  const hasQuestionWord = words.some((w) => QUESTION_WORDS.includes(w.replace(/[.,!?]/g, "")));
  if (hasQuestionWord) {
    return { isLikelyQuestion: true, confidence: "high", suggestedMode };
  }

  if (IMPERATIVE_OPENERS.some((opener) => text.startsWith(opener))) {
    return { isLikelyQuestion: true, confidence: "high", suggestedMode };
  }

  return { isLikelyQuestion: false, confidence: "low", suggestedMode };
}

// For the ambiguous minority (rule-based says "low confidence" but the
// fragment is long enough to plausibly be a real, just-oddly-phrased
// question) - one cheap round trip asking for a single YES/NO token,
// through whatever provider is already configured. Uses a dedicated
// non-broadcasting IPC call (not askLLM/askWithMode) so this internal
// classification call never gets a mode's full system prompt prepended and
// never flashes into the visible chat's streaming-answer state via
// llm-chunk. Never throws: any failure here just means "don't auto-submit
// this one," not a broken UI.
export async function classifyAmbiguousFragment(text: string, config: any): Promise<boolean> {
  try {
    const response = await window.electronAPI.classifyFragment(config, text);
    return /^\s*yes/i.test(response.content || "");
  } catch {
    return false;
  }
}
