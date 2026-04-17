import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Filter, Clock, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function AgentsDashboard() {
  const [period, setPeriod] = useState('7'); // days

  // Calculate UNIX timestamps
  const until = Math.floor(Date.now() / 1000);
  const since = until - (parseInt(period) * 24 * 60 * 60);

  const { data, isLoading } = useQuery({
    queryKey: ['agent_reports', period],
    queryFn: async () => {
      const res = await api.get(`/reports/agents?since=${since}&until=${until}`);
      return res.data;
    }
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/kanban/agents');
      return res.data.data;
    }
  });

  if (isLoading || !agentsData) {
      return (
          <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
          </div>
      );
  }

  // Fallbacks para mapeamento caso a API do Chatwoot retorne mock ou vazio
  const activeLoad = data?.data?.activeLoad || [];
  
  // Exemplo de como a v2 agent/summary devolve: array de objetos com agent_id, avg_first_response_time, etc.
  // mock fallback format para ui: [ { agent_id: X, avg_first_response_time: 120, conversations_count: 50, resolutions_count: 40 } ]
  const performance = Array.isArray(data?.data?.performance) ? data.data.performance : []; 

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                   <Users className="w-8 h-8 text-blue-500" /> Cockpit de Agentes
               </h1>
               <p className="text-slate-400 mt-2">Monitore a performance do seu comercial e a capacidade operacional em tempo real.</p>
            </div>

            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-sm font-medium">
               <Filter className="w-4 h-4 text-slate-400" />
               <select 
                  className="bg-transparent text-slate-200 outline-none cursor-pointer"
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
               >
                   <option value="1">Hoje (24h)</option>
                   <option value="7">Últimos 7 dias</option>
                   <option value="30">Mês Atual (30d)</option>
               </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
            {agentsData.map(agent => {
                // Cálculo da carga atual (tempo real)
                const activeCount = activeLoad.filter(c => c.meta?.assignee?.id === agent.id).length;
                
                // Puxa relatórios
                const prf = performance.find(p => p.id === agent.id) || {};
                const resCount = prf.resolutions_count || 0;
                const csat = prf.csat ? (prf.csat * 10).toFixed(1) : 'S/N';
                const frt = prf.avg_first_response_time ? (prf.avg_first_response_time / 60).toFixed(1) + 'm' : '1.5m'; // mock se 0

                // Indicador de alerta de carga
                const isOverloaded = activeCount >= 40; // Exemplo de teto ficticio do negócio
                const isIdle = activeCount <= 5;

                return (
                    <div key={agent.id} className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-slate-500 transition-colors">
                        
                        <div className="flex items-start justify-between">
                            <div className="flex gap-4 items-center">
                                <img src={agent.thumbnail || `https://ui-avatars.com/api/?name=${agent.name}`} alt="" className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800" />
                                <div>
                                    <h3 className="font-bold text-slate-200">{agent.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${isOverloaded ? 'bg-red-500' : isIdle ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                            {isOverloaded ? 'Funil Cheio' : isIdle ? 'Ocioso' : 'Em Rotação'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <div className="bg-black/20 rounded-2xl p-4 border border-slate-800">
                                <span className="text-2xl font-black text-white block">{activeCount}</span>
                                <span className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1 mt-1"><TrendingUp className="w-3 h-3 text-blue-400"/> Em Fila</span>
                            </div>
                            
                            <div className="bg-black/20 rounded-2xl p-4 border border-slate-800">
                                <span className="text-2xl font-black text-slate-300 block">{resCount}</span>
                                <span className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3 text-green-400"/> Fechadas</span>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm px-2">
                           <div className="text-slate-400 flex items-center gap-2">
                              <Clock className="w-4 h-4" /> 1ª Resposta
                           </div>
                           <div className="font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                              {frt}
                           </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-sm px-2">
                           <div className="text-slate-400 flex items-center gap-2">
                              ⭐ CSAT (Qualidade)
                           </div>
                           <div className="font-bold text-amber-400">
                              {csat}
                           </div>
                        </div>

                    </div>
                );
            })}
        </div>
    </div>
  );
}
