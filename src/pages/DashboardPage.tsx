import React, { useEffect, useState } from "react";
import { getStats, UsageStats } from "../utils/stats";
import { InterviewMode } from "../contexts/InterviewContext";

type ActiveView = "dashboard" | "chat" | "settings" | "knowledge" | "notes" | "recordings" | "jobs" | "hotkeys";

interface ModelSlot {
  label: string;
  llmProvider: string;
}

interface DashboardPageProps {
  onNavigate: (view: ActiveView) => void;
  isListening: boolean;
  onToggleListening: () => void;
  mode: InterviewMode;
  activeVacancy: { vacancy_name: string; employer_name?: string } | null;
  accentColor: string;
}

const MODE_LABELS: Record<InterviewMode, string> = {
  coding: "Coding",
  explain: "Explain",
  behavioral: "Behavioral",
};

const QUICK_LINKS: Array<{ view: ActiveView; icon: string; label: string }> = [
  { view: "jobs", icon: "💼", label: "Jobs & Kanban" },
  { view: "recordings", icon: "🎬", label: "Recordings" },
  { view: "notes", icon: "📝", label: "Notes" },
  { view: "hotkeys", icon: "⌨️", label: "Hotkeys" },
  { view: "knowledge", icon: "📚", label: "Knowledge" },
  { view: "settings", icon: "⚙️", label: "Settings" },
];

const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  isListening,
  onToggleListening,
  mode,
  activeVacancy,
  accentColor,
}) => {
  const [stats, setStats] = useState<UsageStats>(getStats());
  const [activeSlot, setActiveSlot] = useState<ModelSlot | null>(null);
  const [llmProvider, setLlmProvider] = useState<string>("");

  useEffect(() => {
    setStats(getStats());
    window.electronAPI
      .getConfig()
      .then((config) => {
        setLlmProvider(config.llm_provider || "openai");
        // No per-slot "currently active" flag is persisted - slots are just
        // presets a hotkey copies into the live provider fields - so this
        // shows slot 1 as a representative label rather than claiming to
        // know which slot was last pressed.
        const slots: ModelSlot[] = config.model_slots || [];
        setActiveSlot(slots[0] || null);
      })
      .catch(() => {});
  }, []);

  const avgFirstWord =
    stats.firstChunkCount > 0 ? `${(stats.totalFirstChunkMs / stats.firstChunkCount / 1000).toFixed(1)}s` : "-";

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      <div className="card-surface bg-base-200 p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs opacity-60">Mode</span>
          <span className="badge badge-sm" style={{ background: accentColor, color: "#14151B", border: "none" }}>
            {MODE_LABELS[mode]}
          </span>
        </div>
        {activeVacancy ? (
          <p className="text-sm truncate">📌 {activeVacancy.vacancy_name}</p>
        ) : (
          <p className="text-xs opacity-50">No vacancy attached - pick one from Jobs → Responses.</p>
        )}
      </div>

      <button
        onClick={onToggleListening}
        className="w-full py-3 rounded-xl text-sm font-semibold card-surface"
        style={{
          background: isListening ? "#F87171" : accentColor,
          color: "#14151B",
        }}
      >
        {isListening ? "■ Stop listening" : "● Start listening"}
      </button>
      <button onClick={() => onNavigate("chat")} className="btn btn-ghost btn-xs w-full">
        Open chat →
      </button>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="card-surface bg-base-200 p-2">
          <div className="opacity-60 text-xs">Questions answered</div>
          <div className="text-lg font-semibold">{stats.questionsAnswered}</div>
        </div>
        <div className="card-surface bg-base-200 p-2">
          <div className="opacity-60 text-xs">Avg. time to first word</div>
          <div className="text-lg font-semibold">{avgFirstWord}</div>
        </div>
      </div>

      <div className="card-surface bg-base-200 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs opacity-60">Active model</span>
          <span className="text-xs opacity-50">Ctrl+Alt+1..5 to switch slots</span>
        </div>
        <p className="text-sm mt-0.5">{activeSlot?.label ? `${activeSlot.label} (${llmProvider})` : llmProvider || "Not configured"}</p>
      </div>

      <div>
        <div className="text-xs opacity-60 mb-1.5">Quick links</div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.view}
              onClick={() => onNavigate(link.view)}
              className="card-surface bg-base-200 hover:bg-base-300 p-2 flex flex-col items-center gap-1 text-xs"
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
