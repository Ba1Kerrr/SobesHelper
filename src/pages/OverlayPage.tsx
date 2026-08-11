declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Timer from "../components/Timer";
import ErrorDisplay from "../components/ErrorDisplay";
import Settings from "./Settings";
import KnowledgeBase from "./KnowledgeBase";
import NotesPage from "./NotesPage";
import RecordingsPage from "./RecordingsPage";
import JobsPage from "./JobsPage";
import HotkeysPage from "./HotkeysPage";
import DashboardPage from "./DashboardPage";
import QuickSetupPage from "./QuickSetupPage";
import { useKnowledgeBase } from "../contexts/KnowledgeBaseContext";
import { useError } from "../contexts/ErrorContext";
import { useInterview, InterviewMode } from "../contexts/InterviewContext";
import { recordQuestion, recordFirstChunk, recordSessionStart } from "../utils/stats";
import { detectQuestion, classifyAmbiguousFragment } from "../utils/questionDetection";

const AUTO_SUBMIT_SILENCE_MS = 1400;
// Used instead of the full silence window when the fragment already looks
// unambiguously like a complete question (trailing "?", a clear question
// word) - most of AUTO_SUBMIT_SILENCE_MS exists to give an ambiguous
// fragment room to keep going, which a clean "?" doesn't need.
const FAST_SILENCE_MS = 400;
const MIN_AUTO_SUBMIT_CHARS = 8;
// Rule-based detection below this length is too unreliable to bother
// classifying with the AI fallback - just treat it as "not a question."
const AMBIGUOUS_LENGTH_FLOOR = 20;
// Only the last N messages (both roles) go to the LLM - full history stays
// in `conversations` for scrollback, but sending everything ever said in
// the interview slows every subsequent question down (more tokens to
// process) for no benefit past a certain point.
const HISTORY_WINDOW = 6;
const INPUT_MAX_HEIGHT = 112;

const COLORS = {
  surface: "#1B1B22",
  userBubble: "#2C2450",
  border: "#2C2F3A",
  text: "#F0F1F5",
  muted: "#8B8FA3",
  accent: "#7A5CFF",
  cyan: "#31E6E0",
};

const MODE_COLORS: Record<InterviewMode, string> = {
  coding: "#7A5CFF",
  explain: "#31E6E0",
  behavioral: "#FFB84D",
};

const MODE_LABELS: Record<InterviewMode, string> = {
  coding: "Coding",
  explain: "Explain",
  behavioral: "Behavioral",
};

const MODE_ORDER: InterviewMode[] = ["coding", "explain", "behavioral"];

const markdownStyles = `
  .markdown-body { font-size: 14px; line-height: 1.5; }
  .markdown-body p { margin: 0 0 8px; }
  .markdown-body p:last-child { margin-bottom: 0; }
  .markdown-body code { padding: 0.15em 0.4em; font-size: 85%; background-color: rgba(255,255,255,0.08); border-radius: 3px; }
  .markdown-body pre { padding: 10px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #12131a; border-radius: 6px; }
`;

type ActiveView = "dashboard" | "chat" | "settings" | "knowledge" | "notes" | "recordings" | "jobs" | "hotkeys";

const VIEW_TITLES: Record<Exclude<ActiveView, "chat" | "dashboard">, string> = {
  settings: "Settings",
  knowledge: "Knowledge Base",
  notes: "Obsidian Notes",
  recordings: "Recordings",
  jobs: "Jobs",
  hotkeys: "Hotkeys",
};

