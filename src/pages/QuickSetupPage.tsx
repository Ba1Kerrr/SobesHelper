import React, { useEffect, useState } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import LLMProviderFields, { LLMProviderKey } from '../components/LLMProviderFields';

interface QuickSetupPageProps {
  onDone: () => void;
  onOpenSettings: () => void;
}

// The fast path past the ~12-section Settings page for a first run - just
// the two things loadConfig() (OverlayPage.tsx) actually requires before the
// chat view unlocks: a model provider and a transcription provider.
const QuickSetupPage: React.FC<QuickSetupPageProps> = ({ onDone, onOpenSettings }) => {
  const { error, setError, clearError } = useError();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  const [llmProvider, setLlmProvider] = useState<LLMProviderKey>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [apiModel, setApiModel] = useState('gpt-4o');
  const [apiCallMethod, setApiCallMethod] = useState<'direct' | 'proxy'>('direct');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3');
  const [claudeCodePath, setClaudeCodePath] = useState('');
  const [claudeCodeModel, setClaudeCodeModel] = useState('');

  const [sttProvider, setSttProvider] = useState<'deepgram' | '60db'>('deepgram');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [sixtydbApiKey, setSixtydbApiKey] = useState('');

  useEffect(() => {
    window.electronAPI
      .getConfig()
      .then((config) => {
        setLlmProvider((config.llm_provider as LLMProviderKey) || 'openai');
        setApiKey(config.openai_key || '');
        setApiBase(config.api_base || '');
        setApiModel(config.gpt_model || 'gpt-4o');
        setApiCallMethod(config.api_call_method || 'direct');
        setOllamaBaseUrl(config.ollama_base_url || 'http://localhost:11434');
        setOllamaModel(config.ollama_model || 'llama3');
        setClaudeCodePath(config.claude_code_path || '');
        setClaudeCodeModel(config.claude_code_model || '');
        setSttProvider(config.stt_provider === '60db' ? '60db' : 'deepgram');
        setDeepgramApiKey(config.deepgram_api_key || '');
        setSixtydbApiKey(config.sixtydb_api_key || '');
      })
      .catch(() => setError('Failed to load configuration.'));
  }, []);

  const providerSatisfied = llmProvider !== 'openai' || !!apiKey;
  const sttSatisfied = sttProvider === '60db' ? !!sixtydbApiKey : !!deepgramApiKey;

  const handleNext = () => {
    if (!providerSatisfied) {
      setError('Enter an API key, or switch to Ollama/Claude Code CLI which don\'t need one.');
      return;
    }
    clearError();
    setStep(2);
  };

  const handleFinish = async () => {
    if (!sttSatisfied) {
      setError(`Enter your ${sttProvider === '60db' ? '60db' : 'Deepgram'} API key.`);
      return;
    }
    setSaving(true);
    try {
      const current = await window.electronAPI.getConfig();
      await window.electronAPI.setConfig({
        ...current,
        llm_provider: llmProvider,
        openai_key: apiKey,
        api_base: apiBase,
        gpt_model: apiModel,
        api_call_method: apiCallMethod,
        ollama_base_url: ollamaBaseUrl,
        ollama_model: ollamaModel,
        claude_code_path: claudeCodePath,
        claude_code_model: claudeCodeModel,
        stt_provider: sttProvider,
        deepgram_api_key: deepgramApiKey,
        sixtydb_api_key: sixtydbApiKey,
      });
      onDone();
    } catch {
      setError('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 max-w-md mx-auto">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-xl font-bold mb-1">Quick Setup</h1>
      <p className="text-sm opacity-60 mb-4">Step {step} of 2 - just the essentials to get listening.</p>

      <div className="flex-1 overflow-y-auto">
        {step === 1 && (
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
            compact
          />
        )}

        {step === 2 && (
          <>
            <div className="mb-4">
              <label className="label">Transcription Provider (STT)</label>
              <select
                value={sttProvider}
                onChange={(e) => setSttProvider(e.target.value as 'deepgram' | '60db')}
                className="select select-bordered w-full"
              >
                <option value="deepgram">Deepgram (recommended - fastest)</option>
                <option value="60db">60db</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="label">{sttProvider === '60db' ? '60db' : 'Deepgram'} API Key</label>
              <input
                type="password"
                value={sttProvider === '60db' ? sixtydbApiKey : deepgramApiKey}
                onChange={(e) =>
                  sttProvider === '60db' ? setSixtydbApiKey(e.target.value) : setDeepgramApiKey(e.target.value)
                }
                className="input input-bordered w-full"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 flex-shrink-0">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)} className="btn btn-ghost btn-sm">
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step === 1 ? (
          <button type="button" onClick={handleNext} className="btn btn-primary btn-sm">
            Next
          </button>
        ) : (
          <button type="button" onClick={handleFinish} className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving...' : 'Save & Start'}
          </button>
        )}
      </div>
      <button type="button" onClick={onOpenSettings} className="btn btn-ghost btn-xs mt-3 self-center opacity-60">
        Advanced settings
      </button>
    </div>
  );
};

export default QuickSetupPage;
