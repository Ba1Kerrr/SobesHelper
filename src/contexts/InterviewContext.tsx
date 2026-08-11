import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

export type InterviewMode = "coding" | "explain" | "behavioral";

interface InterviewContextType {
  currentText: string;
  setCurrentText: React.Dispatch<React.SetStateAction<string>>;
  lastProcessedIndex: number;
  setLastProcessedIndex: React.Dispatch<React.SetStateAction<number>>;
  mode: InterviewMode;
  setMode: (mode: InterviewMode) => Promise<void>;
}

const InterviewContext = createContext<InterviewContextType | undefined>(undefined);

export const InterviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentText, setCurrentText] = useState("");
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [mode, setModeState] = useState<InterviewMode>("coding");

  // Mode is shared across the app window and the HUD window, which are
  // separate renderer processes - the main process is the source of truth
  // and broadcasts changes to both.
  useEffect(() => {
    window.electronAPI.getMode().then((m: string) => setModeState(m as InterviewMode));

    const handleModeChanged = (_e: any, data: { mode: InterviewMode }) => {
      setModeState(data.mode);
    };
    window.electronAPI.ipcRenderer.on("mode-changed", handleModeChanged);
    return () => {
      window.electronAPI.ipcRenderer.removeListener("mode-changed", handleModeChanged);
    };
  }, []);

  const setMode = async (newMode: InterviewMode) => {
    setModeState(newMode);
    await window.electronAPI.setMode(newMode);
  };

  return (
    <InterviewContext.Provider
      value={{
        currentText,
        setCurrentText,
        lastProcessedIndex,
        setLastProcessedIndex,
        mode,
        setMode,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (context === undefined) {
    throw new Error('useInterview must be used within an InterviewProvider');
  }
  return context;
};
