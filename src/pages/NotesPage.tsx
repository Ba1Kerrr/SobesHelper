import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useError } from "../contexts/ErrorContext";
import ErrorDisplay from "../components/ErrorDisplay";
import { useKnowledgeBase } from "../contexts/KnowledgeBaseContext";

const NotesPage: React.FC = () => {
  const { error, setError, clearError } = useError();
  const { addToKnowledgeBase } = useKnowledgeBase();
  const [vaultPath, setVaultPath] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const config = await window.electronAPI.getConfig();
        const configuredPath = config.obsidian_vault_path || "";
        setVaultPath(configuredPath);
        if (configuredPath) {
          const list = await window.electronAPI.listObsidianNotes(configuredPath);
          setNotes(list);
        }
      } catch {
        setError("Failed to list notes from the vault.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openNote = async (relativePath: string) => {
    try {
      const text = await window.electronAPI.readObsidianNote(vaultPath, relativePath);
      setSelected(relativePath);
      setContent(text);
    } catch {
      setError(`Failed to read ${relativePath}.`);
    }
  };

  if (!loading && !vaultPath) {
    return (
      <div className="text-sm">
        <ErrorDisplay error={error} onClose={clearError} />
        <p className="opacity-70">No Obsidian vault configured yet. Open Settings and pick your vault folder.</p>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <ErrorDisplay error={error} onClose={clearError} />
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSelected(null)} className="btn btn-ghost btn-xs">
            ← Back
          </button>
          <button
            onClick={() => addToKnowledgeBase(`${selected}\n\n${content}`)}
            className="btn btn-primary btn-xs"
          >
            Use as context
          </button>
        </div>
        <div className="flex-1 overflow-y-auto markdown-body bg-base-200 card-surface p-3">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ErrorDisplay error={error} onClose={clearError} />
      <p className="text-sm opacity-70 mb-2 truncate">
        {loading ? "Loading..." : `${notes.length} note${notes.length === 1 ? "" : "s"} in ${vaultPath}`}
      </p>
      <div className="flex-1 overflow-y-auto space-y-1">
        {!loading && notes.length === 0 && <p className="text-sm opacity-50">No .md files found in the vault.</p>}
        {notes.map((note) => (
          <button
            key={note}
            onClick={() => openNote(note)}
            className="block w-full text-left bg-base-200 rounded px-2 py-1 text-sm truncate"
          >
            {note}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NotesPage;
