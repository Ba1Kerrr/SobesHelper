import React, { useEffect, useState } from "react";
import { useInterview } from "../contexts/InterviewContext";

const MODE_LABELS: Record<string, string> = {
  coding: "Coding",
  explain: "Explain",
  behavioral: "Behavioral",
};

const HudPage: React.FC = () => {
  const { mode } = useInterview();
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [clickThrough, setClickThrough] = useState(false);

  useEffect(() => {
    window.electronAPI.getOverlayStatus().then((status) => {
      setOverlayVisible(status.visible);
      setClickThrough(status.clickThrough);
    });

    const handleVisibility = (_e: any, data: { visible: boolean }) => setOverlayVisible(data.visible);
    const handleHotkey = (_e: any, data: { action: string; value?: boolean }) => {
      if (data.action === "click-through-changed") {
        setClickThrough(!!data.value);
      }
    };

    window.electronAPI.ipcRenderer.on("overlay-visibility-changed", handleVisibility);
    window.electronAPI.ipcRenderer.on("hotkey", handleHotkey);

    return () => {
      window.electronAPI.ipcRenderer.removeListener("overlay-visibility-changed", handleVisibility);
      window.electronAPI.ipcRenderer.removeListener("hotkey", handleHotkey);
    };
  }, []);

  return (
    <div className="flex items-center justify-center h-screen w-screen select-none">
      <div className="flex items-center gap-1.5 bg-black bg-opacity-60 rounded-full px-3 py-1 text-white text-xs whitespace-nowrap">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${overlayVisible ? "bg-green-400" : "bg-gray-500"}`} />
        <span>Overlay {overlayVisible ? "on" : "hidden"}</span>
        <span className="opacity-30">|</span>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${clickThrough ? "bg-yellow-400" : "bg-gray-500"}`} />
        <span>Protection {clickThrough ? "on" : "off"}</span>
        <span className="opacity-30">|</span>
        <span>{MODE_LABELS[mode] || mode}</span>
      </div>
    </div>
  );
};

export default HudPage;
