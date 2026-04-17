import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings } from 'lucide-react';

export default function Sidebar() {
  const menu = [
    { name: 'Dashboard M1', path: '/kanban', icon: LayoutDashboard },
    { name: 'Upload & Staging', path: '/staging', icon: Settings },
    { name: 'Conexão M0', path: '/settings/connection', icon: Settings },
  ];

  return (
    <div className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl flex flex-col h-screen sticky top-0 shrink-0">
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
           CC
        </div>
        <span className="font-semibold tracking-wide bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
          Commercial
        </span>
      </div>
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menu.map(item => (
          <NavLink 
            key={item.path}
            to={item.path}
            className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive 
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner overflow-hidden relative' 
                : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'
            }`}
          >
            <item.icon className="w-5 h-5 z-10" />
            <span className="font-medium text-sm z-10">{item.name}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
        Versão SDD 1.1<br/>Read-Only Mode
      </div>
    </div>
  );
}
