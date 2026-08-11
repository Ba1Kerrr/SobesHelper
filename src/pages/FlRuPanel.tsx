import React, { useEffect, useState } from "react";

interface FlRuProject {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

const inputClass = "input input-bordered input-xs w-full bg-base-200";

const FlRuPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<FlRuProject[]>([]);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await window.electronAPI.getFlRuFeed();
      if (result.status === "error") setError(result.message || "Failed to load FL.ru feed.");
      else setProjects(result.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = filter.trim()
    ? projects.filter((p) => (p.title + " " + p.description).toLowerCase().includes(filter.trim().toLowerCase()))
    : projects;

  return (
    <div className="space-y-2">
      <p className="text-xs opacity-50">
        FL.ru has no application API - this is a read-only feed of new projects. Click through to apply on fl.ru.
      </p>
      <div className="flex items-center gap-2">
        <input
          className={`${inputClass} flex-1`}
          placeholder="Filter by keyword (client-side)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button onClick={load} disabled={loading} className="btn btn-ghost btn-xs flex-shrink-0">
          {loading ? "..." : "🔄"}
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {loading && <p className="text-xs opacity-50">Loading...</p>}
      {!loading && filtered.length === 0 && !error && <p className="text-xs opacity-50">No projects found.</p>}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.link} className="bg-base-200 rounded p-2">
            <div className="font-medium truncate">{p.title}</div>
            <p className="text-xs opacity-70 mt-0.5 line-clamp-2">{p.description}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs opacity-50">{p.pubDate}</span>
              <button onClick={() => window.electronAPI.openExternal(p.link)} className="btn btn-ghost btn-xs">
                Open on fl.ru
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlRuPanel;
