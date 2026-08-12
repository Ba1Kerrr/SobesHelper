import axios from "axios";

export interface TTSResult {
  success: boolean;
  audio_base64?: string;
  output_format?: string;
  error?: string;
}

const OPENAI_TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export async function synthesizeOpenAI(text: string, config: any): Promise<TTSResult> {
  if (!config.openai_key) return { success: false, error: "OpenAI API key missing" };
  try {
    const base = (config.api_base || "https://api.openai.com/v1").replace(/\/+$/, "");
    const response = await axios.post(
      `${base}/audio/speech`,
      {
        model: config.openai_tts_model || "tts-1",
        voice: OPENAI_TTS_VOICES.includes(config.openai_tts_voice) ? config.openai_tts_voice : "alloy",
        input: text.slice(0, 4096),
        response_format: "mp3",
      },
      {
        headers: { Authorization: `Bearer ${config.openai_key}` },
        responseType: "arraybuffer",
      }
    );
    return {
      success: true,
      audio_base64: Buffer.from(response.data).toString("base64"),
      output_format: "mp3",
    };
  } catch (error: any) {
    const message = axios.isAxiosError(error)
      ? error.response
        ? `OpenAI TTS error: ${error.response.status} ${error.response.statusText}`
        : error.message
      : error.message || "Unknown error";
    return { success: false, error: message };
  }
}

export function listOpenAIVoices(): string[] {
  return OPENAI_TTS_VOICES;
}
