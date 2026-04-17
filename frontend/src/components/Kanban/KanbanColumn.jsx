import React from 'react';
import KanbanCard from './KanbanCard';

export default function KanbanColumn({ title, color, count, conversations, baseUrl, accountId }) {
  
  // Map para colors premium dependendo do nome
  const getHeaderTheme = (title) => {
    const t = title.toLowerCase();
    if (t === 'novo-lead') return 'text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-[inset_0px_2px_10px_rgba(59,130,246,0.1)]';
    if (t === 'qualificado') return 'text-orange-400 border-orange-500/30 bg-orange-500/10 shadow-[inset_0px_2px_10px_rgba(249,115,22,0.1)]';
    if (t === 'proposta') return 'text-purple-400 border-purple-500/30 bg-purple-500/10 shadow-[inset_0px_2px_10px_rgba(168,85,247,0.1)]';
    if (t === 'fechado') return 'text-green-400 border-green-500/30 bg-green-500/10 shadow-[inset_0px_2px_10px_rgba(34,197,94,0.1)]';
    if (t === 'perdido') return 'text-rose-400 border-rose-500/30 bg-rose-500/10 shadow-[inset_0px_2px_10px_rgba(244,63,94,0.1)]';
    
    // Fallback nativo
    return 'text-slate-300 border-slate-700 bg-slate-800/50';
  };

  const isDefaultTheme = !['novo-lead', 'qualificado', 'proposta', 'fechado', 'perdido'].includes(title.toLowerCase());

  return (
    <div className="flex-shrink-0 w-[340px] bg-slate-900/40 rounded-3xl flex flex-col h-full border border-slate-800/50 backdrop-blur-md">
      
      <div className={`px-5 py-4 border-b flex items-center justify-between rounded-t-3xl ${getHeaderTheme(title)}`}>
        <h3 className="font-bold tracking-wide flex items-center gap-3">
          {isDefaultTheme && (
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
          )}
          {!isDefaultTheme && (
            <span className="w-2.5 h-2.5 rounded-full bg-current opacity-70"></span>
          )}
          <span style={isDefaultTheme ? { color: color } : {}}>{title.replace('-', ' ').toUpperCase()}</span>
        </h3>
        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-black/20 text-current mix-blend-luminosity">
          {count}
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {conversations.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            <span className="text-2xl mb-2">📥</span>
            Nenhum lead nesta etapa
          </div>
        ) : (
          conversations.map(conv => (
            <KanbanCard 
              key={conv.id} 
              conversation={conv} 
              baseUrl={baseUrl} 
              accountId={accountId} 
            />
          ))
        )}
      </div>
      
    </div>
  );
}
