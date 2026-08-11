import React, { useEffect, useState } from "react";
import type { IconType } from "react-icons";
import { FiBriefcase, FiTrello, FiFilm, FiFileText, FiCommand, FiBookOpen, FiSettings } from "react-icons/fi";
import { getStats, UsageStats } from "../utils/stats";
import { InterviewMode } from "../contexts/InterviewContext";

type ActiveView = "dashboard" | "chat" | "settings" | "knowledge" | "notes" | "recordings" | "jobs" | "kanban" | "hotkeys";

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

const QUICK_LINKS: Array<{ view: ActiveView; icon: IconType; label: string }> = [
  { view: "jobs", icon: FiBriefcase, label: "Jobs" },
  { view: "kanban", icon: FiTrello, label: "Kanban" },
  { view: "recordings", icon: FiFilm, label: "Recordings" },
  { view: "notes", icon: FiFileText, label: "Notes" },
  { view: "hotkeys", icon: FiCommand, label: "Hotkeys" },
  { view: "knowledge", icon: FiBookOpen, label: "Knowledge" },
  { view: "settings", icon: FiSettings, label: "Settings" },
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
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div
        className="card-surface bg-base-200 p-4"
        style={{ backgroundImage: `linear-gradient(135deg, ${accentColor}22, transparent 60%)` }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide opacity-60">Current mode</span>
          <span
            className="badge badge-sm font-semibold"
            style={{ background: accentColor, color: "#14151B", border: "none" }}
          >
            {MODE_LABELS[mode]}
          </span>
        </div>
        {activeVacancy ? (
          <p className="text-base font-medium truncate">📌 {activeVacancy.vacancy_name}</p>
        ) : (
          <p className="text-xs opacity-50">No vacancy attached - pick one from Jobs → Responses.</p>
        )}
      </div>

      <button
        onClick={onToggleListening}
        className="interactive w-full py-4 rounded-2xl text-base font-semibold card-surface"
        style={{
          background: isListening ? "linear-gradient(135deg, #F87171, #EF4444)" : `linear-gradient(135deg, ${accentColor}, #31E6E0)`,
          color: "#14151B",
        }}
      >
        {isListening ? "■  Stop listening" : "●  Start listening"}
      </button>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="card-surface bg-base-200 p-3">
          <div className="opacity-60 text-xs mb-0.5">Questions answered</div>
          <div className="text-2xl font-bold">{stats.questionsAnswered}</div>
        </div>
        <div className="card-surface bg-base-200 p-3">
          <div className="opacity-60 text-xs mb-0.5">Time to first word</div>
          <div className="text-2xl font-bold">{avgFirstWord}</div>
        </div>
      </div>

      <div className="card-surface bg-base-200 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs opacity-60">Active model</span>
          <span className="text-xs opacity-40">Ctrl+Alt+1..5 to switch slots</span>
        </div>
        <p className="text-sm font-medium mt-1">
          {activeSlot?.label ? `${activeSlot.label} (${llmProvider})` : llmProvider || "Not configured"}
        </p>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Quick links</div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.view}
                onClick={() => onNavigate(link.view)}
                className="interactive card-surface bg-base-200 p-3 flex flex-col items-center gap-1.5 text-xs"
              >
                <Icon size={18} style={{ color: accentColor }} />
                {link.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
