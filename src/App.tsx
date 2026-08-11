import React from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ErrorProvider } from './contexts/ErrorContext';
import { KnowledgeBaseProvider } from './contexts/KnowledgeBaseContext';
import OverlayPage from './pages/OverlayPage';
import HudPage from './pages/HudPage';
import RegionSelectPage from './pages/RegionSelectPage';
import { InterviewProvider } from './contexts/InterviewContext';

const App: React.FC = () => {
  return (
    <InterviewProvider>
      <ErrorProvider>
        <KnowledgeBaseProvider>
          <Router>
            <Routes>
              <Route path="/overlay" element={<OverlayPage />} />
              <Route path="/hud" element={<HudPage />} />
              <Route path="/region-select" element={<RegionSelectPage />} />
              <Route path="/" element={<Navigate to="/overlay" replace />} />
              <Route path="*" element={<Navigate to="/overlay" replace />} />
            </Routes>
          </Router>
        </KnowledgeBaseProvider>
      </ErrorProvider>
    </InterviewProvider>
  );
};

export default App;
