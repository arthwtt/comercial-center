import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Flag,
  Key,
  Play,
  Save,
  Server,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import api from '../../services/api';

const TOKEN_MASK = '••••••••••••••••';

const EMPTY_CONNECTION = {
  baseURL: '',
  accountId: '',
  token: '',
  defaultInboxId: '',
};

const EMPTY_MAPPING = {
  boardId: '',
  stepLeadNovoId: '',
  stepQualificadoId: '',
  stepReuniaoAgendadaId: '',
  stepReuniaoRealizadaId: '',
  stepPropostaEnviadaId: '',
  stepVendaFechadaId: '',
  stepPerdidoId: '',
  businessHoursEnabled: true,
  overloadThreshold: 25,
  idleThreshold: 2,
};

const STEP_FIELDS = [
  { name: 'stepLeadNovoId', label: 'Lead novo' },
  { name: 'stepQualificadoId', label: 'Lead qualificado' },
  { name: 'stepReuniaoAgendadaId', label: 'Reunião agendada' },
  { name: 'stepReuniaoRealizadaId', label: 'Reunião realizada' },
  { name: 'stepPropostaEnviadaId', label: 'Proposta enviada' },
  { name: 'stepVendaFechadaId', label: 'Venda fechada' },
  { name: 'stepPerdidoId', label: 'Perdido' },
];

