import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [apiModel, setApiModel] = useState('gpt-4o');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiCallMethod, setApiCallMethod] = useState<'direct' | 'proxy'>('direct');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState('auto');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [sttProvider, setSttProvider] = useState<'deepgram' | '60db'>('deepgram');
  const [sixtydbApiKey, setSixtydbApiKey] = useState('');
  const [sixtydbVoiceId, setSixtydbVoiceId] = useState('');
  const [ttsAutoplay, setTtsAutoplay] = useState(false);
  const [voices, setVoices] = useState<Array<{ voice_id: string; name: string; labels?: { language_name?: string; gender?: string; accent?: string } }>>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setApiKey(config.openai_key || '');
      setApiModel(config.gpt_model || 'gpt-4o');
      setApiBase(config.api_base || '');
      setApiCallMethod(config.api_call_method || 'direct');
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setDeepgramApiKey(config.deepgram_api_key || '');
      setSttProvider(config.stt_provider === '60db' ? '60db' : 'deepgram');
      setSixtydbApiKey(config.sixtydb_api_key || '');
      setSixtydbVoiceId(config.sixtydb_voice_id || '');
      setTtsAutoplay(!!config.tts_autoplay);
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.setConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
        api_call_method: apiCallMethod,
        primaryLanguage: primaryLanguage,
        deepgram_api_key: deepgramApiKey,
        stt_provider: sttProvider,
        sixtydb_api_key: sixtydbApiKey,
        sixtydb_voice_id: sixtydbVoiceId,
        tts_autoplay: ttsAutoplay,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
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

  const testAPIConfig = async () => {
    try {
      setTestResult('Testing...');
      console.log('Sending test-api-config request with config:', {
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
      });
      const result = await window.electronAPI.testAPIConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
      });
      console.log('Received test-api-config result:', result);
      if (result.success) {
        setTestResult('API configuration is valid!');
      } else {
        setTestResult(`API configuration test failed: ${result.error || 'Unknown error'}`);
        setError(`Failed to test API configuration: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('API configuration test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`API configuration test failed: ${errorMessage}`);
      setError(`Failed to test API configuration: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-4">
        <label className="label">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>
      <div className="mb-4">
        <label className="label">API Base URL (Optional)</label>
        <input
          type="text"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          className="input input-bordered w-full"
        />
        <label className="label">
          <span className="label-text-alt">
            Enter proxy URL if using API proxy. For example: https://your-proxy.com/v1
          </span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">API Model</label>
        <input
          type="text"
          value={apiModel}
          onChange={(e) => setApiModel(e.target.value)}
          className="input input-bordered w-full"
        />
        <label className="label">
          <span className="label-text-alt">Please use a model supported by your API. Preferably gpt-4.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">API Call Method</label>
        <select
          value={apiCallMethod}
          onChange={(e) => setApiCallMethod(e.target.value as 'direct' | 'proxy')}
          className="select select-bordered w-full"
        >
          <option value="direct">Direct</option>
          <option value="proxy">Proxy</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="label">Transcription Provider (STT)</label>
        <select
          value={sttProvider}
          onChange={(e) => setSttProvider(e.target.value as 'deepgram' | '60db')}
          className="select select-bordered w-full"
        >
          <option value="deepgram">Deepgram</option>
          <option value="60db">60db</option>
        </select>
        <label className="label">
          <span className="label-text-alt">Choose which engine transcribes the meeting audio in real time.</span>
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
        <label className="label">60db Voice (Text-to-Speech)</label>
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
      </div>
      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={ttsAutoplay}
            onChange={(e) => setTtsAutoplay(e.target.checked)}
            className="checkbox mr-2"
          />
          <span>Auto-speak GPT answers (60db TTS)</span>
        </label>
        <label className="label">
          <span className="label-text-alt">Best with headphones/a private output device, so playback isn&apos;t captured by the meeting.</span>
        </label>
      </div>
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
      </div>
      <div className="flex justify-between mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
        <button onClick={testAPIConfig} className="btn btn-secondary">
          Test API Configuration
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
      {testResult && <p className={`mt-2 ${testResult.includes('valid') ? 'text-success' : 'text-error'}`}>{testResult}</p>}
    </div>
  );
};

export default Settings;
