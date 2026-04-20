import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../services/api';

const PERIODS = [
  { value: '1', label: 'Hoje' },
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
];

function formatSeconds(value) {
  const seconds = Number(value || 0);
  if (!seconds) {
    return 'Sem dado';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${(seconds / 60).toFixed(1)}m`;
  }
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function normalizeAvailability(status) {
  const value = String(status || 'offline').toLowerCase();
  if (value === 'available') {
    return 'online';
  }
  return value;
}

function getStatusClasses(status) {
  const normalized = normalizeAvailability(status);
  if (normalized === 'online') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'busy') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
  return 'border-slate-700 bg-slate-800/60 text-slate-300';
}

function getLoadClasses(status) {
  if (status === 'critical') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  }
  if (status === 'attention') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
  if (status === 'idle') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-200';
  }
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
}

function KpiCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{helper}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
          <Icon className="h-5 w-5 text-sky-300" />
        </div>
      </div>
    </div>
  );
}

export default function AgentsDashboard() {
  const [period, setPeriod] = useState('7');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedInboxId, setSelectedInboxId] = useState('');
  const [selectedStepId, setSelectedStepId] = useState('');
  const [search, setSearch] = useState('');
  const until = Math.floor(Date.now() / 1000);
  const since = until - (parseInt(period, 10) * 24 * 60 * 60);

  const { data: configData } = useQuery({
    queryKey: ['config-status'],
    queryFn: async () => {
      const res = await api.get('/config/status');
      return res.data;
    }
  });

  const { data: mappingData } = useQuery({
    queryKey: ['commercial-mapping'],
    queryFn: async () => {
      const res = await api.get('/config/commercial-mapping');
      return res.data.data;
    }
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      since: String(since),
      until: String(until),
    });

    if (selectedAgentId) {
      params.set('agentId', selectedAgentId);
    }
    if (selectedInboxId) {
      params.set('inboxId', selectedInboxId);
    }
    if (selectedStepId) {
      params.set('stepId', selectedStepId);
    }
    if (search.trim()) {
      params.set('search', search.trim());
    }

    return params.toString();
  }, [search, selectedAgentId, selectedInboxId, selectedStepId, since, until]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['commercial-dashboard', period, selectedAgentId, selectedInboxId, selectedStepId, search],
    queryFn: async () => {
      const res = await api.get(`/reports/commercial/dashboard?${queryString}`);
      return res.data.data;
    },
    enabled: !!configData?.active,
    refetchInterval: 60000,
  });

  if (configData && (!configData.configured || !configData.active)) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-lg rounded-[32px] border border-slate-800 bg-slate-900/80 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Chatwoot não configurado</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Antes do dashboard comercial, valide a conexão na tela de configuração.
          </p>
        </div>
      </div>
    );
  }

  if (mappingData && !mappingData.boardId) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-xl rounded-[32px] border border-slate-800 bg-slate-900/80 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Mapeamento comercial pendente</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Defina o board principal e os steps de reunião, proposta e venda fechada para liberar o dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const agents = data?.agents || [];
  const tasksByStage = data?.tasksByStage || [];
  const tasks = data?.tasks || [];
  const filterOptions = data?.filterOptions || { agents: [], inboxes: [], steps: [] };
  const hasActiveFilters = Boolean(selectedAgentId || selectedInboxId || selectedStepId || search.trim());

  const clearFilters = () => {
    setSelectedAgentId('');
    setSelectedInboxId('');
    setSelectedStepId('');
    setSearch('');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-[36px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.20),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 shadow-[0_30px_120px_rgba(2,6,23,0.45)] md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-sky-200">
              <Target className="h-3.5 w-3.5" />
              Central de gestores
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Dashboard comercial por vendedor
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Agora com filtros por agente, inbox e step, além de drill-down de tasks para cobrança e auditoria do funil.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
            >
              {PERIODS.map((item) => (
                <option key={item.value} value={item.value} className="bg-slate-950">
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 transition hover:border-slate-500"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Filtros operacionais</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Refinar leitura do dashboard</h2>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar task, contato, label ou agente"
              className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Agente</span>
            <select
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              className="mt-2 w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              <option value="" className="bg-slate-950">Todos</option>
              {filterOptions.agents.map((agent) => (
                <option key={agent.id} value={agent.id} className="bg-slate-950">
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Inbox</span>
            <select
              value={selectedInboxId}
              onChange={(event) => setSelectedInboxId(event.target.value)}
              className="mt-2 w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              <option value="" className="bg-slate-950">Todas</option>
              {filterOptions.inboxes.map((inbox) => (
                <option key={inbox.id} value={inbox.id} className="bg-slate-950">
                  {inbox.name}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Step</span>
            <select
              value={selectedStepId}
              onChange={(event) => setSelectedStepId(event.target.value)}
              className="mt-2 w-full bg-transparent text-sm text-slate-100 outline-none"
            >
              <option value="" className="bg-slate-950">Todos</option>
              {filterOptions.steps.map((step) => (
                <option key={step.id} value={step.id} className="bg-slate-950">
                  {step.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={CalendarCheck2}
          label="Reuniões agendadas"
          value={summary.meetingsScheduled || 0}
          helper={`${summary.meetingsDone || 0} realizadas no step mapeado`}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Vendas fechadas"
          value={summary.wonCount || 0}
          helper={`${summary.lostCount || 0} perdidas na visão atual`}
        />
        <KpiCard
          icon={Wallet}
          label="Pipeline filtrado"
          value={formatMoney(summary.pipelineValue)}
          helper={`Ponderado: ${formatMoney(summary.weightedPipelineValue)}`}
        />
        <KpiCard
          icon={MessageSquare}
          label="Tasks visíveis"
          value={summary.totalTasks || 0}
          helper={`${summary.openConversations || 0} conversas abertas associadas`}
        />
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Visão do pipeline</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Tasks por step</h2>
            </div>
            <TrendingUp className="h-5 w-5 text-sky-300" />
          </div>

          <div className="mt-6 space-y-3">
            {tasksByStage.length ? tasksByStage.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStepId(stage.id)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-left transition hover:border-sky-500/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{stage.name}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {stage.count} task(s) • {formatMoney(stage.value)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm text-slate-400">Ponderado</p>
                      <p className="font-medium text-white">{formatMoney(stage.weightedValue)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 p-4 text-sm text-slate-400">
                Nenhuma task encontrada no board configurado.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cobrança por vendedor</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Performance por agente</h2>
            </div>
            <Users className="h-5 w-5 text-sky-300" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
            <div className="hidden grid-cols-[1.8fr_repeat(6,1fr)] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-slate-500 lg:grid">
              <span>Agente</span>
              <span>Tasks</span>
              <span>Reuniões</span>
              <span>Vendas</span>
              <span>Pipeline</span>
              <span>Operação</span>
              <span>Tempo</span>
            </div>

            <div className="divide-y divide-slate-800">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(String(agent.id))}
                  className="grid w-full gap-4 bg-slate-950/35 px-4 py-4 text-left transition hover:bg-slate-950/60 lg:grid-cols-[1.8fr_repeat(6,1fr)] lg:items-center"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={agent.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=0f172a&color=f8fafc`}
                      alt=""
                      className="h-12 w-12 rounded-2xl border border-white/10 bg-slate-900 object-cover"
                    />
                    <div>
                      <p className="font-medium text-white">{agent.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs ${getStatusClasses(agent.availabilityStatus)}`}>
                          {normalizeAvailability(agent.availabilityStatus)}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-xs ${getLoadClasses(agent.loadStatus)}`}>
                          {agent.loadStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 lg:hidden">Tasks</p>
                    <p className="font-medium text-white">{agent.taskCount}</p>
                    <p className="text-xs text-slate-500">{agent.openConversations} abertas</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 lg:hidden">Reuniões</p>
                    <p className="font-medium text-white">{agent.meetingsScheduled}</p>
                    <p className="text-xs text-slate-500">{agent.meetingsDone} realizadas</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 lg:hidden">Vendas</p>
                    <p className="font-medium text-white">{agent.wonCount}</p>
                    <p className="text-xs text-slate-500">{agent.conversionRate.toFixed(1)}% conversão</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 lg:hidden">Pipeline</p>
                    <p className="font-medium text-white">{formatMoney(agent.pipelineValue)}</p>
                    <p className="text-xs text-slate-500">{formatMoney(agent.weightedPipelineValue)} ponderado</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 lg:hidden">Operação</p>
                    <p className="font-medium text-white">{agent.conversationsCount} convs</p>
                    <p className="text-xs text-slate-500">{agent.resolvedConversationsCount} resolvidas</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 lg:hidden">Tempo</p>
                    <p className="font-medium text-white">{formatSeconds(agent.avgFirstResponseTimeSeconds)}</p>
                    <p className="text-xs text-slate-500">
                      <Clock3 className="mr-1 inline h-3 w-3" />
                      reply {formatSeconds(agent.avgReplyTimeSeconds)}
                    </p>
                  </div>
                </button>
              ))}

              {!agents.length && (
                <div className="px-4 py-10 text-center text-sm text-slate-400">
                  Nenhum agente encontrado para a visão atual.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[32px] border border-slate-800 bg-slate-900/80 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Drill-down comercial</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Tasks da visão atual</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Filter className="h-4 w-4" />
            {tasks.length} task(s) listadas
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
          <div className="hidden grid-cols-[1.7fr_1fr_1fr_1fr_0.9fr] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-slate-500 lg:grid">
            <span>Task</span>
            <span>Step</span>
            <span>Agente</span>
            <span>Inbox</span>
            <span>Valor</span>
          </div>
          <div className="divide-y divide-slate-800">
            {tasks.map((task) => (
              <div key={task.id} className="grid gap-4 bg-slate-950/35 px-4 py-4 lg:grid-cols-[1.7fr_1fr_1fr_1fr_0.9fr] lg:items-center">
                <div>
                  <p className="font-medium text-white">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {(task.contactNames || []).join(', ') || 'Sem contato associado'}
                  </p>
                  {!!task.labels?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {task.labels.slice(0, 3).map((label) => (
                        <span key={label} className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm text-slate-400 lg:hidden">Step</p>
                  <button
                    type="button"
                    onClick={() => setSelectedStepId(task.boardStepId)}
                    className="font-medium text-sky-300 transition hover:text-sky-200"
                  >
                    {task.boardStepName}
                  </button>
                </div>

                <div>
                  <p className="text-sm text-slate-400 lg:hidden">Agente</p>
                  {task.assignedAgents.length ? task.assignedAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(String(agent.id))}
                      className="mr-2 inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 transition hover:border-sky-500/30"
                    >
                      {agent.name}
                    </button>
                  )) : <span className="text-sm text-slate-500">Sem agente</span>}
                </div>

                <div>
                  <p className="text-sm text-slate-400 lg:hidden">Inbox</p>
                  {task.inbox ? (
                    <button
                      type="button"
                      onClick={() => setSelectedInboxId(String(task.inbox.id))}
                      className="text-sm text-slate-200 transition hover:text-sky-300"
                    >
                      {task.inbox.name}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-500">Sem inbox</span>
                  )}
                </div>

                <div>
                  <p className="text-sm text-slate-400 lg:hidden">Valor</p>
                  <p className="font-medium text-white">{formatMoney(task.value)}</p>
                  <p className="text-xs text-slate-500">{formatMoney(task.weightedValue)} ponderado</p>
                </div>
              </div>
            ))}

            {!tasks.length && (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Nenhuma task corresponde aos filtros atuais.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
