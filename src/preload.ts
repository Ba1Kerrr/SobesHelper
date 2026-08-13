import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: any) => ipcRenderer.invoke('set-config', config),
  parsePDF: (buffer: ArrayBuffer) => ipcRenderer.invoke('parsePDF', buffer),
  processImage: (path: string) => ipcRenderer.invoke('process-image', path),
  highlightCode: (code: string, language: string) => ipcRenderer.invoke('highlight-code', code, language),
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
  },
  askLLM: (params: {
    config: any;
    mode: string;
    messages: { role: string; content: string; attachments?: { dataUrl: string }[] }[];
  }) => ipcRenderer.invoke('ask-llm', params),
  askLLMSilent: (params: { config: any; mode: string; messages: { role: string; content: string }[] }) =>
    ipcRenderer.invoke('ask-llm-silent', params),
  readClipboardImage: () => ipcRenderer.invoke('read-clipboard-image'),
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  openRegionSelect: () => ipcRenderer.invoke('open-region-select'),
  cancelRegionSelect: () => ipcRenderer.invoke('cancel-region-select'),
  captureRegion: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('capture-region', rect),
  cancelLLM: (requestId: string) => ipcRenderer.invoke('cancel-llm', requestId),
  toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
  getMode: () => ipcRenderer.invoke('get-mode'),
  setMode: (mode: string) => ipcRenderer.invoke('set-mode', mode),
  getOverlayStatus: () => ipcRenderer.invoke('get-overlay-status'),
  getHotkeyStatus: () => ipcRenderer.invoke('get-hotkey-status'),
  setHotkey: (id: string, accelerator: string) => ipcRenderer.invoke('set-hotkey', { id, accelerator }),
  setHudPosition: (position: string) => ipcRenderer.invoke('set-hud-position', position),
  chooseRecordingsFolder: () => ipcRenderer.invoke('choose-recordings-folder'),
  saveRecording: (buffer: ArrayBuffer, meetingName: string) =>
    ipcRenderer.invoke('save-recording', { buffer, meetingName }),
  saveTranscript: (markdown: string, meetingName: string) =>
    ipcRenderer.invoke('save-transcript', { markdown, meetingName }),
  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath),
  chooseFile: (filters?: Array<{ name: string; extensions: string[] }>) => ipcRenderer.invoke('choose-file', filters),
  getEncryptionAvailable: () => ipcRenderer.invoke('get-encryption-available'),
  searchTranscripts: (query: string) => ipcRenderer.invoke('search-transcripts', query),
  listRecordings: () => ipcRenderer.invoke('list-recordings'),
  setWindowOpacity: (value: number) => ipcRenderer.invoke('set-window-opacity', value),
  chooseObsidianFolder: () => ipcRenderer.invoke('choose-obsidian-folder'),
  listObsidianNotes: (vaultPath: string) => ipcRenderer.invoke('list-obsidian-notes', vaultPath),
  readObsidianNote: (vaultPath: string, relativePath: string) =>
    ipcRenderer.invoke('read-obsidian-note', { vaultPath, relativePath }),
  writeObsidianNote: (vaultPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke('write-obsidian-note', { vaultPath, relativePath, content }),
  exportConfig: () => ipcRenderer.invoke('export-config'),
  importConfig: () => ipcRenderer.invoke('import-config'),
  speak60db: (text: string, config: any) => ipcRenderer.invoke('speak-60db', { text, config }),
  get60dbVoices: (config: any) => ipcRenderer.invoke('get-60db-voices', config),
  speakTTS: (text: string, config: any) => ipcRenderer.invoke('speak-tts', { text, config }),
  getTTSVoices: (config: any) => ipcRenderer.invoke('get-tts-voices', config),
  transcribeAudioFile: (filePath: string, config: any) => ipcRenderer.invoke('transcribe-audio-file', filePath, config),
  saveTempAudioFile: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('save-temp-audio-file', audioBuffer),
  transcribeAudio: (audioBuffer: ArrayBuffer, config: any) => ipcRenderer.invoke('transcribe-audio', audioBuffer, config),
  callHHTool: (method: string, params?: Record<string, any>) => ipcRenderer.invoke('hh-call', { method, params }),
  classifyFragment: (config: any, text: string) => ipcRenderer.invoke('classify-fragment', { config, text }),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  superjobLogin: () => ipcRenderer.invoke('superjob-login'),
  superjobLogout: () => ipcRenderer.invoke('superjob-logout'),
  superjobStatus: () => ipcRenderer.invoke('superjob-status'),
  superjobSearch: (params: Record<string, any>) => ipcRenderer.invoke('superjob-search', params),
  getFlRuFeed: () => ipcRenderer.invoke('fl-ru-feed'),
});
