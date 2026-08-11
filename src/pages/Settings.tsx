import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';
import { getStats, UsageStats } from '../utils/stats';
import LLMProviderFields, { LLMProviderKey } from '../components/LLMProviderFields';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [llmProvider, setLlmProvider] = useState<LLMProviderKey>('openai');
  const [llmFallbackProvider, setLlmFallbackProvider] = useState<LLMProviderKey | ''>('');

  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [apiModel, setApiModel] = useState('gpt-4o');
  const [apiCallMethod, setApiCallMethod] = useState<'direct' | 'proxy'>('direct');

  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');

  const [claudeCodePath, setClaudeCodePath] = useState('');
  const [claudeCodeModel, setClaudeCodeModel] = useState('');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [primaryLanguage, setPrimaryLanguage] = useState('auto');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [sttProvider, setSttProvider] = useState<'deepgram' | '60db'>('deepgram');
  const [sixtydbApiKey, setSixtydbApiKey] = useState('');
  const [sixtydbVoiceId, setSixtydbVoiceId] = useState('');
  const [ttsAutoplay, setTtsAutoplay] = useState(false);
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string; labels?: { language_name?: string; gender?: string; accent?: string } }>>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  const [hudPosition, setHudPosition] = useState('top-right');
  const [clickThroughAlwaysOn, setClickThroughAlwaysOn] = useState(false);

  const [recordInterviews, setRecordInterviews] = useState(false);
  const [recordingsFolder, setRecordingsFolder] = useState('');

  const [windowOpacity, setWindowOpacity] = useState(1);
  const [obsidianVaultPath, setObsidianVaultPath] = useState('');
  const [resume, setResume] = useState('');
  const [questionDetectionAiFallback, setQuestionDetectionAiFallback] = useState(true);
  const [ttsOutputDeviceId, setTtsOutputDeviceId] = useState('');
  const [ttsVolume, setTtsVolume] = useState(1);
  const [audioOutputs, setAudioOutputs] = useState<Array<{ deviceId: string; label: string }>>([]);

  const [hotkeys, setHotkeys] = useState<Array<{ id: string; label: string; accelerator: string; registered: boolean }>>([]);
  const [hotkeyDrafts, setHotkeyDrafts] = useState<Record<string, string>>({});

  const [stats, setStats] = useState<UsageStats>({
    questionsAnswered: 0,
    totalResponseMs: 0,
    sessionsStarted: 0,
    totalFirstChunkMs: 0,
    firstChunkCount: 0,
  });
  const [recordingsCount, setRecordingsCount] = useState(0);

  const [pythonPath, setPythonPath] = useState('python');
  const [hhTesting, setHhTesting] = useState(false);
  const [hhTestResult, setHhTestResult] = useState<string | null>(null);

  // hh-applicant-tool's own config (separate namespace from ours, read/written
  // via its get_config/save_config) - backs the use_ai/ai_filter toggles in
  // the Jobs tab's advanced search filters.
  const [aiLetterApiKey, setAiLetterApiKey] = useState('');
  const [aiLetterHasKey, setAiLetterHasKey] = useState(false);
  const [aiLetterBaseUrl, setAiLetterBaseUrl] = useState('');
  const [aiLetterModel, setAiLetterModel] = useState('');
  const [aiLetterSaving, setAiLetterSaving] = useState(false);
  const [aiLetterSaved, setAiLetterSaved] = useState(false);
  const [encryptionAvailable, setEncryptionAvailable] = useState<boolean | null>(null);

  type SettingsSection = 'model' | 'voice' | 'control' | 'app';
  const [activeSection, setActiveSection] = useState<SettingsSection>('model');

  const [accentColor, setAccentColor] = useState('#7A5CFF');

  interface ModelSlot {
    label: string;
    llmProvider: LLMProviderKey;
    apiKey: string;
    apiBase: string;
    apiModel: string;
    apiCallMethod: 'direct' | 'proxy';
    ollamaBaseUrl: string;
    ollamaModel: string;
    claudeCodePath: string;
    claudeCodeModel: string;
  }
  const makeDefaultSlot = (n: number): ModelSlot => ({
    label: `Slot ${n}`,
    llmProvider: 'openai',
    apiKey: '',
    apiBase: '',
    apiModel: 'gpt-4o-mini',
    apiCallMethod: 'direct',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    claudeCodePath: '',
    claudeCodeModel: '',
  });
  const [modelSlots, setModelSlots] = useState<ModelSlot[]>([1, 2, 3, 4, 5].map(makeDefaultSlot));
  const updateSlot = (index: number, patch: Partial<ModelSlot>) => {
    setModelSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  useEffect(() => {
    window.electronAPI.getEncryptionAvailable().then(setEncryptionAvailable).catch(() => setEncryptionAvailable(false));
  }, []);

  useEffect(() => {
    setStats(getStats());
    window.electronAPI
      .listRecordings()
      .then((meetings) => setRecordingsCount(meetings.reduce((sum, m) => sum + m.files.length, 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setAudioOutputs(
          devices
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => ({ deviceId: d.deviceId, label: d.label || `Output ${d.deviceId.slice(0, 6)}` }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.electronAPI.getHotkeyStatus().then(setHotkeys).catch(() => {});
  }, []);

  const applyHotkey = async (id: string) => {
    const accelerator = (hotkeyDrafts[id] ?? '').trim();
    if (!accelerator) return;
    try {
      const updated = await window.electronAPI.setHotkey(id, accelerator);
      setHotkeys(updated);
      setHotkeyDrafts((prev) => ({ ...prev, [id]: '' }));
    } catch (err) {
      setError('Failed to apply the new hotkey.');
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    window.electronAPI
      .callHHTool('get_config')
      .then((hhConfig) => {
        const section = hhConfig?.openai_cover_letter || {};
        // The Python side always masks api_key to "***" in get_config (never
        // reveals a saved secret) - leave the field blank rather than
        // showing the mask, and track separately that one exists so Save
        // doesn't overwrite it with an empty string (see saveAiLetterConfig).
        setAiLetterHasKey(section.api_key === '***');
        setAiLetterBaseUrl(section.base_url || '');
        setAiLetterModel(section.model || '');
      })
      .catch(() => {
        // Jobs backend may not be reachable yet (python not installed) - the
        // "Jobs (hh.ru)" section's own Test connection surfaces that; this
        // section just stays blank until it is.
      });
  }, []);

  const saveAiLetterConfig = async () => {
    setAiLetterSaving(true);
    setAiLetterSaved(false);
    try {
      const section: Record<string, string> = { base_url: aiLetterBaseUrl, model: aiLetterModel };
      // Only send api_key when the user actually typed a new one - an empty
      // string would overwrite (not preserve) an already-saved key, since
      // the backend only skips fields it sees as the literal "***" mask.
      if (aiLetterApiKey.trim()) section.api_key = aiLetterApiKey.trim();
      await window.electronAPI.callHHTool('save_config', { updates: { openai_cover_letter: section } });
      setAiLetterHasKey(aiLetterHasKey || !!aiLetterApiKey.trim());
      setAiLetterApiKey('');
      setAiLetterSaved(true);
      setTimeout(() => setAiLetterSaved(false), 3000);
    } catch {
      setError('Failed to save AI cover-letter settings.');
    } finally {
      setAiLetterSaving(false);
    }
  };

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setLlmProvider((config.llm_provider as LLMProviderKey) || 'openai');
      setLlmFallbackProvider((config.llm_fallback_provider as LLMProviderKey) || '');
      setApiKey(config.openai_key || '');
      setApiModel(config.gpt_model || 'gpt-4o');
      setApiBase(config.api_base || '');
      setApiCallMethod(config.api_call_method || 'direct');
      setOllamaBaseUrl(config.ollama_base_url || 'http://localhost:11434');
      setOllamaModel(config.ollama_model || 'llama3');
      setClaudeCodePath(config.claude_code_path || '');
      setClaudeCodeModel(config.claude_code_model || '');
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setDeepgramApiKey(config.deepgram_api_key || '');
      setSttProvider(config.stt_provider === '60db' ? '60db' : 'deepgram');
      setSixtydbApiKey(config.sixtydb_api_key || '');
      setSixtydbVoiceId(config.sixtydb_voice_id || '');
      setTtsAutoplay(!!config.tts_autoplay);
      setHudPosition(config.hud_position || 'top-right');
      setClickThroughAlwaysOn(!!config.overlay_click_through_always_on);
      setRecordInterviews(!!config.record_interviews);
      setRecordingsFolder(config.recordings_folder || '');
      setWindowOpacity(typeof config.window_opacity === 'number' ? config.window_opacity : 1);
      setObsidianVaultPath(config.obsidian_vault_path || '');
      setResume(config.resume || '');
      setQuestionDetectionAiFallback(config.question_detection_ai_fallback !== false);
      setTtsOutputDeviceId(config.tts_output_device_id || '');
      setTtsVolume(typeof config.tts_volume === 'number' ? config.tts_volume : 1);
      setPythonPath(config.python_path || 'python');
      setAccentColor(config.accent_color || '#7A5CFF');
      if (Array.isArray(config.model_slots) && config.model_slots.length) {
        setModelSlots([1, 2, 3, 4, 5].map((n, i) => ({ ...makeDefaultSlot(n), ...config.model_slots[i] })));
      }
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      const current = await window.electronAPI.getConfig();
      await window.electronAPI.setConfig({
        ...current,
        llm_provider: llmProvider,
        llm_fallback_provider: llmFallbackProvider || null,
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
        api_call_method: apiCallMethod,
        ollama_base_url: ollamaBaseUrl,
        ollama_model: ollamaModel,
        claude_code_path: claudeCodePath,
        claude_code_model: claudeCodeModel,
        primaryLanguage: primaryLanguage,
        deepgram_api_key: deepgramApiKey,
        stt_provider: sttProvider,
        sixtydb_api_key: sixtydbApiKey,
        sixtydb_voice_id: sixtydbVoiceId,
        tts_autoplay: ttsAutoplay,
        hud_position: hudPosition,
        overlay_click_through_always_on: clickThroughAlwaysOn,
        record_interviews: recordInterviews,
        recordings_folder: recordingsFolder,
        window_opacity: windowOpacity,
        obsidian_vault_path: obsidianVaultPath,
        resume,
        tts_output_device_id: ttsOutputDeviceId,
        tts_volume: ttsVolume,
        python_path: pythonPath,
        question_detection_ai_fallback: questionDetectionAiFallback,
        accent_color: accentColor,
        model_slots: modelSlots,
      });
      await window.electronAPI.setHudPosition(hudPosition);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const chooseFolder = async () => {
    try {
      const result = await window.electronAPI.chooseRecordingsFolder();
      if (!result.canceled && result.path) {
        setRecordingsFolder(result.path);
      }
    } catch (err) {
      setError('Failed to open the folder picker.');
    }
  };

  const chooseObsidianFolder = async () => {
    try {
      const result = await window.electronAPI.chooseObsidianFolder();
      if (!result.canceled && result.path) {
        setObsidianVaultPath(result.path);
      }
    } catch (err) {
      setError('Failed to open the folder picker.');
    }
  };

  const testHHConnection = async () => {
    setHhTesting(true);
    setHhTestResult(null);
    try {
      const current = await window.electronAPI.getConfig();
      await window.electronAPI.setConfig({ ...current, python_path: pythonPath });
      const status = await window.electronAPI.callHHTool('get_status');
      setHhTestResult(
        status.authorized
          ? `Connected - signed in as ${status.user?.first_name || ''} ${status.user?.last_name || ''}`.trim()
          : 'Connected - not signed in to hh.ru yet (do that from the Jobs tab).'
      );
    } catch (err: any) {
      setHhTestResult(`Failed: ${err?.message || 'could not reach the Python bridge.'}`);
    } finally {
      setHhTesting(false);
    }
  };

  const handleOpacityChange = (value: number) => {
    setWindowOpacity(value);
    window.electronAPI.setWindowOpacity(value).catch(() => {});
  };

  const loadVoices = async () => {
    if (!sixtydbApiKey) {
      setError('Enter your 60db API key first to load voices.');
      return;
    }
    try {
      setVoicesLoading(true);
      const result = await window.electronAPI.get60dbVoices({ sixtydb_api_key: sixtydbApiKey });
      if (result.success) {
        setVoices(result.voices);
        if (!result.voices.length) {
          setError('No 60db voices found for this account.');
        }
      } else {
        setError(`Failed to load 60db voices: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Failed to load 60db voices.');
    } finally {
      setVoicesLoading(false);
    }
  };

  const testProvider = async () => {
    try {
      setTesting(true);
      setTestResult('Testing...');
      const config = {
        llm_provider: llmProvider,
        openai_key: apiKey,
        api_base: apiBase,
        gpt_model: apiModel,
        ollama_base_url: ollamaBaseUrl,
        ollama_model: ollamaModel,
        claude_code_path: claudeCodePath,
        claude_code_model: claudeCodeModel,
      };
      const response = await window.electronAPI.askLLM({
        config,
        mode: 'explain',
        messages: [{ role: 'user', content: 'Reply with just the word OK.' }],
      });
      if (response.error) {
        setTestResult(`Provider test failed: ${response.error}`);
        setError(`Failed to test model provider: ${response.error}`);
      } else {
        setTestResult(`Provider responded: ${(response.content || '(empty response)').slice(0, 200)}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`Provider test failed: ${errorMessage}`);
      setError(`Failed to test model provider: ${errorMessage}`);
    } finally {
      setTesting(false);
    }
  };

  const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
    { id: 'model', label: '🧠 Model' },
    { id: 'voice', label: '🎙️ Voice & Recording' },
    { id: 'control', label: '⌨️ Controls' },
    { id: 'app', label: '⚙️ App' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      {encryptionAvailable !== null && (
        <p className="text-xs opacity-60 mb-4">
          {encryptionAvailable
            ? "🔒 API keys on this page are encrypted at rest, tied to your OS account."
            : "⚠️ OS-level encryption isn't available here - API keys are stored in plain text in config.json."}
        </p>
      )}

      <div className="flex gap-4 items-start">
        <nav className="w-44 flex-shrink-0 sticky top-4 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm ${
                activeSection === s.id ? 'bg-primary text-primary-content' : 'hover:bg-base-200 opacity-80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0">

      {activeSection === 'model' && (
      <>
      <LLMProviderFields
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        apiKey={apiKey}
        setApiKey={setApiKey}
        apiBase={apiBase}
        setApiBase={setApiBase}
        apiModel={apiModel}
        setApiModel={setApiModel}
        apiCallMethod={apiCallMethod}
        setApiCallMethod={setApiCallMethod}
        ollamaBaseUrl={ollamaBaseUrl}
        setOllamaBaseUrl={setOllamaBaseUrl}
        ollamaModel={ollamaModel}
        setOllamaModel={setOllamaModel}
        claudeCodePath={claudeCodePath}
        setClaudeCodePath={setClaudeCodePath}
        claudeCodeModel={claudeCodeModel}
        setClaudeCodeModel={setClaudeCodeModel}
      />

      <div className="mb-4">
        <label className="label">Fallback Provider (optional)</label>
        <select
          value={llmFallbackProvider}
          onChange={(e) => setLlmFallbackProvider(e.target.value as LLMProviderKey | '')}
          className="select select-bordered w-full"
        >
          <option value="">None</option>
          <option value="openai" disabled={llmProvider === 'openai'}>OpenAI-compatible</option>
          <option value="ollama" disabled={llmProvider === 'ollama'}>Ollama</option>
          <option value="claude_code" disabled={llmProvider === 'claude_code'}>Claude Code CLI</option>
        </select>
        <label className="label">
          <span className="label-text-alt">
            If the main provider fails before answering anything, retries once with this one automatically -
            uses whatever credentials are already saved for it above. Never touches an answer that already
            started streaming.
          </span>
        </label>
      </div>

      <div className="flex justify-end mb-4">
        <button type="button" onClick={testProvider} className="btn btn-secondary" disabled={testing}>
          {testing ? 'Testing...' : 'Test Model Provider'}
        </button>
      </div>
      {testResult && <p className={`mt-1 mb-4 ${testResult.startsWith('Provider responded') ? 'text-success' : 'text-error'}`}>{testResult}</p>}

      <h2 className="text-lg font-bold mt-6 mb-2">Model Hotkey Slots</h2>
      <p className="text-xs opacity-60 mb-3">
        Press Ctrl+Alt+1 through Ctrl+Alt+5 during an interview to instantly switch the active model - e.g. a fast
        model for quick questions, a stronger one for hard ones. Overridable per-slot in Controls → Global Hotkeys.
      </p>
      <div className="space-y-2 mb-4">
        {modelSlots.map((slot, i) => (
          <details key={i} className="bg-base-200 rounded p-2">
            <summary className="cursor-pointer text-sm font-medium flex items-center gap-2">
              <span className="badge badge-sm">Ctrl+Alt+{i + 1}</span>
              <input
                type="text"
                value={slot.label}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateSlot(i, { label: e.target.value })}
                className="input input-bordered input-xs flex-1 max-w-[200px]"
              />
              <span className="opacity-50 text-xs">{slot.llmProvider}</span>
            </summary>
            <div className="mt-2 pl-1">
              <LLMProviderFields
                compact
                llmProvider={slot.llmProvider}
                setLlmProvider={(v) => updateSlot(i, { llmProvider: v })}
                apiKey={slot.apiKey}
                setApiKey={(v) => updateSlot(i, { apiKey: v })}
                apiBase={slot.apiBase}
                setApiBase={(v) => updateSlot(i, { apiBase: v })}
                apiModel={slot.apiModel}
                setApiModel={(v) => updateSlot(i, { apiModel: v })}
                apiCallMethod={slot.apiCallMethod}
                setApiCallMethod={(v) => updateSlot(i, { apiCallMethod: v })}
                ollamaBaseUrl={slot.ollamaBaseUrl}
                setOllamaBaseUrl={(v) => updateSlot(i, { ollamaBaseUrl: v })}
                ollamaModel={slot.ollamaModel}
                setOllamaModel={(v) => updateSlot(i, { ollamaModel: v })}
                claudeCodePath={slot.claudeCodePath}
                setClaudeCodePath={(v) => updateSlot(i, { claudeCodePath: v })}
                claudeCodeModel={slot.claudeCodeModel}
                setClaudeCodeModel={(v) => updateSlot(i, { claudeCodeModel: v })}
              />
            </div>
          </details>
        ))}
      </div>
      </>
      )}

      {activeSection === 'voice' && (
      <>
      <div className="mb-4">
        <label className="label">Transcription Provider (STT)</label>
        <select
          value={sttProvider}
          onChange={(e) => setSttProvider(e.target.value as 'deepgram' | '60db')}
          className="select select-bordered w-full"
        >
          <option value="deepgram">Deepgram (recommended - fastest, nova-2)</option>
          <option value="60db">60db</option>
        </select>
        <label className="label">
          <span className="label-text-alt">Choose which engine transcribes the meeting audio in real time. Deepgram's nova-2 model with low endpointing is the fastest option here.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">Deepgram API Key</label>
        <input
          type="password"
          value={deepgramApiKey}
          onChange={(e) => setDeepgramApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>
      <div className="mb-4">
        <label className="label">60db API Key</label>
        <input
          type="password"
          value={sixtydbApiKey}
          onChange={(e) => setSixtydbApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
        <label className="label">
          <span className="label-text-alt">Used for 60db transcription (if selected above) and for speaking answers aloud.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={ttsAutoplay}
            onChange={(e) => setTtsAutoplay(e.target.checked)}
            className="checkbox mr-2"
          />
          <span>Speak answers aloud (60db TTS)</span>
        </label>
        <label className="label">
          <span className="label-text-alt">Off by default - the assistant only shows text unless you turn this on. Best with headphones/a private output device, so playback isn&apos;t captured by the meeting.</span>
        </label>
      </div>
      {ttsAutoplay && (
        <div className="mb-4">
          <label className="label">60db Voice</label>
          <div className="flex space-x-2">
            <select
              value={sixtydbVoiceId}
              onChange={(e) => setSixtydbVoiceId(e.target.value)}
              className="select select-bordered flex-1"
            >
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}
                  {v.labels?.language_name ? ` (${v.labels.language_name}${v.labels.accent ? `, ${v.labels.accent}` : ''})` : ''}
                </option>
              ))}
            </select>
            <button type="button" onClick={loadVoices} className="btn btn-outline" disabled={voicesLoading}>
              {voicesLoading ? 'Loading...' : 'Load Voices'}
            </button>
          </div>
          <label className="label">
            <span className="label-text-alt">Needs the 60db API key above. Optional - leave as "System default" if you don't care which voice.</span>
          </label>
        </div>
      )}
      <div className="mb-4">
        <label className="label">Primary Language</label>
        <select
          value={primaryLanguage}
          onChange={(e) => setPrimaryLanguage(e.target.value)}
          className="select select-bordered w-full"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="label">
          <span className="label-text-alt">Picking your actual language (e.g. Russian) instead of Auto-detect gives Deepgram a real language code and is noticeably more reliable for live transcription.</span>
        </label>
      </div>
      </>
      )}

      {activeSection === 'control' && (
      <>
      <h2 className="text-lg font-bold mt-6 mb-2">Window</h2>
      <div className="mb-4">
        <label className="label">HUD Position</label>
        <select
          value={hudPosition}
          onChange={(e) => setHudPosition(e.target.value)}
          className="select select-bordered w-full"
        >
          <option value="top-left">Top left</option>
          <option value="top-center">Top center</option>
          <option value="top-right">Top right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-center">Bottom center</option>
          <option value="bottom-right">Bottom right</option>
        </select>
        <label className="label">
          <span className="label-text-alt">Where the small status readout (overlay visible / click-through) sits on screen. It's excluded from screen capture, same as the overlay.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={clickThroughAlwaysOn}
            onChange={(e) => setClickThroughAlwaysOn(e.target.checked)}
            className="checkbox mr-2"
          />
          <span>Enable click-through (cursor protection) automatically when the overlay opens</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">Window Opacity ({Math.round(windowOpacity * 100)}%)</label>
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.05}
          value={windowOpacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          className="range range-xs"
        />
        <label className="label">
          <span className="label-text-alt">Applies immediately. Lower values make the whole window see-through.</span>
        </label>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Accent Color</h2>
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-12 h-8 rounded cursor-pointer bg-transparent border-0"
          />
          <div className="flex gap-1">
            {['#7A5CFF', '#31E6E0', '#FFB84D', '#FF5C7A', '#5CFF8F'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccentColor(c)}
                className="w-6 h-6 rounded-full border-2"
                style={{ background: c, borderColor: accentColor === c ? '#fff' : 'transparent' }}
              />
            ))}
          </div>
        </div>
        <label className="label">
          <span className="label-text-alt">Applied to the send button and other primary-accent highlights in the overlay window.</span>
        </label>
      </div>
      </>
      )}

      {activeSection === 'app' && (
      <>
      <h2 className="text-lg font-bold mt-6 mb-2">Resume</h2>
      <div className="mb-4">
        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={6}
          placeholder="Paste your resume as plain text or markdown..."
          className="textarea textarea-bordered w-full text-sm"
        />
        <label className="label">
          <span className="label-text-alt">Included as context on every question automatically - no need to re-attach it.</span>
        </label>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Jobs - AI Cover Letters</h2>
      <div className="mb-4">
        <label className="label">
          <span className="label-text-alt">
            Backs the "Use AI" / "AI filter" options in the Jobs tab's advanced search filters - a separate AI
            provider from the one answering interview questions, since hh-applicant-tool manages its own config for
            cover-letter generation and vacancy filtering.
          </span>
        </label>
        <label className="label">API Key</label>
        <input
          type="password"
          value={aiLetterApiKey}
          onChange={(e) => setAiLetterApiKey(e.target.value)}
          className="input input-bordered w-full"
          placeholder={aiLetterHasKey ? 'Already set - leave blank to keep it' : ''}
        />
        <label className="label">Base URL</label>
        <input
          type="text"
          value={aiLetterBaseUrl}
          onChange={(e) => setAiLetterBaseUrl(e.target.value)}
          className="input input-bordered w-full"
          placeholder="https://api.openai.com/v1/chat/completions"
        />
        <label className="label">Model</label>
        <input
          type="text"
          value={aiLetterModel}
          onChange={(e) => setAiLetterModel(e.target.value)}
          className="input input-bordered w-full"
          placeholder="gpt-4o-mini"
        />
        <div className="flex justify-end mt-2">
          <button type="button" onClick={saveAiLetterConfig} className="btn btn-secondary" disabled={aiLetterSaving}>
            {aiLetterSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {aiLetterSaved && <p className="mt-1 text-success">Saved.</p>}
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Question Detection</h2>
      <div className="mb-4">
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            checked={questionDetectionAiFallback}
            onChange={(e) => setQuestionDetectionAiFallback(e.target.checked)}
            className="checkbox checkbox-sm"
          />
          <span className="label-text">Use AI to classify ambiguous transcript fragments</span>
        </label>
        <label className="label">
          <span className="label-text-alt">
            Most fragments are classified instantly by rule (question marks, question words). For the rare
            ambiguous-but-substantial fragment, this adds one small extra round trip asking "is this actually a
            question?" before auto-submitting - turn it off if you'd rather skip anything not caught by the rules.
          </span>
        </label>
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Jobs (hh.ru)</h2>
      <div className="mb-4">
        <label className="label">Python Interpreter Path</label>
        <input
          type="text"
          value={pythonPath}
          onChange={(e) => setPythonPath(e.target.value)}
          className="input input-bordered w-full"
          placeholder="python"
        />
        <label className="label">
          <span className="label-text-alt">
            Used to run the vendored hh-applicant-tool backend. Point this at a venv's python.exe if
            "python" on PATH isn't the right interpreter. Run `pip install -r python/requirements.txt`
            inside Interview-Assistant first.
          </span>
        </label>
        <div className="flex justify-end mt-2">
          <button type="button" onClick={testHHConnection} className="btn btn-secondary" disabled={hhTesting}>
            {hhTesting ? 'Testing...' : 'Test connection'}
          </button>
        </div>
        {hhTestResult && (
          <p className={`mt-1 ${hhTestResult.startsWith('Connected') ? 'text-success' : 'text-error'}`}>{hhTestResult}</p>
        )}
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Obsidian Vault</h2>
      <div className="mb-4">
        <label className="label">Vault Folder</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={obsidianVaultPath}
            readOnly
            placeholder="Not set"
            className="input input-bordered flex-1"
          />
          <button type="button" onClick={chooseObsidianFolder} className="btn btn-outline">
            Choose folder...
          </button>
        </div>
        <label className="label">
          <span className="label-text-alt">Browse and view your .md notes from the Notes tab. Read-only, does not modify the vault.</span>
        </label>
      </div>

      </>
      )}

      {activeSection === 'voice' && (
      <>
      <h2 className="text-lg font-bold mt-6 mb-2">Audio</h2>
      <div className="mb-4">
        <label className="label">TTS Output Device</label>
        <select
          value={ttsOutputDeviceId}
          onChange={(e) => setTtsOutputDeviceId(e.target.value)}
          className="select select-bordered w-full"
        >
          <option value="">System default</option>
          {audioOutputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        <label className="label">
          <span className="label-text-alt">Route spoken answers to a specific device (e.g. headphones only, so the meeting mic doesn't pick them up).</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">TTS Volume ({Math.round(ttsVolume * 100)}%)</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={ttsVolume}
          onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
          className="range range-xs"
        />
      </div>

      <h2 className="text-lg font-bold mt-6 mb-2">Interview Recording</h2>
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={recordInterviews}
            onChange={(e) => setRecordInterviews(e.target.checked)}
            className="checkbox mr-2"
          />
          <span>Save interview recordings to disk</span>
        </label>
        <label className="label">
          <span className="label-text-alt">Saves the captured system audio as a .webm file when you stop recording, in a folder named after the meeting.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">Save Location</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={recordingsFolder}
            readOnly
            placeholder="Documents/Interview-Assistant Recordings (default)"
            className="input input-bordered flex-1"
          />
          <button type="button" onClick={chooseFolder} className="btn btn-outline">
            Choose folder...
          </button>
        </div>
      </div>

      </>
      )}

      {activeSection === 'control' && (
      <>
      <div className="mb-4">
        <label className="label">Global Hotkeys</label>
        <ul className="text-sm space-y-1">
          {hotkeys.map((hk) => (
            <li key={hk.id} className="flex items-center gap-2 py-0.5">
              <span className={hk.registered ? 'text-success' : 'text-error'} title={hk.registered ? 'Registered' : 'Conflict - already bound by another app'}>
                {hk.registered ? '✓' : '✗'}
              </span>
              <span className="font-mono opacity-80 w-56">{hk.accelerator.replace('CommandOrControl', 'Ctrl')}</span>
              <span className="opacity-70 flex-1">{hk.label}</span>
              <input
                type="text"
                value={hotkeyDrafts[hk.id] ?? ''}
                onChange={(e) => setHotkeyDrafts((prev) => ({ ...prev, [hk.id]: e.target.value }))}
                placeholder="e.g. Alt+Shift+K"
                className="input input-bordered input-xs w-32"
              />
              <button type="button" onClick={() => applyHotkey(hk.id)} className="btn btn-xs" disabled={!hotkeyDrafts[hk.id]}>
                Apply
              </button>
            </li>
          ))}
        </ul>
        {hotkeys.some((hk) => !hk.registered) && (
          <label className="label">
            <span className="label-text-alt text-error">
              A hotkey marked ✗ is already bound by another running app (Discord, Zoom, PowerToys, etc.) - type a replacement combo above and click Apply, no restart needed.
            </span>
          </label>
        )}
      </div>
      </>
      )}

      {activeSection === 'app' && (
      <>
      <h2 className="text-lg font-bold mt-6 mb-2">Usage Stats</h2>
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="bg-base-200 rounded p-2">
          <div className="opacity-60">Questions answered</div>
          <div className="text-lg font-semibold">{stats.questionsAnswered}</div>
        </div>
        <div className="bg-base-200 rounded p-2">
          <div className="opacity-60">Avg. time to first word</div>
          <div className="text-lg font-semibold">
            {stats.firstChunkCount > 0 ? `${(stats.totalFirstChunkMs / stats.firstChunkCount / 1000).toFixed(1)}s` : '-'}
          </div>
        </div>
        <div className="bg-base-200 rounded p-2">
          <div className="opacity-60">Avg. full response time</div>
          <div className="text-lg font-semibold">
            {stats.questionsAnswered > 0 ? `${(stats.totalResponseMs / stats.questionsAnswered / 1000).toFixed(1)}s` : '-'}
          </div>
        </div>
        <div className="bg-base-200 rounded p-2">
          <div className="opacity-60">Listening sessions</div>
          <div className="text-lg font-semibold">{stats.sessionsStarted}</div>
        </div>
        <div className="bg-base-200 rounded p-2">
          <div className="opacity-60">Recordings saved</div>
          <div className="text-lg font-semibold">{recordingsCount}</div>
        </div>
      </div>
      <p className="text-xs opacity-50 -mt-3 mb-4">
        "Time to first word" is what you actually perceive as latency - full response time also counts how long the
        rest of the answer took to finish generating.
      </p>
      </>
      )}

      <div className="flex justify-between mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
        </div>
      </div>
    </div>
  );
};

export default Settings;
