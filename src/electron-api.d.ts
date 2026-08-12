export interface ElectronAPI {
  saveTempAudioFile(audioEncoded: ArrayBuffer): unknown;
  transcribeAudioFile(tempFilePath: any, arg1: { primaryLanguage: string; secondaryLanguage: string; api_base: any; openai_key: any; }): TranscriptionResult | PromiseLike<TranscriptionResult>;
  getConfig: () => Promise<any>;
  setConfig: (config: any) => Promise<void>;
  startRecording: () => Promise<Array<{id: string, name: string, thumbnail: string}>>;
  parsePDF: (pdfBuffer: ArrayBuffer) => Promise<{ text: string, error?: string }>;
  processImage: (imagePath: string) => Promise<string>;
  highlightCode: (code: string, language: string) => Promise<string>;
  ipcRenderer: {
    removeAllListeners: any;
    invoke(channel: string, ...args: any[]): Promise<any>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeListener(channel: string, listener: (...args: any[]) => void): void;
  };
  askLLM: (params: {
    config: any;
    mode: string;
    messages: { role: string; content: string; attachments?: { dataUrl: string }[] }[];
  }) => Promise<{ requestId: string; content?: string; error?: string }>;
  readClipboardImage: () => Promise<string | null>;
  readClipboardText: () => Promise<string>;
  openRegionSelect: () => Promise<void>;
  cancelRegionSelect: () => Promise<void>;
  captureRegion: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
  cancelLLM: (requestId: string) => Promise<void>;
  toggleOverlay: () => Promise<{ visible: boolean }>;
  getMode: () => Promise<string>;
  setMode: (mode: string) => Promise<void>;
  getOverlayStatus: () => Promise<{ visible: boolean; clickThrough: boolean }>;
  getHotkeyStatus: () => Promise<Array<{ id: string; label: string; accelerator: string; registered: boolean }>>;
  setHotkey: (id: string, accelerator: string) => Promise<Array<{ id: string; label: string; accelerator: string; registered: boolean }>>;
  setHudPosition: (position: string) => Promise<void>;
  chooseRecordingsFolder: () => Promise<{ canceled: boolean; path?: string }>;
  saveRecording: (buffer: ArrayBuffer, meetingName: string) => Promise<{ path: string }>;
  saveTranscript: (markdown: string, meetingName: string) => Promise<{ path: string }>;
  openPath: (filePath: string) => Promise<void>;
  chooseFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<{ canceled: boolean; path?: string }>;
  getEncryptionAvailable: () => Promise<boolean>;
  searchTranscripts: (query: string) => Promise<Array<{ meetingName: string; filePath: string; snippet: string; mtime: number }>>;
  listRecordings: () => Promise<Array<{ name: string; files: Array<{ name: string; path: string; size: number; mtime: number }> }>>;
  setWindowOpacity: (value: number) => Promise<void>;
  chooseObsidianFolder: () => Promise<{ canceled: boolean; path?: string }>;
  listObsidianNotes: (vaultPath: string) => Promise<string[]>;
  readObsidianNote: (vaultPath: string, relativePath: string) => Promise<string>;
  transcribeAudio: (audioBuffer: ArrayBuffer, config: any) => Promise<TranscriptionResult>;
  speak60db: (text: string, config: any) => Promise<{ success: boolean; audio_base64?: string; output_format?: string; error?: string }>;
  get60dbVoices: (config: any) => Promise<{ success: boolean; voices: Array<{ voice_id: string; name: string; labels?: { language_name?: string; gender?: string; accent?: string } }>; error?: string }>;
  speakTTS: (text: string, config: any) => Promise<{ success: boolean; audio_base64?: string; output_format?: string; error?: string }>;
  getTTSVoices: (config: any) => Promise<{ success: boolean; voices: string[] } | null>;
  callHHTool: (method: string, params?: Record<string, any>) => Promise<any>;
  classifyFragment: (config: any, text: string) => Promise<{ content?: string; error?: string }>;
  openExternal: (url: string) => Promise<void>;
  superjobLogin: () => Promise<{ status: string; message?: string }>;
  superjobLogout: () => Promise<void>;
  superjobStatus: () => Promise<{ authorized: boolean }>;
  superjobSearch: (params: Record<string, any>) => Promise<{ status: string; message?: string; objects?: any[]; total?: number }>;
  getFlRuFeed: () => Promise<{ status: string; message?: string; items?: Array<{ title: string; link: string; pubDate: string; description: string }> }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

declare global {
  interface MediaTrackConstraintSet {
    chromeMediaSource?: string;
    mandatory?: {
      chromeMediaSource?: string;
      chromeMediaSourceId?: string;
    };
  }
}
