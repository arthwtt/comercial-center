import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, AlertTriangle, Send, UserPlus, X } from 'lucide-react';
import api from '../../services/api';

export default function LeadsStaging() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Dispatch State
  const [dispatchAmount, setDispatchAmount] = useState(10);
  const [targetBoard, setTargetBoard] = useState('');
  const [targetStep, setTargetStep] = useState('');
  const [targetAgent, setTargetAgent] = useState('');
  const [dispatchResult, setDispatchResult] = useState(null);

  // Manual Input State
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ name: '', phone: '', email: '' });

  // Data Fetching
  const { data: stagingData, isLoading: isLoadingStaging } = useQuery({
    queryKey: ['leads_staging', 'pending'],
    queryFn: async () => {
      const res = await api.get('/leads/staging?status=pending');
      return res.data.data;
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
    }
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUploadStatus(`Sucesso! ${data.metrics.inserted} novos gerados, ${data.metrics.skipped} duplicatas ignoradas.`);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
    },
    onError: (err) => {
      setUploadStatus('Erro ao importar CSV: ' + err.message);
    }
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/leads/dispatch', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setDispatchResult(`Lote ${data.dispatch_id.split('-')[0]} Disparado! ${data.metrics.success} sucessos, ${data.metrics.failed} falhas.`);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
    },
    onError: (err) => {
      setDispatchResult('Erro crítico: ' + err.message);
    }
  });

  // Simulating manual adding using the same route or a mocked one. 
  // Wait, I didn't create a specific POST /api/leads/manual endpoint. 
  // Let's create a fake CSV structure blob to upload so we resuse the POST /import route elegantly!
  const manualMutation = useMutation({
     mutationFn: async (lead) => {
        const csvContent = `name,email,phone\n${lead.name},${lead.email},${lead.phone}`;
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const dummyFile = new File([blob], "manual.csv", { type: 'text/csv' });
        const fd = new FormData();
        fd.append('file', dummyFile);
        const res = await api.post('/leads/import', fd, {
           headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
     },
     onSuccess: (data) => {
        setShowManualForm(false);
        setManualData({ name: '', phone: '', email: '' });
        alert(`Inserido manualmente! (${data.metrics.skipped > 0 ? 'Já Existia' : 'Novo Adicionado'})`);
        queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
     }
  });

  const handleUpload = () => {
      if(!file) return;
      setUploadStatus('Importando Base e Filtrando Duplicatas...');
      const fd = new FormData();
      fd.append('file', file);
      uploadMutation.mutate(fd);
  };

  const handleDispatch = () => {
      if (!targetBoard || !targetStep || !stagingData) return;
      const idsToDispatch = stagingData.slice(0, dispatchAmount).map(l => l.id);
      
      setDispatchResult('Iniciando Dispatcher...');
      dispatchMutation.mutate({
          leadIds: idsToDispatch,
          boardId: targetBoard,
          stepId: targetStep,
          assigneeId: targetAgent || null
      });
  };

  const pendingCount = stagingData?.length || 0;
  const currentBoard = boardsData?.find(b => b.id === targetBoard);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative">
      
      {showManualForm && (
         <div className="absolute top-0 right-0 z-50 bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-80">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold">Lead Unitário</h3>
               <button onClick={() => setShowManualForm(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-4">
               <input placeholder="Nome" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" value={manualData.name} onChange={e=>setManualData({...manualData, name: e.target.value})} />
               <input placeholder="Telefone" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" value={manualData.phone} onChange={e=>setManualData({...manualData, phone: e.target.value})} />
               <input placeholder="Email" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm" value={manualData.email} onChange={e=>setManualData({...manualData, email: e.target.value})} />
               <button onClick={() => manualMutation.mutate(manualData)} className="w-full bg-blue-600 hover:bg-blue-500 font-bold p-2 text-sm rounded-lg shadow-lg">Salvar Direto em Staging</button>
            </div>
         </div>
      )}

      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-white">Staging & Dispatch</h1>
           <p className="text-slate-400 mt-2">Armazene leads com segurança no PostgreSQL antes de injetar nas cadências.</p>
        </div>
        <button onClick={() => setShowManualForm(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-xl text-sm transition-all shadow-md">
           <UserPlus className="w-4 h-4"/> Manual Lead
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
          
        {/* Upload Panel */}
        <div className="bg-slate-800/40 p-6 rounded-2xl border border-dashed border-slate-600 flex flex-col items-center justify-center text-center space-y-4">
           <FileSpreadsheet className="w-12 h-12 text-blue-400" />
           <div>
               <h3 className="font-semibold text-lg text-slate-200">Importação em Lote</h3>
               <p className="text-sm text-slate-500 max-w-[200px] mt-1">Nós cruzamos automaticamente contra duplicatas do Fazer.ai via Busca.</p>
           </div>
           
           <input 
              type="file" 
              accept=".csv"
              id="csv-upload"
              className="hidden"
              onChange={(e) => {
                  if(e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]); setUploadStatus('');
                  }
              }}
           />
           <label 
              htmlFor="csv-upload" 
              className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-lg"
            >
              {file ? file.name : "Localizar .CSV"}
           </label>

           {file && (
             <button 
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
              >
                <Upload className="w-4 h-4" /> Enviar Arquivo
             </button>
           )}

           {uploadStatus && (
               <div className="text-sm px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300">
                   {uploadStatus}
               </div>
           )}
        </div>

        {/* Dispatch Panel */}
        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl -mr-10 -mt-10 rounded-full"></div>
            
            <h3 className="font-semibold text-lg text-slate-200 mb-6 flex items-center gap-2">
                <Send className="w-5 h-5 text-orange-400" /> 
                Motor de Dispatch
            </h3>
            
            <div className="flex items-center gap-4 mb-6">
                <div className="bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl min-w-[120px] text-center">
                    <div className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                        {pendingCount}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mt-1">Validados</div>
                </div>
                
                <div className="flex-1 space-y-2">
                   <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Total a injetar:</span>
                      <span className="font-bold">{Math.min(dispatchAmount, pendingCount)} leads</span>
                   </div>
                   <input type="range" min="1" max={Math.max(pendingCount, 1)} disabled={pendingCount === 0} value={Math.min(dispatchAmount, pendingCount)} onChange={e => setDispatchAmount(Number(e.target.value))} className="w-full accent-orange-500 cursor-pointer" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">1. Board (Funil)</label>
                  <select value={targetBoard} onChange={e => setTargetBoard(e.target.value)} disabled={pendingCount === 0} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none">
                     <option value="">Selecione...</option>
                     {boardsData?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">2. Step (Etapa)</label>
                  <select value={targetStep} onChange={e => setTargetStep(e.target.value)} disabled={!targetBoard || pendingCount === 0} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none">
                     <option value="">Selecione o board...</option>
                     {currentBoard?.steps?.map(s => <option key={s.id} value={s.id}>{s.name || `Etapa ${s.position}`}</option>)}
                  </select>
                </div>
            </div>

            <div className="mb-6">
               <label className="text-xs font-bold text-slate-500 uppercase">3. Assinar Responsável (Opcional)</label>
               <select value={targetAgent} onChange={e => setTargetAgent(e.target.value)} disabled={pendingCount === 0} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-200 outline-none">
                  <option value="">Round-Robin / Ninguém</option>
                  {agentsData?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
               </select>
            </div>

            <button 
               onClick={handleDispatch}
               disabled={!targetBoard || !targetStep || pendingCount === 0 || dispatchMutation.isPending}
               className={`w-full font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  (!targetBoard || !targetStep || pendingCount === 0) ? 'bg-slate-800 text-slate-500 border border-slate-700 opacity-50 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/20'
               }`}
            >
               {dispatchMutation.isPending ? <span className="animate-pulse">Despachando...</span> : <><Send className="w-4 h-4" /> Disparar para Servidor Principal</>}
            </button>
            
            {dispatchResult && (
               <div className="text-xs text-center mt-3 text-slate-400 font-medium bg-black/20 p-2 rounded-lg">
                   {dispatchResult}
               </div>
            )}
        </div>
      </div>

    </div>
  );
}
