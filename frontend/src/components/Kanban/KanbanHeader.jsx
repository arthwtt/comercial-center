import React from 'react';
import { RefreshCw, Filter, Clock } from 'lucide-react';

export default function KanbanHeader({ 
  agents = [], 
  selectedAgent, 
  setSelectedAgent, 
  boards = [],
  selectedBoardId,
  setSelectedBoardId,
  refreshInterval, 
  setRefreshInterval, 
  onManualRefresh, 
  isFetching 
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Pipeline de Vendas</h1>
        <p className="text-slate-400 text-sm mt-1">Visualize e gerencie os leads em tempo real</p>
      </div>
      
      <div className="flex flex-wrap items-center gap-3 bg-slate-800/40 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-md">
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-700">
          <select 
            value={selectedBoardId}
            onChange={(e) => setSelectedBoardId(e.target.value)}
            className="bg-transparent text-sm font-bold text-orange-400 outline-none w-36 cursor-pointer"
          >
            {boards.length === 0 && <option value="">Sem Boards</option>}
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-700">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-transparent text-sm text-slate-200 outline-none w-32 cursor-pointer"
          >
            <option value="">Todos Agentes</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-slate-700 mx-1"></div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-700">
          <Clock className="w-4 h-4 text-slate-400" />
          <select 
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
          >
            <option value={15000}>15s (Rápido)</option>
            <option value={30000}>30s (Padrão)</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
            <option value={0}>Manual</option>
          </select>
        </div>

        <button 
          onClick={onManualRefresh}
          className={`p-2 rounded-xl border transition-all ${isFetching ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 cursor-pointer'}`}
          title="Atualizar Agora"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>

      </div>
    </div>
  );
}
