import React, { useState } from "react";

interface ExternalLinkPanelProps {
  siteName: string;
  note: string;
  buildUrl: (query: string, location: string) => string;
}

const inputClass = "input input-bordered input-xs w-full bg-base-200";

// Habr Career and LinkedIn both prohibit automated scraping/applying in
// their terms of use, so this doesn't try to fetch or submit anything -
// it just opens a prefilled search URL in the OS browser for the user to
// browse and apply on the real site themselves.
const ExternalLinkPanel: React.FC<ExternalLinkPanelProps> = ({ siteName, note, buildUrl }) => {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  const handleOpen = () => {
    window.electronAPI.openExternal(buildUrl(query.trim(), location.trim()));
  };

  return (
    <div className="space-y-2">
      <input
        className={inputClass}
        placeholder="Search query (e.g. Python developer)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="City / location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <button onClick={handleOpen} className="btn btn-primary btn-xs w-full">
        Open search on {siteName}
      </button>
      <p className="text-xs opacity-50">{note}</p>
    </div>
  );
};

export default ExternalLinkPanel;