const OverlayPage: React.FC = () => {
  const { knowledgeBase, conversations, addConversation } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const { currentText, setCurrentText, lastProcessedIndex, setLastProcessedIndex, mode, setMode } = useInterview();

  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [activeVacancy, setActiveVacancyState] = useState<{ vacancy_name: string; employer_name?: string; vacancy_url?: string } | null>(
    null
  );
  const [vacancyMenuOpen, setVacancyMenuOpen] = useState(false);
  const [vacancyMenuLoading, setVacancyMenuLoading] = useState(false);
  const [recentNegotiations, setRecentNegotiations] = useState<
    Array<{ id: string; vacancy_name: string | null; employer_name: string | null }>
  >([]);
  const [isListening, setIsListening] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [accentColor, setAccentColor] = useState(COLORS.accent);
  const [slotToast, setSlotToast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Answering, like listening, is on by default - the whole point is that it
  // "just works" without remembering to flip a switch mid-interview.
  const [isAutoGPTEnabled, setIsAutoGPTEnabled] = useState(true);
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveAnswer, setLiveAnswer] = useState("");
  // Display-only, from Deepgram's non-final results - never feeds
  // currentText/auto-submit, just makes the "Hearing:" line update live
  // instead of only after each pause. Cleared once the matching final
  // transcript lands (handleTranscript below) or listening stops.
  const [interimText, setInterimText] = useState("");
  const [meetingName, setMeetingName] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  // Tracks the STT websocket itself, separate from isListening (which only
  // means "the capture pipeline is running") - a dropped socket with capture
  // still running is exactly the silent-failure case this exists to surface.
  const [sttStatus, setSttStatus] = useState<"idle" | "connecting" | "connected" | "reconnecting" | "disconnected">(
    "idle"
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const askStartedAtRef = useRef<number>(0);
  const currentTextRef = useRef("");
  const lastProcessedIndexRef = useRef(0);
  // Guards against overlapping AI classify-fragment calls: a slow provider
  // (claude_code CLI in particular) can still be mid-classification when a
  // second, overlapping ambiguous fragment arrives - without this, each one
  // would fire its own round trip instead of the later, superset fragment
  // just waiting for the in-flight one to clear.
  const classifyInFlightRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isListeningRef = useRef(false);
  const sttReconnectAttemptsRef = useRef(0);
  const sttReconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speakText = useCallback(async (text: string) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    try {
      const config = await window.electronAPI.getConfig();
      if (!config.sixtydb_api_key) {
        setError("60db API key not configured. Add it in Settings to use Text-to-Speech.");
        return;
      }
      setIsSpeaking(true);
      const result = await window.electronAPI.speak60db(trimmed, config);
      if (!result.success || !result.audio_base64) {
        throw new Error(result.error || "Failed to synthesize speech");
      }
      if (ttsAudioRef.current) ttsAudioRef.current.pause();
      const mime = result.output_format === "wav" ? "audio/wav" : result.output_format === "ogg" ? "audio/ogg" : "audio/mpeg";
      const audio = new Audio(`data:${mime};base64,${result.audio_base64}`);
      audio.volume = typeof config.tts_volume === "number" ? config.tts_volume : 1;
      if (config.tts_output_device_id && "setSinkId" in audio) {
        await (audio as any).setSinkId(config.tts_output_device_id).catch(() => {});
      }
      ttsAudioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch (err: any) {
      setIsSpeaking(false);
      setError(err?.message || "Failed to play Text-to-Speech audio.");
    }
  }, [setError]);

  const stopSpeaking = useCallback(() => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setActiveVacancyState(config?.active_vacancy || null);
      setAccentColor(config?.accent_color || COLORS.accent);
      const sttOk = config?.stt_provider === "60db" ? !!config.sixtydb_api_key : !!config?.deepgram_api_key;
      const providerOk =
        config?.llm_provider === "ollama" || config?.llm_provider === "claude_code" ? true : !!config?.openai_key;
      if (config && sttOk && providerOk) {
        setIsConfigured(true);
        clearError();
      } else {
        // No error banner here - QuickSetupPage is the dedicated UI for this
        // exact state now, a redundant banner on top of it is just noise.
        setIsConfigured(false);
      }
    } catch {
      setError("Failed to load configuration.");
    }
  }, [clearError, setError]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const applyModelSlot = useCallback(async (slot: number) => {
    const config = await window.electronAPI.getConfig();
    const preset = (config.model_slots || [])[slot - 1];
    if (!preset) {
      setSlotToast(`Model slot ${slot} isn't set up - configure it in Settings → Model.`);
      setTimeout(() => setSlotToast(null), 3000);
      return;
    }
    await window.electronAPI.setConfig({
      ...config,
      llm_provider: preset.llmProvider,
      openai_key: preset.apiKey,
      gpt_model: preset.apiModel,
      api_base: preset.apiBase,
      api_call_method: preset.apiCallMethod,
      ollama_base_url: preset.ollamaBaseUrl,
      ollama_model: preset.ollamaModel,
      claude_code_path: preset.claudeCodePath,
      claude_code_model: preset.claudeCodeModel,
    });
    setSlotToast(`Switched to model slot ${slot}${preset.label ? `: ${preset.label}` : ""}`);
    setTimeout(() => setSlotToast(null), 2200);
  }, []);

  // Re-check whenever the user leaves the Settings view, so a fix applied
  // there clears the banner without needing to restart the window.
  useEffect(() => {
    if (activeView === "chat") loadConfig();
  }, [activeView, loadConfig]);

  // Mirrors currentText/lastProcessedIndex into refs so the auto-submit
  // effect's async classifier path can check "did new transcript arrive
  // while I was awaiting the AI fallback call" against the live value, not
  // whatever was current when that particular effect run's closure formed.
  useEffect(() => {
    currentTextRef.current = currentText;
    lastProcessedIndexRef.current = lastProcessedIndex;
  }, [currentText, lastProcessedIndex]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // newContent === undefined means "use the live transcript buffer" - in that
  // case (and only then, by default) the buffer pointer advances once this
  // question is sent. Typed questions and canned quick-action prompts pass
  // explicit content and leave the transcript buffer untouched, so Auto GPT
  // doesn't lose whatever was said in the background while composing them.
  const handleAskGPT = useCallback(
    async (newContent?: string, options?: { imagesOverride?: string[]; consumeTranscript?: boolean }) => {
      const usingTranscript = newContent === undefined;
      const contentToProcess = newContent ?? currentText.slice(lastProcessedIndex).trim();
      if (!contentToProcess) return;

      const consumeTranscript = options?.consumeTranscript ?? usingTranscript;
      const attachedImages = options?.imagesOverride ?? pendingImages;

      setIsLoading(true);
      setLiveAnswer("");
      activeRequestIdRef.current = null;
      const askStartedAt = Date.now();
      askStartedAtRef.current = askStartedAt;
      try {
        const config = await window.electronAPI.getConfig();
        const messages = [
          ...(config.resume ? [{ role: "user", content: `My resume:\n${config.resume}` }] : []),
          ...(config.active_vacancy
            ? [{ role: "user", content: `Vacancy I'm interviewing for:\n${JSON.stringify(config.active_vacancy)}` }]
            : []),
          ...knowledgeBase.map((item) => ({ role: "user", content: item })),
          ...conversations.slice(-HISTORY_WINDOW),
          {
            role: "user",
            content: contentToProcess,
            ...(attachedImages.length ? { attachments: attachedImages.map((dataUrl) => ({ dataUrl })) } : {}),
          },
        ];

        const response = await window.electronAPI.askLLM({ config, mode, messages });
        if (response.error) throw new Error(response.error);

        recordQuestion(Date.now() - askStartedAt);
        const formattedResponse = (response.content || "").trim();
        addConversation({ role: "user", content: contentToProcess });
        addConversation({ role: "assistant", content: formattedResponse });
        if (consumeTranscript) setLastProcessedIndex(currentText.length);
        setPendingImages([]);

        if (config.tts_autoplay && config.sixtydb_api_key) {
          speakText(formattedResponse);
        }
      } catch {
        setError("Failed to get a response. Please try again.");
      } finally {
        setIsLoading(false);
        setLiveAnswer("");
        activeRequestIdRef.current = null;
      }
    },
    [currentText, lastProcessedIndex, pendingImages, knowledgeBase, conversations, mode, addConversation, setLastProcessedIndex, speakText, setError]
  );

  // Just accumulates transcript text. Auto GPT debounce below decides when
  // (and whether) to actually send it.
  useEffect(() => {
    const handleTranscript = (_event: any, data: any) => {
      if (!data.transcript || !data.is_final) return;
      const newTranscript = data.transcript.trim();
      setInterimText("");
      if (!newTranscript) return;
      setCurrentText((prev: string) => {
        if (prev.endsWith(newTranscript)) return prev;
        return prev + (prev ? "\n" : "") + newTranscript;
      });
    };
    const handleInterim = (_event: any, data: { transcript?: string }) => {
      setInterimText(data.transcript || "");
    };
    window.electronAPI.ipcRenderer.on("stt-transcript", handleTranscript);
    window.electronAPI.ipcRenderer.on("stt-interim", handleInterim);
    return () => {
      window.electronAPI.ipcRenderer.removeListener("stt-transcript", handleTranscript);
      window.electronAPI.ipcRenderer.removeListener("stt-interim", handleInterim);
    };
  }, [setCurrentText]);

  // Fires once, AUTO_SUBMIT_SILENCE_MS after the last transcript update - a
  // single debounce timer via effect cleanup, no separate polling loop.
  // Fragments shorter than MIN_AUTO_SUBMIT_CHARS are skipped (STT sometimes
  // hallucinates short words like "You" out of silence). Above that floor,
  // detectQuestion() gates submission instead of just length - a rule-based
  // hit submits immediately; an ambiguous-but-substantial fragment goes
  // through one cheap AI classification call first (still inside this same
  // debounce window, so it doesn't add a second wait on top).
  //
  // Gated on !isLoading: a request in flight can easily take longer than the
  // silence window (especially through the Claude Code CLI provider), and
  // without this guard a second timer would fire mid-request using the
  // lastProcessedIndex from BEFORE the first one resolves - sending the same
  // text twice, duplicated, as two separate unrelated turns. isLoading is in
  // the dependency array specifically so this effect re-evaluates the moment
  // the in-flight request finishes, picking up whatever accumulated meanwhile.
  useEffect(() => {
    if (!isAutoGPTEnabled || isLoading) return;
    const pending = currentText.slice(lastProcessedIndex).trim();
    if (pending.length < MIN_AUTO_SUBMIT_CHARS) return;

    const quickCheck = detectQuestion(pending);
    const silenceMs =
      quickCheck.isLikelyQuestion && quickCheck.confidence === "high" ? FAST_SILENCE_MS : AUTO_SUBMIT_SILENCE_MS;

    const timer = setTimeout(async () => {
      const stillPending = currentText.slice(lastProcessedIndex).trim();
      if (stillPending.length < MIN_AUTO_SUBMIT_CHARS) return;

      const detection = detectQuestion(stillPending);
      let shouldSubmit = detection.isLikelyQuestion;

      if (
        !shouldSubmit &&
        detection.confidence === "low" &&
        stillPending.length >= AMBIGUOUS_LENGTH_FLOOR &&
        !classifyInFlightRef.current
      ) {
        const config = await window.electronAPI.getConfig();
        // Freshness check: new transcript may have arrived while awaiting
        // getConfig/classifyAmbiguousFragment below - if so, this fragment
        // is stale and the newer effect run's own timer will handle it.
        const isStale = () => currentTextRef.current.slice(lastProcessedIndexRef.current).trim() !== stillPending;
        if (isStale()) return;
        if (config.question_detection_ai_fallback !== false) {
          classifyInFlightRef.current = true;
          try {
            shouldSubmit = await classifyAmbiguousFragment(stillPending, config);
          } finally {
            classifyInFlightRef.current = false;
          }
          if (isStale()) return;
        }
      }

      if (!shouldSubmit) return;

      if (detection.confidence === "high" && detection.suggestedMode && detection.suggestedMode !== mode) {
        setMode(detection.suggestedMode);
      }
      handleAskGPT(stillPending, { consumeTranscript: true });
    }, silenceMs);

    return () => clearTimeout(timer);
  }, [currentText, isAutoGPTEnabled, lastProcessedIndex, isLoading, handleAskGPT, mode, setMode]);

  useEffect(() => {
    const handleChunk = (_event: any, data: { requestId: string; delta: string }) => {
      if (activeRequestIdRef.current !== data.requestId) {
        activeRequestIdRef.current = data.requestId;
        setLiveAnswer(data.delta);
        recordFirstChunk(Date.now() - askStartedAtRef.current);
      } else {
        setLiveAnswer((prev) => prev + data.delta);
      }
    };
    const handleHotkey = (_event: any, data: { action: string; slot?: number }) => {
      if (data.action === "ask-now") {
        handleAskGPT();
      } else if (data.action === "clear-transcript") {
        setCurrentText("");
        setLastProcessedIndex(0);
      } else if (data.action === "region-select") {
        startRegionSelect();
      } else if (data.action === "toggle-auto-answer") {
        setIsAutoGPTEnabled((prev) => !prev);
      } else if (data.action === "regenerate-last") {
        const lastUser = [...conversations].reverse().find((c) => c.role === "user");
        if (lastUser) handleAskGPT(lastUser.content, { consumeTranscript: false });
      } else if (data.action === "switch-model-slot" && data.slot) {
        applyModelSlot(data.slot);
      }
    };
    window.electronAPI.ipcRenderer.on("llm-chunk", handleChunk);
    window.electronAPI.ipcRenderer.on("hotkey", handleHotkey);
    return () => {
      window.electronAPI.ipcRenderer.removeListener("llm-chunk", handleChunk);
      window.electronAPI.ipcRenderer.removeListener("hotkey", handleHotkey);
    };
  }, [handleAskGPT, setCurrentText, setLastProcessedIndex, conversations, applyModelSlot]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversations, liveAnswer]);

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      setUserMedia(stream);

      const config = await window.electronAPI.getConfig();
      const result = await window.electronAPI.ipcRenderer.invoke("start-stt", {
        stt_provider: config.stt_provider || "deepgram",
        deepgram_key: config.deepgram_api_key,
        sixtydb_key: config.sixtydb_api_key,
        primaryLanguage: config.primaryLanguage,
      });
      if (!result.success) throw new Error(result.error);

      if (config.record_interviews) {
        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          if (recordedChunksRef.current.length === 0) return;
          const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
          recordedChunksRef.current = [];
          const buffer = await blob.arrayBuffer();
          try {
            await window.electronAPI.saveRecording(buffer, meetingName);
          } catch {
            setError("Failed to save the interview recording.");
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const proc = context.createScriptProcessor(4096, 1, 1);
      setProcessor(proc);
      source.connect(proc);
      proc.connect(context.destination);
      proc.onaudioprocess = (e: { inputBuffer: { getChannelData: (arg0: number) => any } }) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }
        window.electronAPI.ipcRenderer.invoke("send-audio", audioData.buffer);
      };

      setIsListening(true);
      setSttStatus("connecting");
      sttReconnectAttemptsRef.current = 0;
      setInterimText("");
      recordSessionStart();
    } catch {
      setError("Failed to start listening. Check screen-share permissions and try again.");
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (userMedia) userMedia.getTracks().forEach((track) => track.stop());
    if (audioContext) audioContext.close();
    if (processor) processor.disconnect();
    window.electronAPI.ipcRenderer.invoke("stop-stt");
    if (sttReconnectTimeoutRef.current) clearTimeout(sttReconnectTimeoutRef.current);
    sttReconnectAttemptsRef.current = 0;
    setSttStatus("idle");
    setIsListening(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setInterimText("");

    // Session review, alongside the audio recording (if that's enabled) -
    // no click needed, matches the rest of the app's "just works" bar.
    if (conversations.length > 0) {
      const transcriptMd = [
        `# ${meetingName || "Interview"} - ${new Date().toLocaleString()}`,
        "",
        ...conversations.map((c) => `**${c.role === "user" ? "Q" : "A"}:** ${c.content}`),
      ].join("\n\n");
      window.electronAPI.saveTranscript(transcriptMd, meetingName).catch(() => {
        setError("Failed to save the interview transcript.");
      });
    }
  };

  // The STT socket (Deepgram/60db) can drop independently of the audio
  // capture pipeline - a network blip, token expiry, server restart. Without
  // this, the mic button keeps showing "listening" while transcripts have
  // silently stopped arriving, the worst failure mode for a live copilot.
  // Reconnects the socket only (start-stt again) - getDisplayMedia is NOT
  // re-invoked, since that would re-prompt the OS screen-share picker mid-
  // interview; the existing audioContext/processor keep capturing the whole
  // time and just resume feeding a fresh connection once it's back.
  const MAX_STT_RECONNECT_ATTEMPTS = 5;
  const handleSttDrop = useCallback(() => {
    if (!isListeningRef.current) return;
    if (sttReconnectAttemptsRef.current >= MAX_STT_RECONNECT_ATTEMPTS) {
      setSttStatus("disconnected");
      setError("Speech-to-text disconnected and couldn't reconnect - click the mic button to restart listening.");
      return;
    }
    setSttStatus("reconnecting");
    const attempt = sttReconnectAttemptsRef.current;
    sttReconnectAttemptsRef.current += 1;
    const delayMs = Math.min(1000 * 2 ** attempt, 8000);
    sttReconnectTimeoutRef.current = setTimeout(async () => {
      if (!isListeningRef.current) return;
      try {
        const config = await window.electronAPI.getConfig();
        const result = await window.electronAPI.ipcRenderer.invoke("start-stt", {
          stt_provider: config.stt_provider || "deepgram",
          deepgram_key: config.deepgram_api_key,
          sixtydb_key: config.sixtydb_api_key,
          primaryLanguage: config.primaryLanguage,
        });
        if (!result.success) throw new Error(result.error);
      } catch {
        handleSttDrop();
      }
    }, delayMs);
  }, [setError]);

  useEffect(() => {
    const handleSttStatus = (_event: any, data: { status: string }) => {
      if (data.status === "open") {
        sttReconnectAttemptsRef.current = 0;
        setSttStatus("connected");
      } else if (data.status === "closed") {
        handleSttDrop();
      }
    };
    const handleSttError = () => handleSttDrop();
    window.electronAPI.ipcRenderer.on("stt-status", handleSttStatus);
    window.electronAPI.ipcRenderer.on("stt-error", handleSttError);
    return () => {
      window.electronAPI.ipcRenderer.removeListener("stt-status", handleSttStatus);
      window.electronAPI.ipcRenderer.removeListener("stt-error", handleSttError);
    };
  }, [handleSttDrop]);

  useEffect(() => {
    return () => {
      if (isListening) stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoGrowInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, INPUT_MAX_HEIGHT) + "px";
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    handleAskGPT(text);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const attachClipboardImage = async () => {
    try {
      const dataUrl = await window.electronAPI.readClipboardImage();
      if (!dataUrl) {
        setError("No image found in the clipboard. Copy a screenshot first.");
        return;
      }
      setPendingImages((prev) => [...prev, dataUrl]);
    } catch {
      setError("Failed to read image from clipboard.");
    }
  };

  const insertClipboardText = async () => {
    try {
      const text = await window.electronAPI.readClipboardText();
      if (!text || !text.trim()) {
        setError("No text found in the clipboard.");
        return;
      }
      setInputValue((prev) => (prev ? prev + "\n" : "") + text.trim());
      requestAnimationFrame(autoGrowInput);
    } catch {
      setError("Failed to read text from clipboard.");
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startRegionSelect = async () => {
    try {
      await window.electronAPI.openRegionSelect();
    } catch {
      setError("Failed to open the region selector.");
    }
  };

  useEffect(() => {
    const handleRegionCaptured = (_event: any, data: { dataUrl: string | null; error?: string }) => {
      if (!data.dataUrl) {
        setError(data.error || "Screenshot failed.");
        return;
      }
      const images = [...pendingImages, data.dataUrl];
      setPendingImages(images);
      handleAskGPT("Analyze what's on screen and help with the current question.", { imagesOverride: images });
    };
    window.electronAPI.ipcRenderer.on("region-captured", handleRegionCaptured);
    return () => window.electronAPI.ipcRenderer.removeListener("region-captured", handleRegionCaptured);
  }, [pendingImages, handleAskGPT, setError]);

  const cycleMode = () => {
    const next = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
    setMode(next);
  };

  // One click to open, one to pick - attaching interview context without
  // leaving chat for the Jobs tab. Negotiations are only fetched when the
  // dropdown actually opens, not eagerly on every render.
  const toggleVacancyMenu = async () => {
    if (vacancyMenuOpen) {
      setVacancyMenuOpen(false);
      return;
    }
    setVacancyMenuOpen(true);
    setVacancyMenuLoading(true);
    try {
      const list = await window.electronAPI.callHHTool("get_negotiations_from_db");
      setRecentNegotiations((list || []).slice(0, 5));
    } catch {
      setRecentNegotiations([]);
    } finally {
      setVacancyMenuLoading(false);
    }
  };

  const attachVacancy = async (n: { id: string; vacancy_name: string | null; employer_name: string | null }) => {
    const vacancy = { vacancy_name: n.vacancy_name || "Unknown vacancy", employer_name: n.employer_name || "" };
    const config = await window.electronAPI.getConfig();
    await window.electronAPI.setConfig({ ...config, active_vacancy: vacancy });
    setActiveVacancyState(vacancy);
    setVacancyMenuOpen(false);
  };

  const detachVacancy = async () => {
    const config = await window.electronAPI.getConfig();
    await window.electronAPI.setConfig({ ...config, active_vacancy: null });
    setActiveVacancyState(null);
    setVacancyMenuOpen(false);
  };

  const lastAssistantMessage = [...conversations].reverse().find((c) => c.role === "assistant")?.content || "";

  return (
    <div
      className="relative flex flex-col h-screen w-screen overflow-hidden select-none"
      style={
        {
          background: "rgba(16,16,20,0.94)",
          color: COLORS.text,
          fontSize: 14,
          "--accent-glow": accentColor,
        } as React.CSSProperties
      }
    >
      <style>{markdownStyles}</style>
      {slotToast && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full text-xs whitespace-nowrap"
          style={{ background: COLORS.surface, border: `1px solid ${accentColor}`, color: COLORS.text }}
        >
          {slotToast}
        </div>
      )}

      <div
        className="drag-region flex items-center justify-between px-3 h-11 flex-shrink-0 border-b"
        style={{ borderColor: COLORS.border }}
      >
        {activeView === "chat" || activeView === "dashboard" ? (
          <>
            <button
              onClick={cycleMode}
              className="no-drag-region neon-glow px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: MODE_COLORS[mode], color: "#14151B" }}
              title="Click to cycle mode (Ctrl+Shift+M)"
            >
              {MODE_LABELS[mode]}
            </button>
            <div className="no-drag-region relative">
              <button
                onClick={toggleVacancyMenu}
                className="btn btn-ghost btn-xs max-w-[110px] truncate"
                title={activeVacancy ? `Interview context: ${activeVacancy.vacancy_name}` : "Attach a vacancy as interview context"}
              >
                📌{activeVacancy ? ` ${activeVacancy.vacancy_name}` : ""}
              </button>
              {vacancyMenuOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-10 rounded p-2 text-xs w-56"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                >
                  {vacancyMenuLoading && <p className="opacity-60">Loading...</p>}
                  {!vacancyMenuLoading && recentNegotiations.length === 0 && (
                    <p className="opacity-60">No responses yet - use the Jobs tab first.</p>
                  )}
                  {recentNegotiations.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => attachVacancy(n)}
                      className="block w-full text-left truncate py-1 hover:opacity-80"
                    >
                      {n.vacancy_name || n.id}
                    </button>
                  ))}
                  {activeVacancy && (
                    <button
                      onClick={detachVacancy}
                      className="block w-full text-left py-1 mt-1 border-t"
                      style={{ borderColor: COLORS.border, color: "#F87171" }}
                    >
                      Detach
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="no-drag-region flex items-center gap-1">
              <button onClick={() => setActiveView("dashboard")} className="btn btn-ghost btn-xs" title="Dashboard">
                🏠
              </button>
              <button onClick={() => setActiveView("jobs")} className="btn btn-ghost btn-xs" title="Jobs">
                💼
              </button>
              <button onClick={() => setActiveView("recordings")} className="btn btn-ghost btn-xs" title="Recordings">
                🎬
              </button>
              <button onClick={() => setActiveView("notes")} className="btn btn-ghost btn-xs" title="Obsidian Notes">
                📝
              </button>
              <button onClick={() => setActiveView("knowledge")} className="btn btn-ghost btn-xs" title="Knowledge Base">
                📚
              </button>
              <button onClick={() => setActiveView("hotkeys")} className="btn btn-ghost btn-xs" title="Hotkeys">
                ⌨️
              </button>
              <button onClick={() => setActiveView("settings")} className="btn btn-ghost btn-xs" title="Settings">
                ⚙️
              </button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setActiveView("chat")} className="no-drag-region btn btn-ghost btn-xs">
              ← Back
            </button>
            <span className="font-semibold text-sm">{VIEW_TITLES[activeView]}</span>
            <span style={{ width: 40 }} />
          </>
        )}
      </div>

      <div className="px-2 pt-1 flex-shrink-0">
        <ErrorDisplay error={error} onClose={clearError} />
      </div>

      {activeView === "settings" && (
        <div className="flex-1 overflow-y-auto">
          <Settings />
        </div>
      )}

      {activeView === "knowledge" && (
        <div className="flex-1 overflow-y-auto p-3">
          <KnowledgeBase />
        </div>
      )}

      {activeView === "notes" && (
        <div className="flex-1 overflow-y-auto p-3">
          <NotesPage />
        </div>
      )}

      {activeView === "hotkeys" && (
        <div className="flex-1 overflow-y-auto p-3">
          <HotkeysPage />
        </div>
      )}

      {activeView === "recordings" && (
        <div className="flex-1 overflow-y-auto p-3">
          <RecordingsPage />
        </div>
      )}

      {activeView === "jobs" && (
        <div className="flex-1 overflow-y-auto p-3">
          <JobsPage />
        </div>
      )}

      {(activeView === "chat" || activeView === "dashboard") && !isConfigured && (
        <div className="flex-1 overflow-y-auto">
          <QuickSetupPage onDone={loadConfig} onOpenSettings={() => setActiveView("settings")} />
        </div>
      )}

      {activeView === "dashboard" && isConfigured && (
        <DashboardPage
          onNavigate={setActiveView}
          isListening={isListening}
          onToggleListening={isListening ? stopListening : startListening}
          mode={mode}
          activeVacancy={activeVacancy}
          accentColor={accentColor}
        />
      )}

      {activeView === "chat" && isConfigured && (
        <>
          <div
            className="no-drag-region flex items-center gap-2 px-3 py-1.5 border-b text-xs flex-shrink-0"
            style={{ borderColor: COLORS.border }}
          >
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isConfigured}
              className="btn btn-circle btn-xs"
              style={{ background: isListening ? "#F87171" : COLORS.surface, border: "none" }}
              title={isListening ? "Stop listening" : "Start listening"}
            >
              {isListening ? "■" : "●"}
            </button>
            {isListening && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background:
                    sttStatus === "connected"
                      ? "#4ADE80"
                      : sttStatus === "reconnecting" || sttStatus === "connecting"
                        ? "#FBBF24"
                        : "#F87171",
                }}
                title={
                  sttStatus === "connected"
                    ? "Speech-to-text connected"
                    : sttStatus === "reconnecting"
                      ? "Reconnecting..."
                      : sttStatus === "connecting"
                        ? "Connecting..."
                        : "Disconnected - click the mic button to restart"
                }
              />
            )}
            {isListening ? (
              <Timer isRunning={isListening} />
            ) : (
              <input
                type="text"
                value={meetingName}
                onChange={(e) => setMeetingName(e.target.value)}
                placeholder="Meeting name"
                className="input input-bordered input-xs flex-1"
                style={{ background: COLORS.surface, color: COLORS.text, borderColor: COLORS.border }}
              />
            )}
            <label
              className="flex items-center gap-1 cursor-pointer flex-shrink-0"
              style={{ color: COLORS.muted }}
              title="Answers on its own ~1.4s after the interviewer stops talking. Turn off to only answer when you click a quick action or press Enter."
            >
              <input
                type="checkbox"
                checked={isAutoGPTEnabled}
                onChange={(e) => setIsAutoGPTEnabled(e.target.checked)}
                className="checkbox checkbox-xs"
              />
              Auto-answer
            </label>
          </div>

          {(currentText.slice(lastProcessedIndex).trim() || interimText) && (
            <div className="px-3 py-1 text-xs truncate flex-shrink-0" style={{ color: COLORS.muted }}>
              Hearing: {currentText.slice(lastProcessedIndex).trim()}
              {interimText && <span style={{ opacity: 0.6 }}> {interimText}</span>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {conversations.length === 0 && !isLoading && (
              <p className="text-xs text-center mt-6" style={{ color: COLORS.muted }}>
                Start listening, or just type a question below.
              </p>
            )}
            {conversations.map((conv, i) => (
              <div key={i} className={`flex ${conv.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-3 py-2"
                  style={{ background: conv.role === "user" ? COLORS.userBubble : COLORS.surface }}
                >
                  <ReactMarkdown className="markdown-body whitespace-pre-wrap">{conv.content}</ReactMarkdown>
                  {conv.role !== "user" && (
                    <button
                      onClick={() => navigator.clipboard.writeText(conv.content).catch(() => {})}
                      className="no-drag-region text-xs opacity-40 hover:opacity-80 mt-1"
                      title="Copy answer - text in this window can't be selected directly"
                    >
                      📋 Copy
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div
                  className="relative max-w-[85%] rounded-2xl pl-4 pr-3 py-2 overflow-hidden"
                  style={{ background: COLORS.surface }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 streaming-pulse-bar" />
                  <ReactMarkdown className="markdown-body whitespace-pre-wrap">{liveAnswer || "..."}</ReactMarkdown>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-1 flex-shrink-0">
              {pendingImages.map((dataUrl, i) => (
                <div key={i} className="relative">
                  <img src={dataUrl} className="h-10 w-10 object-cover rounded" style={{ border: `1px solid ${COLORS.border}` }} />
                  <button
                    onClick={() => removePendingImage(i)}
                    className="absolute -top-1 -right-1 btn btn-circle btn-xs"
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="no-drag-region flex gap-1.5 px-3 pb-1.5 flex-shrink-0">
            <button
              onClick={() => handleAskGPT()}
              disabled={isLoading}
              className="btn btn-xs flex-1"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            >
              💬 Что сказать
            </button>
            <button
              onClick={startRegionSelect}
              disabled={isLoading}
              className="btn btn-xs flex-1"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
              title="Drag-select part of the screen to analyze"
            >
              🖥 Экран
            </button>
            <button
              onClick={() => handleAskGPT("Summarize our conversation so far.")}
              disabled={isLoading || conversations.length === 0}
              className="btn btn-xs flex-1"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
            >
              📝 Резюме
            </button>
            {lastAssistantMessage && (
              <button
                onClick={() => (isSpeaking ? stopSpeaking() : speakText(lastAssistantMessage))}
                className="btn btn-xs btn-circle"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                title={isSpeaking ? "Stop speaking" : "Speak last answer"}
              >
                {isSpeaking ? "⏹" : "🔊"}
              </button>
            )}
            {lastAssistantMessage && (
              <button
                onClick={() => handleAskGPT(`Elaborate on your last answer with more detail:\n\n${lastAssistantMessage}`)}
                disabled={isLoading}
                className="btn btn-xs btn-circle"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                title="Elaborate on the last answer"
              >
                ✏️
              </button>
            )}
            {lastAssistantMessage && (
              <button
                onClick={() => handleAskGPT(`Make your last answer shorter and punchier, same substance:\n\n${lastAssistantMessage}`)}
                disabled={isLoading}
                className="btn btn-xs btn-circle"
                style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                title="Shorten the last answer"
              >
                ✂️
              </button>
            )}
          </div>

          <div className="no-drag-region flex items-end gap-1.5 p-2 border-t flex-shrink-0" style={{ borderColor: COLORS.border }}>
            <button
              onClick={attachClipboardImage}
              className="btn btn-circle btn-xs"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              title="Attach image from clipboard (Claude Code only)"
            >
              📎
            </button>
            <button
              onClick={insertClipboardText}
              className="btn btn-circle btn-xs"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
              title="Paste clipboard text into the question box"
            >
              📋
            </button>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                autoGrowInput();
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a question..."
              rows={1}
              className="flex-1 resize-none rounded-lg px-2 py-1.5 text-sm outline-none"
              style={{
                background: COLORS.surface,
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                maxHeight: INPUT_MAX_HEIGHT,
                overflowY: "auto",
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="btn btn-circle btn-xs neon-glow"
              style={{ background: accentColor, border: "none" }}
              title="Send"
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default OverlayPage;
