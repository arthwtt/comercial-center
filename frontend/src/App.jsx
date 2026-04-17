import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConnectionPage from './pages/Settings/ConnectionPage';
import KanbanBoard from './pages/Kanban/KanbanBoard';
import LeadsStaging from './pages/Staging/LeadsStaging';
import Sidebar from './components/Layout/Sidebar';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30 flex">
        <Sidebar />
        <main className="flex-1 overflow-auto h-screen relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <Routes>
            <Route path="/" element={<Navigate to="/kanban" replace />} />
            <Route path="/kanban" element={<KanbanBoard />} />
            <Route path="/staging" element={<LeadsStaging />} />
            <Route path="/settings/connection" element={<ConnectionPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
