import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileSpreadsheet, ListFilter, Send, Trash2, Upload, UserPlus, X } from 'lucide-react';
import api from '../../services/api';

function PreviewRow({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
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

function ProgressBar({ value = 0, tone = 'sky' }) {
  const toneClass = tone === 'orange'
    ? 'from-orange-500 to-amber-400'
    : 'from-sky-500 to-cyan-400';

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${toneClass} transition-all duration-300`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function getDispatchStatusLabel(status) {
  switch (status) {
    case 'queued':
      return 'Na fila';
    case 'processing':
      return 'Processando';
    case 'completed':
      return 'Concluido';
    case 'completed_with_errors':
      return 'Concluido com falhas';
    case 'failed':
      return 'Falhou';
    default:
      return 'Indefinido';
  }
}

function getImportStatusLabel(status) {
  switch (status) {
    case 'queued':
      return 'Na fila';
    case 'analyzing':
      return 'Analisando planilha';
    case 'processing':
      return 'Importando';
    case 'completed':
      return 'Concluida';
    case 'failed':
      return 'Falhou';
    default:
      return 'Indefinido';
  }
}

function formatDispatchMessage(dispatch) {
  if (!dispatch) return null;

  const shortId = dispatch.id.slice(0, 8);
  const statusLabel = getDispatchStatusLabel(dispatch.status);
  const processedCount = dispatch.processed_count || 0;
  const leadCount = dispatch.lead_count || 0;
  const successCount = dispatch.success_count || 0;
  const failedCount = dispatch.failed_count || 0;

  return `Lote ${shortId}. Status: ${statusLabel}. Progresso: ${processedCount}/${leadCount}. Resultado: ${successCount} sucesso(s), ${failedCount} falha(s).`;
}

function formatImportMessage(batch) {
  if (!batch) return null;

  const shortId = batch.id.slice(0, 8);
  const statusLabel = getImportStatusLabel(batch.status);
  const locatedCount = batch.located_count || 0;
  const processedCount = batch.processed_count || 0;
  const totalRows = batch.total_rows || 0;
  const insertedCount = batch.inserted_count || 0;
  const skippedCount = batch.skipped_count || 0;
  const ignoredCount = batch.ignored_count || 0;
  const errorMessage = String(batch.error_message || '').trim();

  const baseMessage = `Importacao ${shortId}. Status: ${statusLabel}. Progresso: ${processedCount}/${locatedCount || totalRows || 0}. Localizados: ${locatedCount} lead(s) em ${totalRows} linha(s). Resultado parcial: ${insertedCount} pendente(s), ${skippedCount} duplicado(s), ${ignoredCount} descartado(s).`;

  if (errorMessage) {
    return `${baseMessage} Motivo: ${errorMessage}`;
  }

  return baseMessage;
}

export default function LeadsStaging() {
  const STAGING_PAGE_SIZE = 60;
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [listName, setListName] = useState('');
  const [dispatchAmount, setDispatchAmount] = useState(10);
  const [targetBoard, setTargetBoard] = useState('');
  const [targetStep, setTargetStep] = useState('');
  const [targetAgent, setTargetAgent] = useState('');
  const [priority, setPriority] = useState('high');
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchErrors, setDispatchErrors] = useState([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualData, setManualData] = useState({ name: '', phone: '', email: '' });
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [activeDispatchId, setActiveDispatchId] = useState(null);
  const [activeImportId, setActiveImportId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [stagingPage, setStagingPage] = useState(1);

  const isPolling = Boolean(activeDispatchId || activeImportId);

  const { data: importBatchesData } = useQuery({
    queryKey: ['import-batches'],
    queryFn: async () => {
      const res = await api.get('/leads/import-batches');
      return res.data.data || [];
    },
    refetchInterval: isPolling ? 3000 : false,
  });

  const { data: stagingData } = useQuery({
    queryKey: ['leads_staging', 'pending', selectedBatchId || 'all', stagingPage, STAGING_PAGE_SIZE],
    queryFn: async () => {
      const res = await api.get('/leads/staging', {
        params: {
          status: 'pending',
          page: stagingPage,
          pageSize: STAGING_PAGE_SIZE,
          ...(selectedBatchId ? { batchId: selectedBatchId } : {}),
        },
      });
      return res.data;
    },
    refetchInterval: isPolling ? 3000 : false,
  });

  const { data: boardsData } = useQuery({
    queryKey: ['boards-preview'],
    queryFn: async () => {
      const res = await api.get('/config/boards-preview');
      return res.data.data || [];
    },
  });

  const { data: mappingData } = useQuery({
    queryKey: ['commercial-mapping'],
    queryFn: async () => {
      const res = await api.get('/config/commercial-mapping');
      return res.data.data || {};
    },
  });

  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/kanban/agents');
      return res.data.data;
    },
  });

  const { data: dispatchesData } = useQuery({
    queryKey: ['dispatches'],
    queryFn: async () => {
      const res = await api.get('/dispatches');
      return res.data.data || [];
    },
    refetchInterval: isPolling ? 3000 : false,
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

  useEffect(() => {
    if (selectedBatchId || !importBatchesData?.length) return;

    const newestBatch = importBatchesData[0];
    if (newestBatch) {
      setSelectedBatchId(newestBatch.id);
    }
  }, [importBatchesData, selectedBatchId]);

  useEffect(() => {
    setStagingPage(1);
  }, [selectedBatchId]);

  useEffect(() => {
    if (activeImportId || !importBatchesData?.length) return;

    const runningImport = importBatchesData.find((batch) => ['queued', 'analyzing', 'processing'].includes(batch.status));
    if (runningImport) {
      setActiveImportId(runningImport.id);
    }
  }, [activeImportId, importBatchesData]);

  useEffect(() => {
    if (!activeImportId || !importBatchesData?.length) return;

    const currentImport = importBatchesData.find((batch) => batch.id === activeImportId);
    if (!currentImport) return;

    setUploadStatus(formatImportMessage(currentImport));

    if (!['queued', 'analyzing', 'processing'].includes(currentImport.status)) {
      setActiveImportId(null);
      setSelectedBatchId(currentImport.id);
      setStagingPage(1);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    }
  }, [activeImportId, importBatchesData, queryClient]);

  useEffect(() => {
    if (activeDispatchId || !dispatchesData?.length) return;

    const runningDispatch = dispatchesData.find((dispatch) => ['queued', 'processing'].includes(dispatch.status));
    if (runningDispatch) {
      setActiveDispatchId(runningDispatch.id);
    }
  }, [activeDispatchId, dispatchesData]);

  useEffect(() => {
    if (!activeDispatchId || !dispatchesData?.length) return;

    const currentDispatch = dispatchesData.find((dispatch) => dispatch.id === activeDispatchId);
    if (!currentDispatch) return;

    setDispatchResult(formatDispatchMessage(currentDispatch));
    setDispatchErrors(Array.isArray(currentDispatch.error_details) ? currentDispatch.error_details : []);

    if (!['queued', 'processing'].includes(currentDispatch.status)) {
      setActiveDispatchId(null);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    }
  }, [activeDispatchId, dispatchesData, queryClient]);

  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setFile(null);
      setListName('');
      setUploadStatus(data.message || 'Importacao enfileirada.');
      setActiveImportId(data.batch?.id || null);
      setSelectedBatchId(data.batch?.id || '');
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    },
    onError: (err) => {
      setUploadStatus(`Erro ao importar planilha: ${err.message}`);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/leads/reset', { includeDispatches: true });
      return res.data;
    },
    onSuccess: (data) => {
      setDispatchErrors([]);
      setDispatchResult(null);
      setActiveDispatchId(null);
      setActiveImportId(null);
      setSelectedBatchId('');
      setStagingPage(1);
      setUploadStatus(data.message || 'Staging limpo com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
    },
    onError: (err) => {
      setUploadStatus(`Erro ao limpar staging: ${err.message}`);
    },
  });

  const manualMutation = useMutation({
    mutationFn: async (lead) => {
      const res = await api.post('/leads/manual', lead);
      return res.data;
    },
    onSuccess: (data) => {
      setShowManualForm(false);
      setManualData({ name: '', phone: '', email: '' });
      window.alert(`Inserido manualmente! (${data.data.skipped ? 'Ja existia no Chatwoot' : 'Novo adicionado ao staging'})`);
      queryClient.invalidateQueries({ queryKey: ['leads_staging'] });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/leads/dispatch', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setDispatchErrors([]);
      setDispatchResult(data.message || 'Lote enviado para processamento em segundo plano.');
      setActiveDispatchId(data.dispatch_id);
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
    },
    onError: (err) => {
      setDispatchResult(`Erro critico: ${err.message}`);
      setDispatchErrors([]);
    },
  });

  const handleUpload = () => {
    if (!file) return;

    setUploadStatus('Enfileirando importacao da planilha...');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('clearBeforeImport', String(clearBeforeImport));
    if (listName.trim()) {
      fd.append('listName', listName.trim());
    }
    uploadMutation.mutate(fd);
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      'Isso vai limpar o staging persistido, as importacoes e o historico de lotes. Deseja continuar?'
    );

    if (!confirmed) return;
    resetMutation.mutate();
  };

  const handleDispatch = () => {
    if (!targetBoard || !targetStep || pendingCount === 0) return;

    const exactAmount = Math.max(1, Math.min(Number(dispatchAmount || 1), pendingCount));

    setDispatchErrors([]);
    setDispatchResult('Enfileirando lote para processamento...');
    dispatchMutation.mutate({
      batchId: selectedBatchId || null,
      amount: exactAmount,
      boardId: targetBoard,
      stepId: targetStep,
      assigneeId: targetAgent || null,
      priority,
    });
  };

  const previewLeads = useMemo(() => stagingData?.data || [], [stagingData]);
  const stagingMeta = stagingData?.meta || { page: 1, pageSize: STAGING_PAGE_SIZE, total: 0, totalPages: 1 };
  const pendingCount = stagingMeta.total || 0;
  const currentBoard = boardsData?.find((board) => String(board.id) === String(targetBoard));
  const selectedBatch = importBatchesData?.find((batch) => batch.id === selectedBatchId) || null;
  const pageStart = pendingCount ? ((stagingMeta.page - 1) * stagingMeta.pageSize) + 1 : 0;
  const pageEnd = pendingCount ? Math.min(stagingMeta.page * stagingMeta.pageSize, pendingCount) : 0;

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 p-4 animate-fade-in md:p-8">
      {showManualForm && (
        <div className="absolute right-0 top-0 z-50 w-80 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Lead unitario</h3>
            <button onClick={() => setShowManualForm(false)} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
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
              O backend converte qualquer telefone brasileiro valido para o formato `+5511999999999`.
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

      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Staging & Dispatch</h1>
          <p className="mt-2 text-slate-400">
            Cada planilha agora vira um lote de importacao com progresso proprio e pode ser reutilizada como lista de staging.
          </p>
        </div>
        <button
          onClick={() => setShowManualForm(true)}
          className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm shadow-md transition-all hover:bg-slate-700"
        >
          <UserPlus className="h-4 w-4" />
          Manual Lead
        </button>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 p-6 text-center">
          <FileSpreadsheet className="h-12 w-12 text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Importacao em lote</h3>
            <p className="mt-1 max-w-[260px] text-sm text-slate-500">
              A importacao roda em segundo plano e a tela mostra quantos leads ja foram localizados e processados.
            </p>
          </div>

          <input
            type="text"
            placeholder="Nome da lista de staging"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none"
          />

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
                <Upload className="h-4 w-4" />
                Enviar arquivo
              </button>
            </>
          )}

          <button
            onClick={handleReset}
            disabled={resetMutation.isPending || uploadMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-sm text-rose-100 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Limpar staging
          </button>

          {uploadStatus && (
            <div className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-300">
              <p>{uploadStatus}</p>
              {activeImportId && selectedBatch && (
                <div className="mt-3 space-y-2">
                  <ProgressBar value={selectedBatch.progressPercent || 0} />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{getImportStatusLabel(selectedBatch.status)}</span>
                    <span>{selectedBatch.progressPercent || 0}%</span>
                  </div>
                  {selectedBatch.error_message && (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      {selectedBatch.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl" />

          <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-200">
            <Send className="h-5 w-5 text-orange-400" />
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
            <label className="text-xs font-bold uppercase text-slate-500">3. Assinar responsavel (opcional)</label>
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              disabled={pendingCount === 0}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-slate-200 outline-none"
            >
              <option value="">Round-robin / ninguem</option>
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
              <option value="medium">Media</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          <div className="mb-6 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-sky-100">
            O lote roda em segundo plano. Voce pode acompanhar o progresso e trocar de lista de staging sem perder o estado.
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
            {dispatchMutation.isPending ? 'Enfileirando...' : 'Disparar lote para o funil'}
          </button>

          {dispatchResult && (
            <div className="mt-3 rounded-lg bg-black/20 p-3 text-sm text-slate-300">
              {dispatchResult}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Listas de staging</h2>
            <p className="mt-1 text-sm text-slate-400">
              Cada importacao vira uma lista. Isso ja prepara o fluxo para varias planilhas coexistindo no staging.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedBatchId('');
              setStagingPage(1);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            <ListFilter className="h-4 w-4" />
            Ver todas
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(importBatchesData || []).map((batch) => {
            const isSelected = selectedBatchId === batch.id;
            return (
              <button
                key={batch.id}
                type="button"
                onClick={() => {
                  setSelectedBatchId(batch.id);
                  setStagingPage(1);
                }}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{batch.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{batch.source_file || 'Sem arquivo informado'}</p>
                  </div>
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    {getImportStatusLabel(batch.status)}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <ProgressBar value={batch.progressPercent || 0} />
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{batch.processed_count || 0}/{batch.located_count || 0} importados</span>
                    <span>{batch.progressPercent || 0}%</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <PreviewRow label="Localizados" value={batch.located_count} />
                  <PreviewRow label="Linhas totais" value={batch.total_rows} />
                  <PreviewRow label="Pendentes" value={batch.inserted_count} />
                  <PreviewRow label="Duplicados" value={batch.skipped_count} />
                  <PreviewRow label="Descartados" value={batch.ignored_count} />
                  <PreviewRow label="Leads na lista" value={batch.leadCount} />
                  <PreviewRow label="Criado em" value={new Date(batch.created_at).toLocaleString('pt-BR')} />
                </div>

                {batch.error_message && (
                  <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-rose-200">Motivo da falha</p>
                    <p className="mt-2 text-sm text-rose-100">{batch.error_message}</p>
                  </div>
                )}
              </button>
            );
          })}

          {!(importBatchesData || []).length && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-6 text-center text-sm text-slate-400">
              Nenhuma importacao registrada ainda.
            </div>
          )}
        </div>
      </section>

      {!!dispatchErrors.length && (
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">Falhas do ultimo dispatch</h3>
          <div className="mt-4 space-y-3">
            {dispatchErrors.map((item, index) => (
              <div key={`${item.id || item.reason || 'erro'}-${index}`} className="rounded-xl border border-rose-500/20 bg-slate-950/40 p-3">
                <p className="font-medium text-white">{item.name || 'Erro no lote'}</p>
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
              {selectedBatch
                ? `Exibindo os leads pendentes da lista "${selectedBatch.name}".`
                : 'Exibindo todos os leads pendentes do staging.'}
            </p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200">
            {pendingCount} lead(s)
          </div>
        </div>

        {selectedBatch && (
          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-100">{selectedBatch.name}</p>
                <p className="mt-1 text-xs text-sky-200/80">
                  Localizados: {selectedBatch.located_count || 0} | Pendentes: {selectedBatch.inserted_count || 0} | Duplicados: {selectedBatch.skipped_count || 0}
                </p>
                {selectedBatch.error_message && (
                  <p className="mt-2 text-xs text-rose-200">Falha: {selectedBatch.error_message}</p>
                )}
              </div>
              <div className="min-w-[160px]">
                <ProgressBar value={selectedBatch.progressPercent || 0} tone="sky" />
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previewLeads.map((lead) => (
            <div key={lead.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-lg font-semibold text-white">{lead.name}</p>
              <div className="mt-4 grid gap-3">
                <PreviewRow label="Telefone" value={lead.phone} />
                <PreviewRow label="Email" value={lead.email} />
                <PreviewRow label="CNPJ" value={lead.identifier} />
                <PreviewRow label="Razao social" value={lead.customAttributes?.razao_social} />
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
              Nenhum lead pendente neste staging.
            </div>
          )}
        </div>

        {pendingCount > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-300">
              Mostrando {pageStart}-{pageEnd} de {pendingCount} lead(s).
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStagingPage((current) => Math.max(1, current - 1))}
                disabled={stagingMeta.page <= 1}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-400">
                Pagina {stagingMeta.page} de {stagingMeta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setStagingPage((current) => Math.min(stagingMeta.totalPages, current + 1))}
                disabled={stagingMeta.page >= stagingMeta.totalPages}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Proxima
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Ultimos lotes</h2>
            <p className="mt-1 text-sm text-slate-400">
              Historico basico dos envios processados pelo Commercial Center.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(dispatchesData || []).map((dispatch) => (
            <div key={dispatch.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">Lote {dispatch.id.slice(0, 8)}</p>
              <div className="mt-4 grid gap-3">
                <PreviewRow label="Status" value={getDispatchStatusLabel(dispatch.status)} />
                <PreviewRow label="Progresso" value={`${dispatch.processed_count || 0}/${dispatch.lead_count || 0}`} />
                <PreviewRow label="Sucessos" value={dispatch.success_count} />
                <PreviewRow label="Falhas" value={dispatch.failed_count} />
                <PreviewRow label="Board" value={dispatch.target_board_id} />
                <PreviewRow label="Step" value={dispatch.target_step_id} />
                <PreviewRow label="Agente" value={dispatch.target_agent_id || 'Sem agente fixo'} />
                <PreviewRow label="Criado em" value={new Date(dispatch.created_at).toLocaleString('pt-BR')} />
                <PreviewRow label="Finalizado em" value={dispatch.finished_at ? new Date(dispatch.finished_at).toLocaleString('pt-BR') : null} />
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
            Se vier `404`, normalmente o board ou step nao existe na instancia do Chatwoot usada pelo backend. Se vier `422`,
            normalmente o contato ou a task foi rejeitado por dado invalido ou payload incompatível.
          </p>
        </div>
      </div>
    </div>
  );
}
