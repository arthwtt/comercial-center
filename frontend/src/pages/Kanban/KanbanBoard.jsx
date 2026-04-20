import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import KanbanHeader from '../../components/Kanban/KanbanHeader';
import KanbanColumn from '../../components/Kanban/KanbanColumn';

export default function KanbanBoard() {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30s by default

  const { data: configData } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await api.get('/config/status');
      return res.data;
    }
  });

  const { data: boardsData } = useQuery({
    queryKey: ['system_boards'],
    queryFn: async () => {
      const res = await api.get('/boards');
      return res.data.data;
    }
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/kanban/agents');
      return res.data.data;
    },
    enabled: !!configData?.active
  });

  // Autoselect first board if none selected
  if (boardsData && boardsData.length > 0 && !selectedBoardId) {
     setSelectedBoardId(boardsData[0].id.toString());
  }

  const { data: tasksData, isFetching, refetch } = useQuery({
    queryKey: ['tasks', selectedBoardId],
    queryFn: async () => {
      const res = await api.get(`/kanban/tasks?board_id=${selectedBoardId}`);
      return res.data.data; 
    },
    enabled: !!configData?.active && !!selectedBoardId,
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });

  if (configData && (!configData.configured || !configData.active)) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
         <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold text-slate-200">Não configurado</h2>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
               Conecte o Chatwoot no Módulo 0.
            </p>
         </div>
      </div>
    );
  }

  // Filter tasks
  const tasks = tasksData || [];
  const filteredTasks = selectedAgent
    ? tasks.filter(t => t.assigned_agents?.some(a => a.id === Number(selectedAgent)))
    : tasks;

  const currentBoard = boardsData?.find(b => b.id.toString() === selectedBoardId);
  const steps = currentBoard?.steps || [];

  return (
    <div className="h-full flex flex-col animate-fade-in relative z-10">
      
      <KanbanHeader 
         agents={agentsData || []}
         selectedAgent={selectedAgent}
         setSelectedAgent={setSelectedAgent}
         boards={boardsData || []}
         selectedBoardId={selectedBoardId}
         setSelectedBoardId={setSelectedBoardId}
         refreshInterval={refreshInterval}
         setRefreshInterval={setRefreshInterval}
         onManualRefresh={() => refetch()}
         isFetching={isFetching}
      />
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-5 pb-4 custom-scrollbar px-6 mt-4">
        {steps.map(step => {
          const stepTasks = filteredTasks.filter(t => t.board_step_id === step.id);
          return (
             <KanbanColumn 
               key={step.id}
               title={step.name}
               color={step.color || '#475569'}
               count={stepTasks.length}
               conversations={stepTasks} // reusando a variavel mas passando tasks
               baseUrl={configData?.baseURL}
               accountId={configData?.accountId}
             />
          );
        })}
      </div>

    </div>
  );
}
