import React from 'react';

export type LLMProviderKey = 'openai' | 'ollama' | 'claude_code';

export interface LLMProviderFieldsProps {
  llmProvider: LLMProviderKey;
  setLlmProvider: (v: LLMProviderKey) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  apiBase: string;
  setApiBase: (v: string) => void;
  apiModel: string;
  setApiModel: (v: string) => void;
  apiCallMethod: 'direct' | 'proxy';
  setApiCallMethod: (v: 'direct' | 'proxy') => void;
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (v: string) => void;
  ollamaModel: string;
  setOllamaModel: (v: string) => void;
  claudeCodePath: string;
  setClaudeCodePath: (v: string) => void;
  claudeCodeModel: string;
  setClaudeCodeModel: (v: string) => void;
  // Hides the optional/advanced fields (API base URL, call method, CLI path,
  // model overrides) - just the one field that's actually required per
  // provider. Used by QuickSetupPage; Settings.tsx shows everything.
  compact?: boolean;
}

// Shared by Settings.tsx (full) and QuickSetupPage.tsx (compact) so the two
// don't drift into two different implementations of the same provider form.
const LLMProviderFields: React.FC<LLMProviderFieldsProps> = ({
  llmProvider,
  setLlmProvider,
  apiKey,
  setApiKey,
  apiBase,
  setApiBase,
  apiModel,
  setApiModel,
  apiCallMethod,
  setApiCallMethod,
  ollamaBaseUrl,
  setOllamaBaseUrl,
  ollamaModel,
  setOllamaModel,
  claudeCodePath,
  setClaudeCodePath,
  claudeCodeModel,
  setClaudeCodeModel,
  compact = false,
}) => {
  return (
    <>
      <div className="mb-4">
        <label className="label">Model Provider</label>
        <select
          value={llmProvider}
          onChange={(e) => setLlmProvider(e.target.value as LLMProviderKey)}
          className="select select-bordered w-full"
        >
          <option value="openai">OpenAI-compatible (API key)</option>
          <option value="ollama">Ollama (local, free)</option>
          <option value="claude_code">Claude Code CLI (uses your existing subscription)</option>
        </select>
        {!compact && (
          <label className="label">
            <span className="label-text-alt">Which model answers interview questions. Switch any time - no restart needed.</span>
          </label>
        )}
      </div>

      {llmProvider === 'openai' && (
        <>
          <div className="mb-4">
            <label className="label">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          {!compact && (
            <>
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
            </>
          )}
        </>
      )}

      {llmProvider === 'ollama' && (
        <>
          {!compact && (
            <div className="mb-4">
              <label className="label">Ollama Base URL</label>
              <input
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                className="input input-bordered w-full"
                placeholder="http://localhost:11434"
              />
            </div>
          )}
          <div className="mb-4">
            <label className="label">Ollama Model</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              className="input input-bordered w-full"
              placeholder="llama3"
            />
            <label className="label">
              <span className="label-text-alt">Must already be pulled: `ollama pull {ollamaModel || 'llama3'}`. Requires `ollama serve` running locally.</span>
            </label>
          </div>
        </>
      )}

      {llmProvider === 'claude_code' && (
        <>
          <div className="mb-4">
            {compact ? (
              <label className="label">
                <span className="label-text-alt">Uses the `claude` CLI - requires it already installed and logged in.</span>
              </label>
            ) : (
              <>
                <label className="label">Claude Code CLI Path (optional)</label>
                <input
                  type="text"
                  value={claudeCodePath}
                  onChange={(e) => setClaudeCodePath(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="claude"
                />
                <label className="label">
                  <span className="label-text-alt">Leave empty to use `claude` from PATH. Requires the CLI to already be installed and logged in.</span>
                </label>
              </>
            )}
          </div>
          {!compact && (
            <div className="mb-4">
              <label className="label">Model (optional)</label>
              <input
                type="text"
                value={claudeCodeModel}
                onChange={(e) => setClaudeCodeModel(e.target.value)}
                className="input input-bordered w-full"
                placeholder="e.g. claude-haiku-4-5 - leave empty for the CLI default"
              />
              <label className="label">
                <span className="label-text-alt">
                  Haiku answers noticeably faster than Sonnet/Opus - worth setting explicitly for a live interview
                  where speed matters more than depth.
                </span>
              </label>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default LLMProviderFields;
