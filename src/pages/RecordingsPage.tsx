import React, { useEffect, useState } from "react";
import { useError } from "../contexts/ErrorContext";
import ErrorDisplay from "../components/ErrorDisplay";

interface RecordingFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

interface Meeting {
  name: string;
  files: RecordingFile[];
}

interface SearchResult {
  meetingName: string;
  filePath: string;
  snippet: string;
  mtime: number;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toFileUrl = (filePath: string): string => "file:///" + filePath.replace(/\\/g, "/");

const AUDIO_EXTENSIONS = [".webm", ".mp3", ".wav", ".m4a", ".ogg"];
const isAudioFile = (name: string): boolean => AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

const RecordingsPage: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await window.electronAPI.listRecordings();
        setMeetings(list);
      } catch {
        setError("Failed to load recordings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Debounced - searches saved transcript-*.md files, not the audio files
  // themselves (there's nothing to search inside those).
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      window.electronAPI
        .searchTranscripts(searchQuery.trim())
        .then(setSearchResults)
        .catch(() => setError("Failed to search transcripts."))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full">
      <ErrorDisplay error={error} onClose={clearError} />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search past interview transcripts..."
        className="input input-bordered input-sm w-full mb-2 flex-shrink-0"
      />
      {loading && <p className="text-sm opacity-50">Loading...</p>}
      {!loading && meetings.length === 0 && !searchQuery && (
        <p className="text-sm opacity-70">
          No recordings yet. Turn on "Save interview recordings" in Settings to start saving them.
        </p>
      )}

      {searchQuery.trim() ? (
        <div className="flex-1 overflow-y-auto space-y-2">
          {searching && <p className="text-sm opacity-50">Searching...</p>}
          {!searching && searchResults.length === 0 && <p className="text-sm opacity-50">No matches.</p>}
          {searchResults.map((r, i) => (
            <div key={i} className="card-surface bg-base-200 p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold truncate">{r.meetingName}</span>
                <button onClick={() => window.electronAPI.openPath(r.filePath)} className="btn btn-ghost btn-xs flex-shrink-0">
                  Open
                </button>
              </div>
              <p className="text-xs opacity-70">{r.snippet}</p>
              <p className="text-xs opacity-40 mt-1">{new Date(r.mtime).toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {meetings.map((meeting) => (
            <div key={meeting.name} className="card-surface bg-base-200 p-2">
              <p className="text-sm font-semibold mb-1 truncate">{meeting.name}</p>
              {meeting.files.map((file) => (
                <div key={file.path} className="mb-1.5">
                  <div className="text-xs opacity-60 mb-0.5 flex items-center justify-between">
                    <span>
                      {file.name} - {new Date(file.mtime).toLocaleString()} - {formatSize(file.size)}
                    </span>
                    {!isAudioFile(file.name) && (
                      <button onClick={() => window.electronAPI.openPath(file.path)} className="btn btn-ghost btn-xs">
                        Open
                      </button>
                    )}
                  </div>
                  {isAudioFile(file.name) && <audio controls src={toFileUrl(file.path)} className="w-full h-8" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecordingsPage;
