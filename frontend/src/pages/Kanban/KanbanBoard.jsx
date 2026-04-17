import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import KanbanHeader from '../../components/Kanban/KanbanHeader';
import KanbanColumn from '../../components/Kanban/KanbanColumn';

export default function KanbanBoard() {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30s by default

  const { data: configData } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await api.get('/config/status');
      return res.data;
    }
  });

  const { data: labelsData } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const res = await api.get('/kanban/labels');
      return res.data.data;
    },
    enabled: !!configData?.active
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/kanban/agents');
      return res.data.data;
    },
    enabled: !!configData?.active
  });

  const { data: conversationsData, isFetching, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      // Chatwoot default is all open instances
      const res = await api.get('/kanban/conversations');
      return res.data.data; 
    },
    enabled: !!configData?.active,
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  if (configData && (!configData.configured || !configData.active)) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
         <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-sm shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-200">Não configurado</h2>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
               O Painel Kanban precisa da conexão ativa do Chatwoot no Módulo 0. Volte ao menu de configurações e defina as chaves de acesso.
            </p>
         </div>
      </div>
    );
  }

  // Filter conversations
  const conversations = conversationsData?.payload || [];
  const filteredConversations = selectedAgent
    ? conversations.filter(c => c.meta?.assignee?.id === Number(selectedAgent))
    : conversations;

  const defaultLabels = [
    { title: 'novo-lead', color: '#4A90E2' },
    { title: 'qualificado', color: '#F5A623' },
    { title: 'proposta', color: '#7B68EE' },
    { title: 'fechado', color: '#2ECC71' },
    { title: 'perdido', color: '#E74C3C' },
  ];

  const boardLabels = labelsData?.payload || [];
  
  const columns = defaultLabels.map(l => {
    const cwLabel = boardLabels.find(bl => bl.title.toLowerCase() === l.title.toLowerCase());
    return {
      title: l.title,
      color: cwLabel?.color || l.color
    }
  });

  return (
    <div className="h-full flex flex-col animate-fade-in relative z-10">
      
      <KanbanHeader 
         agents={agentsData || []}
         selectedAgent={selectedAgent}
         setSelectedAgent={setSelectedAgent}
         refreshInterval={refreshInterval}
         setRefreshInterval={setRefreshInterval}
         onManualRefresh={() => refetch()}
         isFetching={isFetching}
      />
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-5 pb-4 custom-scrollbar">
        {columns.map(col => {
          // Filtragem baseada em substrings ou matches ideiais de label
          const colConversations = filteredConversations.filter(c => c.labels.includes(col.title));
          return (
             <KanbanColumn 
               key={col.title}
               title={col.title}
               color={col.color}
               count={colConversations.length}
               conversations={colConversations}
               baseUrl={configData?.baseURL}
               accountId={configData?.accountId}
             />
          );
        })}
      </div>

    </div>
  );
}