export default function ConnectionPage() {
  const [formData, setFormData] = useState(EMPTY_CONNECTION);
  const [loadedConnection, setLoadedConnection] = useState(EMPTY_CONNECTION);
  const [mapping, setMapping] = useState(EMPTY_MAPPING);
  const [boards, setBoards] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [agents, setAgents] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentConnection, setCurrentConnection] = useState(null);

  useEffect(() => {
    loadScreenData();
  }, []);

  const loadScreenData = async () => {
    await Promise.all([checkCurrentStatus(), loadMapping()]);
  };

  const checkCurrentStatus = async () => {
    try {
      const res = await api.get('/config/status');
      if (!res.data.configured) {
        setCurrentConnection('none');
        setLoadedConnection(EMPTY_CONNECTION);
        return;
      }

      if (res.data.active) {
        const nextConnection = {
          baseURL: String(res.data.baseURL || ''),
          accountId: String(res.data.accountId || ''),
          token: TOKEN_MASK,
          defaultInboxId: String(res.data.defaultInboxId || ''),
        };

        setCurrentConnection('active');
        setFormData(nextConnection);
        setLoadedConnection(nextConnection);
        setStatus('success');
        setErrorMsg('');
        await loadBoards();
        return;
      }

      setCurrentConnection('error');
    } catch (_error) {
      setCurrentConnection('error');
    }
  };

  const loadMapping = async () => {
    try {
      const res = await api.get('/config/commercial-mapping');
      setMapping({ ...EMPTY_MAPPING, ...res.data.data });
    } catch (_error) {
      setMapping(EMPTY_MAPPING);
    }
  };

  const loadBoards = async () => {
    try {
      const res = await api.get('/config/boards-preview');
      setBoards(res.data.data || []);
    } catch (_error) {
      setBoards([]);
    }
  };

  const selectedBoard = useMemo(
    () => boards.find((board) => String(board.id) === String(mapping.boardId)),
    [boards, mapping.boardId]
  );

  const availableSteps = selectedBoard?.steps || [];
  const isMaskedToken = formData.token === TOKEN_MASK;
  const credentialsChanged = (
    formData.baseURL !== loadedConnection.baseURL ||
    formData.accountId !== loadedConnection.accountId ||
    (!isMaskedToken && formData.token !== '')
  );
  const onlyInboxChanged = (
    currentConnection === 'active' &&
    !credentialsChanged &&
    formData.defaultInboxId !== loadedConnection.defaultInboxId
  );
  const canSaveConnection = status === 'success' || onlyInboxChanged;
  const canSaveAnything = Boolean(mapping.boardId) || canSaveConnection || currentConnection === 'active';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'defaultInboxId' && currentConnection === 'active' && !credentialsChanged) {
      setErrorMsg('');
      return;
    }

    setStatus('idle');
  };

  const handleMappingChange = (event) => {
    const { name, value, type, checked } = event.target;
    setMapping((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleBoardChange = (event) => {
    const boardId = event.target.value;
    setMapping((prev) => ({
      ...prev,
      boardId,
      stepLeadNovoId: '',
      stepQualificadoId: '',
      stepReuniaoAgendadaId: '',
      stepReuniaoRealizadaId: '',
      stepPropostaEnviadaId: '',
      stepVendaFechadaId: '',
      stepPerdidoId: '',
    }));
  };

  const handleTest = async () => {
    const unchangedMaskedConnection = (
      currentConnection === 'active' &&
      isMaskedToken &&
      formData.baseURL === loadedConnection.baseURL &&
      formData.accountId === loadedConnection.accountId
    );

    if (unchangedMaskedConnection) {
      setStatus('success');
      setErrorMsg('');
      await loadBoards();
      return;
    }

    if (!formData.baseURL || !formData.accountId || !formData.token || isMaskedToken) {
      setErrorMsg('Informe o token real para testar alterações de conexão.');
      setStatus('error');
      return;
    }

    setStatus('testing');
    setErrorMsg('');
    try {
      const res = await api.post('/config/test', formData);
      setAgents(res.data.agents || []);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || err.message);
    }
  };

  const handleSave = async () => {
    if (!canSaveConnection && credentialsChanged) {
      setErrorMsg('Teste a conexão com o token real antes de salvar alterações de credenciais.');
      setStatus('error');
      return;
    }

    setIsSaving(true);
    try {
      if (canSaveConnection) {
        const connectionPayload = {
          baseURL: formData.baseURL,
          accountId: formData.accountId,
          defaultInboxId: formData.defaultInboxId,
        };

        if (!isMaskedToken && formData.token) {
          connectionPayload.token = formData.token;
        }

        await api.post('/config/save', connectionPayload);
      }

      await api.post('/config/commercial-mapping', mapping);
      await loadScreenData();
      alert('Conexão e mapeamento comercial atualizados.');
    } catch (_err) {
      alert('Erro ao salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-sky-300 to-cyan-500 bg-clip-text text-3xl font-bold text-transparent">
            Configuração do Commercial Center
          </h1>
          <p className="mt-2 text-slate-400">
            Primeiro conecte o Chatwoot. Depois mapeie o board e os steps que definem reunião, proposta e venda.
          </p>
        </div>

        {currentConnection === 'active' && (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            <CheckCircle className="h-5 w-5" />
            Conexão ativa
          </div>
        )}
        {currentConnection === 'error' && (
          <div className="flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            <Unplug className="h-5 w-5" />
            Falha de conexão
          </div>
        )}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">Conexão Chatwoot</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <Server className="h-4 w-4 text-sky-400" />
                Base URL
              </span>
              <input
                type="url"
                name="baseURL"
                value={formData.baseURL}
                onChange={handleChange}
                placeholder="https://app.chatwoot.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-sky-500"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                Account ID
              </span>
              <input
                type="number"
                name="accountId"
                value={formData.accountId}
                onChange={handleChange}
                placeholder="1"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-cyan-500"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <Key className="h-4 w-4 text-amber-400" />
                API Access Token
              </span>
              <input
                type="password"
                name="token"
                value={formData.token}
                onChange={handleChange}
                placeholder="Profile Settings > Access Token"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-amber-500"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <Flag className="h-4 w-4 text-emerald-400" />
                Default Inbox ID
              </span>
              <input
                type="number"
                name="defaultInboxId"
                value={formData.defaultInboxId}
                onChange={handleChange}
                placeholder="2"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-emerald-500"
              />
            </label>
          </div>

          {status === 'error' && (
            <div className="mt-6 flex gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <CheckCircle className="h-5 w-5" />
                Conexão validada
              </p>
              <p className="mt-2 text-sm text-slate-400">Agentes encontrados: {agents.length}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={status === 'testing'}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
            >
              {status === 'testing' ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Testar conexão
            </button>
            <button
              type="button"
              onClick={loadBoards}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              <Flag className="h-4 w-4" />
              Recarregar boards
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-700/60 bg-slate-900/70 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white">Mapeamento comercial</h2>
          <p className="mt-2 text-sm text-slate-400">
            Esse mapeamento diz ao sistema quais steps contam como reunião, proposta, venda e perda.
          </p>

          <div className="mt-6 grid gap-5">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Board principal</span>
              <select
                name="boardId"
                value={mapping.boardId}
                onChange={handleBoardChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-sky-500"
              >
                <option value="">Selecione um board</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              {STEP_FIELDS.map((field) => (
                <label key={field.name} className="space-y-2">
                  <span className="text-sm text-slate-300">{field.label}</span>
                  <select
                    name={field.name}
                    value={mapping[field.name]}
                    onChange={handleMappingChange}
                    disabled={!mapping.boardId}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-cyan-500 disabled:opacity-50"
                  >
                    <option value="">Não mapear</option>
                    {availableSteps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Limite de sobrecarga</span>
                <input
                  type="number"
                  name="overloadThreshold"
                  value={mapping.overloadThreshold}
                  onChange={handleMappingChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-amber-500"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Limite de ociosidade</span>
                <input
                  type="number"
                  name="idleThreshold"
                  value={mapping.idleThreshold}
                  onChange={handleMappingChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-200 outline-none transition focus:border-amber-500"
                />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                name="businessHoursEnabled"
                checked={mapping.businessHoursEnabled}
                onChange={handleMappingChange}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              Usar `business_hours=true` na leitura de performance
            </label>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !canSaveAnything}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
