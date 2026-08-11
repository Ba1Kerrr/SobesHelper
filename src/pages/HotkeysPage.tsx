import React, { useEffect, useState } from "react";
import { useError } from "../contexts/ErrorContext";
import ErrorDisplay from "../components/ErrorDisplay";

interface HotkeyStatus {
  id: string;
  label: string;
  accelerator: string;
  registered: boolean;
}

const DESCRIPTIONS: Record<string, string> = {
  "toggle-overlay": "Show or hide the whole window without touching the tray.",
  "ask-now": "Send whatever's in the live transcript buffer right now, instead of waiting for silence.",
  "cycle-mode": "Switch between Coding / Explain / Behavioral.",
  "clear-transcript": "Wipe the accumulated transcript buffer without sending it.",
  "click-through": "Toggle whether clicks pass through the window (also available from the tray icon as a fail-safe).",
  "region-select": "Drag-select part of the screen to analyze, without opening the window first.",
  "toggle-auto-answer": "Turn auto-submit on/off - a quick kill switch if it's firing on the wrong things.",
  "regenerate-last": "Re-ask the last question, e.g. if the answer got cut off or missed the point.",
};

const formatAccelerator = (accelerator: string): string => accelerator.replace("CommandOrControl", "Ctrl");

const HotkeysPage: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [hotkeys, setHotkeys] = useState<HotkeyStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI
      .getHotkeyStatus()
      .then(setHotkeys)
      .catch(() => setError("Failed to load hotkey status."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full text-sm">
      <ErrorDisplay error={error} onClose={clearError} />
      {loading && <p className="opacity-50">Loading...</p>}
      <div className="flex-1 overflow-y-auto space-y-2">
        {hotkeys.map((hk) => (
          <div key={hk.id} className="card-surface bg-base-200 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{hk.label}</span>
              <span
                className={hk.registered ? "text-success" : "text-error"}
                title={hk.registered ? "Registered" : "Conflict - already bound by another app"}
              >
                {hk.registered ? "✓" : "✗"}
              </span>
            </div>
            <div className="font-mono text-xs opacity-80 mt-0.5">{formatAccelerator(hk.accelerator)}</div>
            {DESCRIPTIONS[hk.id] && <div className="text-xs opacity-60 mt-1">{DESCRIPTIONS[hk.id]}</div>}
          </div>
        ))}
      </div>
      <p className="text-xs opacity-50 mt-2 flex-shrink-0">All of these are rebindable in Settings.</p>
    </div>
  );
};

export default HotkeysPage;
