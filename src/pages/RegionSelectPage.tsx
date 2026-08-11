import React, { useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

const ACCENT = "#7A5CFF";

const RegionSelectPage: React.FC = () => {
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        window.electronAPI.cancelRegionSelect();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }
    if (start) {
      setCurrent({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    if (!start || !current) return;
    const rect = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
    if (rect.width < 4 || rect.height < 4) {
      window.electronAPI.cancelRegionSelect();
      return;
    }
    window.electronAPI.captureRegion(rect);
  };

  const rect =
    start && current
      ? {
          left: Math.min(start.x, current.x),
          top: Math.min(start.y, current.y),
          width: Math.abs(current.x - start.x),
          height: Math.abs(current.y - start.y),
        }
      : null;

  return (
    <div
      className="h-screen w-screen relative overflow-hidden select-none"
      style={{ background: "rgba(0,0,0,0.15)", cursor: "none" }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {rect && (
        <div
          className="absolute border-2"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderColor: ACCENT,
            background: "rgba(122,92,255,0.08)",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
          }}
        >
          <div
            className="absolute -bottom-6 left-0 px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap"
            style={{ background: ACCENT, color: "#14151B" }}
          >
            {Math.round(rect.width)} x {Math.round(rect.height)}
          </div>
        </div>
      )}
      {!rect && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs"
          style={{ background: "rgba(20,21,27,0.85)", color: "#F0F1F5" }}
        >
          Drag to select an area - Esc to cancel
        </div>
      )}
      <div ref={cursorRef} className="absolute top-0 left-0 pointer-events-none">
        <div style={{ position: "absolute", left: -10, top: -1, width: 20, height: 2, background: ACCENT }} />
        <div style={{ position: "absolute", left: -1, top: -10, width: 2, height: 20, background: ACCENT }} />
      </div>
    </div>
  );
};

export default RegionSelectPage;
