import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConnectionPage from './pages/Settings/ConnectionPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-blue-500/30">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              CC
            </div>
            <span className="font-semibold tracking-wide">Commercial Center</span>
          </div>
        </header>
        
        <main className="p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Navigate to="/settings/connection" replace />} />
            <Route path="/settings/connection" element={<ConnectionPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
