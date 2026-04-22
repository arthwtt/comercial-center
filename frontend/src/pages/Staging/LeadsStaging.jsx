import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileSpreadsheet, Send, Trash2, Upload, UserPlus, X } from 'lucide-react';
import api from '../../services/api';

function PreviewRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function JsonPreview({ value }) {
  if (!value || !Object.keys(value).length) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bloco empresa</p>
      <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-sky-100">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default function LeadsStaging() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dispatchAmount, setDispatchAmount] = useState(10);
  const [targetBoard, setTargetBoard] = useState('');
  const [targetStep, setTargetStep] = useState('');
  const [targetAgent, setTargetAgent] = useState('');
  const [priority, setPriority] = useState('high');
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchErrors, setDispatchErrors] = useState([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ name: '', phone: '', email: '' });
  const [clearBeforeImport, setClearBeforeImport] = useState(true);

  const { data: stagingData } = useQuery({
    queryKey: ['leads_staging', 'pending'],
    queryFn: async () => {
      const res = await api.get('/leads/staging?status=pending');
      return res.data.data;
    }
  });

  const { data: boardsData } = useQuery({
    queryKey: ['boards-preview'],
    queryFn: async () => {
      const res = await api.get('/config/boards-preview');
      return res.data.data || [];
    }
  });

  const { data: mappingData } = useQuery({
    queryKey: ['commercial-mapping'],
    queryFn: async () => {
      const res = await api.get('/config/commercial-mapping');
      return res.data.data || {};
    }
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/kanban/agents');
      return res.data.data;
    }
  });

  const { data: dispatchesData } = useQuery({
    queryKey: ['dispatches'],
    queryFn: async () => {
      const res = await api.get('/dispatches');
      return res.data.data || [];
    }
  });

  useEffect(() => {
    if (!mappingData) return;
    if (!targetBoard && mappingData.boardId) {
      setTargetBoard(String(mappingData.boardId));
    }
    if (!targetStep && mappingData.stepLeadNovoId) {
      setTargetStep(String(mappingData.stepLeadNovoId));
    }
  }, [mappingData, targetBoard, targetStep]);

  const uploadMutation = useMutation({
    mutationFn: async ({ formData, clearBeforeImport: shouldClearBeforeImport }) => {
      if (shouldClearBeforeImport) {
        await api.post('/leads/reset', { includeDispatches: true });
      }
      const res = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUploadStatus(`Sucesso: ${data.metrics.inserted} lead(s) pendentes e ${data.metrics.skipped} linha(s) ignoradas.`);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
    },
    onError: (err) => {
      setUploadStatus('Erro ao importar planilha: ' + err.message);
    }
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/leads/reset', { includeDispatches: true });
      return res.data;
    },
    onSuccess: (data) => {
      setDispatchErrors([]);
      setDispatchResult(null);
      setUploadStatus(data.message || 'Staging limpo com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    },
    onError: (err) => {
      setUploadStatus('Erro ao limpar staging: ' + err.message);
    }
  });

  const manualMutation = useMutation({
    mutationFn: async (lead) => {
      const res = await api.post('/leads/manual', lead);
      return res.data;
    },
    onSuccess: (data) => {
      setShowManualForm(false);
      setManualData({ name: '', phone: '', email: '' });
      alert(`Inserido manualmente! (${data.data.skipped ? 'Já existia no Chatwoot' : 'Novo adicionado ao staging'})`);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
    }
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/leads/dispatch', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setDispatchErrors(data.errors || []);
      setDispatchResult([
        `Lote ${data.dispatch_id.split('-')[0]} processado com criacao direta no Chatwoot.`,
        data.success_message,
        data.failure_message,
        `Resultado: ${data.metrics.success} sucesso(s), ${data.metrics.failed} falha(s).`
      ].filter(Boolean).join(' '));
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    },
    onError: (err) => {
      setDispatchResult('Erro crítico: ' + err.message);
      setDispatchErrors([]);
    }
  });

  const handleUpload = () => {
    if (!file) return;
    setUploadStatus(
      clearBeforeImport
        ? 'Limpando staging antigo, importando planilha e carregando metadados dos leads...'
        : 'Importando, normalizando telefone e validando duplicatas...'
    );
    const fd = new FormData();
    fd.append('file', file);
    uploadMutation.mutate({ formData: fd, clearBeforeImport });
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      'Isso vai limpar o staging local, os metadados e o histórico de lotes. Deseja continuar?'
    );

    if (!confirmed) return;
    resetMutation.mutate();
  };

  const handleDispatch = () => {
    if (!targetBoard || !targetStep || !stagingData?.length) return;
    const exactAmount = Math.max(1, Math.min(Number(dispatchAmount || 1), stagingData.length));
    const idsToDispatch = stagingData.slice(0, exactAmount).map((lead) => lead.id);
    setDispatchErrors([]);
    setDispatchResult('Iniciando dispatcher...');
    dispatchMutation.mutate({
      leadIds: idsToDispatch,
      boardId: targetBoard,
      stepId: targetStep,
      assigneeId: targetAgent || null,
      priority,
    });
  };

  const pendingCount = stagingData?.length || 0;
  const currentBoard = boardsData?.find((board) => String(board.id) === String(targetBoard));
  const previewLeads = useMemo(() => stagingData || [], [stagingData]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in relative">
      {showManualForm && (
        <div className="absolute top-0 right-0 z-50 w-80 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Lead unitário</h3>
            <button onClick={() => setShowManualForm(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            <input
              placeholder="Nome"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm"
              value={manualData.name}
              onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
            />
            <input
              placeholder="Telefone"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm"
              value={manualData.phone}
              onChange={(e) => setManualData({ ...manualData, phone: e.target.value })}
            />
            <input
              placeholder="Email"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm"
              value={manualData.email}
              onChange={(e) => setManualData({ ...manualData, email: e.target.value })}
            />
            <p className="text-xs text-slate-500">
              O backend converte qualquer telefone brasileiro válido para o formato `+5511999999999`.
            </p>
            <button
              onClick={() => manualMutation.mutate(manualData)}
              className="w-full rounded-lg bg-blue-600 p-2 text-sm font-bold shadow-lg hover:bg-blue-500"
            >
              Salvar direto em staging
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Staging & Dispatch</h1>
          <p className="text-slate-400 mt-2">
            Carregue a base, revise o staging e só então dispare para o Chatwoot.
          </p>
        </div>
        <button
          onClick={() => setShowManualForm(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm shadow-md transition-all hover:bg-slate-700"
        >
          <UserPlus className="w-4 h-4" />
          Manual Lead
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 p-6 text-center">
          <FileSpreadsheet className="w-12 h-12 text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Importação em lote</h3>
            <p className="mt-1 max-w-[260px] text-sm text-slate-500">
              Telefones são normalizados para `+55...`, o nome segue fallback e a base é validada antes de entrar no staging.
            </p>
          </div>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            id="csv-upload"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setUploadStatus('');
              }
            }}
          />
          <label htmlFor="csv-upload" className="cursor-pointer rounded-xl bg-slate-700 px-5 py-2.5 text-white shadow-lg transition-colors hover:bg-slate-600">
            {file ? file.name : 'Localizar .CSV ou .XLSX'}
          </label>

          {file && (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={clearBeforeImport}
                  onChange={(e) => setClearBeforeImport(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                Limpar staging e lotes antes de importar
              </label>

              <button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || resetMutation.isPending}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-medium text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500"
              >
                <Upload className="w-4 h-4" />
                Enviar arquivo
              </button>
            </>
          )}

          <button
            onClick={handleReset}
            disabled={resetMutation.isPending || uploadMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-sm text-rose-100 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Limpar staging
          </button>

          {uploadStatus && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300">
              {uploadStatus}
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
          <div className="absolute top-0 right-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />

          <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-200">
            <Send className="w-5 h-5 text-orange-400" />
            Motor de dispatch direto
          </h3>

          <div className="mb-6 flex items-center gap-4">
            <div className="min-w-[120px] rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center">
              <div className="bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-3xl font-bold text-transparent">
                {pendingCount}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Pendentes</div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total a injetar:</span>
                <span className="font-bold">{Math.min(dispatchAmount, pendingCount)} leads</span>
              </div>
              <input
                type="number"
                min="1"
                max={Math.max(pendingCount, 1)}
                disabled={pendingCount === 0}
                value={Math.min(dispatchAmount, pendingCount)}
                onChange={(e) => setDispatchAmount(Number(e.target.value || 1))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500">1. Board (funil)</label>
              <select
                value={targetBoard}
                onChange={(e) => setTargetBoard(e.target.value)}
                disabled={pendingCount === 0}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200 outline-none"
              >
                <option value="">Selecione...</option>
                {boardsData?.map((board) => (
                  <option key={board.id} value={board.id}>{board.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-500">2. Step (etapa)</label>
              <select
                value={targetStep}
                onChange={(e) => setTargetStep(e.target.value)}
                disabled={!targetBoard || pendingCount === 0}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200 outline-none"
              >
                <option value="">Selecione o board...</option>
                {currentBoard?.steps?.map((step) => (
                  <option key={step.id} value={step.id}>{step.name || `Etapa ${step.position}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="text-xs font-bold uppercase text-slate-500">3. Assinar responsável (opcional)</label>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              disabled={pendingCount === 0}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200 outline-none"
            >
              <option value="">Round-robin / ninguém</option>
              {agentsData?.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="text-xs font-bold uppercase text-slate-500">4. Prioridade da task</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              disabled={pendingCount === 0}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200 outline-none"
            >
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          <div className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-sky-100">
            Cada lead selecionado vira um contato no Chatwoot e, em seguida, uma task no board e step escolhidos acima.
          </div>

          <button
            onClick={handleDispatch}
            disabled={!targetBoard || !targetStep || pendingCount === 0 || dispatchMutation.isPending}
            className={`w-full rounded-xl px-4 py-3 font-bold transition-all ${
              (!targetBoard || !targetStep || pendingCount === 0)
                ? 'cursor-not-allowed border border-slate-700 bg-slate-800 text-slate-500 opacity-50'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:from-orange-400 hover:to-amber-400'
            }`}
          >
            {dispatchMutation.isPending ? 'Despachando...' : 'Disparar lote para o funil'}
          </button>

          {dispatchResult && (
            <div className="mt-3 rounded-lg bg-black/20 p-3 text-sm text-slate-300">
              {dispatchResult}
            </div>
          )}
        </div>
      </div>

      {!!dispatchErrors.length && (
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">Falhas do último dispatch</h3>
          <div className="mt-4 space-y-3">
            {dispatchErrors.map((item) => (
              <div key={item.id} className="rounded-xl border border-rose-500/20 bg-slate-950/40 p-3">
                <p className="font-medium text-white">{item.name}</p>
                <p className="mt-1 text-sm text-rose-200">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Leads no staging</h2>
            <p className="mt-1 text-sm text-slate-400">
              Esta é a prévia do que foi gravado na base antes de subir para o Chatwoot.
            </p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200">
            {previewLeads.length} lead(s)
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previewLeads.map((lead) => (
            <div key={lead.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-lg font-semibold text-white">{lead.name}</p>
              <div className="mt-4 grid gap-3">
                <PreviewRow label="Telefone" value={lead.phone} />
                <PreviewRow label="Email" value={lead.email} />
                <PreviewRow label="CNPJ" value={lead.identifier} />
                <PreviewRow label="Razão social" value={lead.customAttributes?.razao_social} />
                <PreviewRow label="Fantasia" value={lead.customAttributes?.nome_fantasia} />
                <PreviewRow label="Cidade / UF" value={[lead.customAttributes?.cidade, lead.customAttributes?.uf].filter(Boolean).join(' / ')} />
                <PreviewRow label="Ramo" value={lead.customAttributes?.ramo_principal} />
                <PreviewRow label="Porte" value={lead.customAttributes?.porte_empresa} />
                <JsonPreview value={lead.company || lead.customAttributes} />
              </div>
            </div>
          ))}

          {!previewLeads.length && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-6 text-center text-sm text-slate-400">
              Nenhum lead pendente no staging.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Últimos lotes</h2>
            <p className="mt-1 text-sm text-slate-400">
              Histórico básico dos envios processados pelo Commercial Center.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(dispatchesData || []).map((dispatch) => (
            <div key={dispatch.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">Lote {dispatch.id.slice(0, 8)}</p>
              <div className="mt-4 grid gap-3">
                <PreviewRow label="Leads" value={dispatch.lead_count} />
                <PreviewRow label="Board" value={dispatch.target_board_id} />
                <PreviewRow label="Agente" value={dispatch.target_agent_id || 'Sem agente fixo'} />
                <PreviewRow label="Criado em" value={new Date(dispatch.created_at).toLocaleString('pt-BR')} />
              </div>
            </div>
          ))}

          {!(dispatchesData || []).length && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-6 text-center text-sm text-slate-400">
              Nenhum lote registrado ainda.
            </div>
          )}
        </div>
      </section>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p>
            Se vier `404`, normalmente o board/step não existe na instância do Chatwoot usada pelo backend. Se vier `422`,
            normalmente o contato ou a task foi rejeitado por dado inválido ou payload incompatível.
          </p>
        </div>
      </div>
    </div>
  );
}
