const axios = require('axios');
const { normalizeEmail, normalizePhoneBR } = require('../utils/leadNormalization');
const { readCommercialConfig } = require('../utils/commercialConfig');

class ChatwootService {
  /**
   * Helper unificado de captura de exceções
   */
  handleError(error) {
     if (error.response) {
        let message = 'Erro interno com Chatwoot';
        const description = error.response.data?.description;
        const errors = Array.isArray(error.response.data?.errors) ? error.response.data.errors : [];
        const details = errors
          .map((item) => item?.message || item?.field || item?.code)
          .filter(Boolean)
          .join(', ');
        switch (error.response.status) {
          case 401: message = 'Token de acesso inv?lido ou expirado (401).'; break;
          case 404: message = 'Recurso n?o encontrado no Chatwoot (404).'; break;
          case 422: message = 'Chatwoot rejeitou os dados enviados (422).'; break;
          case 429: message = 'Muitas requisi??es (Too Many Requests). Tente novamente mais tarde (429).'; break;
          default: message = `Erro na API Chatwoot (Status: ${error.response.status}).`; break;
        }
        if (description || details) {
          message = `${message} ${[description, details].filter(Boolean).join(' | ')}`.trim();
        }
        throw new Error(message);
      }
      throw new Error('Falha na requisi??o. Verifique a URL ou a sua conex?o com a internet.');
  }

  /**
   * Test connection with Chatwoot
   */
  async testConnection(baseURL, accountId, token) {
    try {
      const cleanBaseURL = baseURL.replace(/\/$/, "");
      const url = `${cleanBaseURL}/api/v1/accounts/${accountId}/agents`;
      const response = await axios.get(url, { headers: { 'api_access_token': token } });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Validate existing connection using internal env variables
   */
  async validateStatus() {
    const baseURL = process.env.CHATWOOT_BASE_URL;
    const accountId = process.env.ACCOUNT_ID;
    const token = process.env.API_ACCESS_TOKEN;

    if (!baseURL || !accountId || !token) {
      return { configured: false, active: false };
    }

    try {
      await this.testConnection(baseURL, accountId, token);
      return { configured: true, active: true, baseURL, accountId };
    } catch (e) {
      return { configured: true, active: false, error: e.message, baseURL, accountId };
    }
  }

  // --- M1: GESTÃO DO KANBAN --- //
  
  _getAxiosConfig() {
    return {
      baseURL: process.env.CHATWOOT_BASE_URL.replace(/\/$/, ""),
      headers: { 'api_access_token': process.env.API_ACCESS_TOKEN }
    };
  }

  _asArray(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    if (Array.isArray(payload?.payload)) {
      return payload.payload;
    }

    if (Array.isArray(payload?.data?.payload)) {
      return payload.data.payload;
    }

    if (Array.isArray(payload?.payload?.data)) {
      return payload.payload.data;
    }

    return [];
  }

  _firstItem(payload) {
    return this._asArray(payload)[0] || null;
  }

  _normalizeAgents(payload) {
    return this._asArray(payload).map((agent) => ({
      id: Number(agent.id),
      name: agent.name || agent.available_name || 'Agente sem nome',
      email: agent.email || '',
      role: agent.role || '',
      availabilityStatus: agent.availability_status || agent.availability || agent.status || 'offline',
      avatarUrl: agent.thumbnail || agent.avatar_url || agent.avatar || null,
      autoOffline: Boolean(agent.auto_offline),
    }));
  }

  _normalizePerformanceRows(payload) {
    return this._asArray(payload).map((row) => ({
      agentId: Number(row.id || row.agent_id || row.user_id || row.assignee_id),
      resolvedConversations: Number(row.resolutions_count || row.resolved_conversations_count || row.conversations_resolved_count || 0),
      conversationsCount: Number(row.conversations_count || row.total_conversations_count || 0),
      sentMessages: Number(row.sent_messages_count || row.replies_count || row.messages_count || 0),
      avgFirstResponseTimeSeconds: Number(row.avg_first_response_time || row.average_first_response_time || 0),
      avgResolutionTimeSeconds: Number(row.avg_resolution_time || row.average_resolution_time || 0),
      csatScore: Number(row.csat_score || row.csat || row.satisfaction_score || 0),
    })).filter((row) => Number.isFinite(row.agentId));
  }

  _extractAssigneeId(conversation) {
    return Number(
      conversation?.meta?.assignee?.id ||
      conversation?.assignee_id ||
      conversation?.assignee?.id ||
      conversation?.meta?.assigned_agent?.id ||
      0
    );
  }

  _computeLoadStatus(activeConversations) {
    if (activeConversations >= 25) {
      return 'critical';
    }

    if (activeConversations >= 12) {
      return 'attention';
    }

    if (activeConversations <= 2) {
      return 'idle';
    }

    return 'balanced';
  }

  _average(items, key) {
    const values = items
      .map((item) => Number(item[key] || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  _sum(items, key) {
    return items.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  }

  _toIdSet(values) {
    return new Set((values || []).filter(Boolean).map((value) => String(value)));
  }

  _normalizeTask(task, stepsById) {
    const assignedAgents = Array.isArray(task.assigned_agents) ? task.assigned_agents : [];
    const contacts = Array.isArray(task.contacts) ? task.contacts : [];
    const conversations = Array.isArray(task.conversations) ? task.conversations : [];
    const primaryConversation = conversations[0] || null;
    const primaryInbox = primaryConversation?.inbox || null;
    const stepId = String(task.board_step_id || '');
    const step = stepsById.get(stepId);

    return {
      id: Number(task.id),
      title: task.title || 'Sem título',
      description: task.description || '',
      boardId: String(task.board_id || ''),
      boardStepId: stepId,
      boardStepName: step?.name || `Step ${stepId}`,
      priority: task.priority || '',
      status: task.status || '',
      value: Number(task.value || 0),
      weightedValue: Number(task.weighted_value || 0),
      labels: Array.isArray(task.labels) ? task.labels : [],
      dueDate: task.due_date || null,
      startDate: task.start_date || null,
      stepChangedAt: task.step_changed_at || null,
      createdAt: task.created_at || null,
      updatedAt: task.updated_at || null,
      customAttributes: task.custom_attributes || {},
      assignedAgents: assignedAgents.map((agent) => ({
        id: Number(agent.id),
        name: agent.name || agent.available_name || 'Agente sem nome',
        email: agent.email || '',
        availabilityStatus: agent.availability_status || 'offline',
        avatarUrl: agent.avatar_url || agent.thumbnail || null,
      })),
      contactNames: contacts.map((contact) => contact.name).filter(Boolean),
      conversationIds: conversations.map((conversation) => Number(conversation.id)).filter(Boolean),
      inbox: primaryInbox ? {
        id: Number(primaryInbox.id),
        name: primaryInbox.name || 'Inbox',
        channelType: primaryInbox.channel_type || '',
      } : null,
    };
  }

  async _getAllTasks(filters = {}) {
    const collectedTasks = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 10) {
      const response = await this.getTasks({
        ...filters,
        page,
        per_page: 100,
      });

      const batch = Array.isArray(response?.tasks) ? response.tasks : [];
      collectedTasks.push(...batch);

      const meta = response?.meta || {};
      hasMore = Boolean(meta.has_more);
      page += 1;
    }

    return collectedTasks;
  }

  async getConversations(status = 'open') {
    try {
      const cfg = this._getAxiosConfig();
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/conversations`, {
        ...cfg,
        params: { status }
      });
      return result.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async getTasks(filters = {}) {
    try {
      const cfg = this._getAxiosConfig();
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/kanban/tasks`, {
         ...cfg,
         params: filters
      });
      return result.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async getLabels() {
    try {
      const cfg = this._getAxiosConfig();
      // /api/v1/accounts/{account_id}/labels
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/labels`, cfg);
      return result.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async getAgents() {
    try {
      const cfg = this._getAxiosConfig();
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/agents`, cfg);
      return result.data;
    } catch (err) {
      this.handleError(err);
    }
  }

  async getInboxes() {
    try {
      const cfg = this._getAxiosConfig();
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/inboxes`, cfg);
      return this._asArray(result.data);
    } catch (err) {
      this.handleError(err);
    }
  }

  async searchContacts(query) {
    try {
        const cfg = this._getAxiosConfig();
        const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/contacts/search`, {
            ...cfg,
            params: { q: query }
        });
        return result.data;
    } catch (err) {
        this.handleError(err);
    }
  }

  async findExistingContact({ phone, email, name }) {
    const queries = [
      normalizePhoneBR(phone),
      normalizeEmail(email),
      String(name || '').trim(),
    ].filter(Boolean);

    for (const query of queries) {
      try {
        const response = await this.searchContacts(query);
        const payload = this._asArray(response);
        if (payload.length) {
          return payload[0];
        }
      } catch (_error) {
        // Ignore e tenta a próxima chave.
      }
    }

    return null;
  }

  // --- M2/M3: STAGING & BOARDS DISPATCH --- //

  async getSystemBoards() {
    try {
      const actId = process.env.ACCOUNT_ID;
      const cfg = this._getAxiosConfig();
      const response = await axios.get(`/api/v1/accounts/${actId}/kanban/boards`, cfg);
      
      if (response.data && Array.isArray(response.data.boards)) {
          return response.data.boards.map(b => ({
              id: b.id,
              name: b.name,
              steps: b.steps_summary || []
          }));
      }
      return [];
    } catch (err) {
      console.log('Falha ao obter kanban boards da fazer.ai:', err.message);
      return []; 
    }
  }

  async resolveDefaultInboxId() {
    const envInboxId = Number(process.env.DEFAULT_INBOX_ID || 0);
    if (Number.isFinite(envInboxId) && envInboxId > 0) {
      return envInboxId;
    }

    const configInboxId = Number(readCommercialConfig()?.defaultInboxId || 0);
    if (Number.isFinite(configInboxId) && configInboxId > 0) {
      return configInboxId;
    }

    const inboxes = await this.getInboxes();
    const firstInboxId = Number(inboxes?.[0]?.id || 0);
    return Number.isFinite(firstInboxId) && firstInboxId > 0 ? firstInboxId : null;
  }

  async createLeadFlow(leadData, boardId, stepId, assigneeId) {
     const cfg = this._getAxiosConfig();
     const actId = process.env.ACCOUNT_ID;
     const normalizedPhone = normalizePhoneBR(leadData.phone);
     const normalizedEmail = normalizeEmail(leadData.email);
     const parsedBoardId = Number(boardId);
     const parsedStepId = Number(stepId);

     if (!Number.isFinite(parsedBoardId) || !Number.isFinite(parsedStepId)) {
       throw new Error('Board ou etapa inv?lidos para criar a task no Chatwoot.');
     }

     const existingContact = await this.findExistingContact({
       phone: normalizedPhone,
       email: normalizedEmail,
       name: leadData.name,
     });
     
     // Passo 1: Criar/Buscar Contato
     let contact = existingContact;
     if (!contact) {
       const inboxId = await this.resolveDefaultInboxId();
       if (!inboxId) {
         throw new Error('Nenhum inbox do Chatwoot dispon?vel para criar o contato. Configure DEFAULT_INBOX_ID ou verifique os inboxes da conta.');
       }

       const contactRes = await axios.post(`/api/v1/accounts/${actId}/contacts`, {
         inbox_id: inboxId,
         name: leadData.name,
         email: normalizedEmail,
         phone_number: normalizedPhone
       }, cfg);
       contact = this._firstItem(contactRes.data) || contactRes.data?.payload?.contact || contactRes.data?.payload || contactRes.data;
     }

     if (!contact?.id) {
       throw new Error('Chatwoot n?o retornou um contato v?lido para o lead.');
     }

     // Passo 2: Criar a tarefa no Kanban
     const taskPayload = {
        task: {
          title: contact.name || leadData.name,
          description: 'Importado de CSV/Staging Manual',
          priority: 'None',
          board_id: parsedBoardId,
          board_step_id: parsedStepId,
          contact_ids: [contact.id]
        }
     };

     if (assigneeId) {
        taskPayload.task.assigned_agent_ids = [Number(assigneeId)];
     }

     const taskRes = await axios.post(`/api/v1/accounts/${actId}/kanban/tasks`, taskPayload, cfg);
     const task = taskRes.data;

     return { contact, task };
  }

  // --- MÓDULO OPN: REPORTS V2 --- //

  async getAgentReports(since, until) {
     try {
       const actId = process.env.ACCOUNT_ID;
       const cfg = this._getAxiosConfig();
       
       // Puxando conversas abertas e load (M1 já tem getConversations, mas agrupar por assignee é util aqui)
       const loadRes = await axios.get(`/api/v1/accounts/${actId}/conversations`, {
           ...cfg,
           params: { assignee_type: 'assigned', status: 'open' }
       });
       const activeConvs = loadRes.data?.data?.payload || [];

       // Puxando Performance de relatorios
       const reportsRes = await axios.get(`/api/v2/accounts/${actId}/reports/agents/summary`, {
           ...cfg,
           params: { since, until }
       });
       
       return {
           activeLoad: activeConvs,
           performance: reportsRes.data
       };
     } catch(e) {
       console.log('Falha em relatórios (Mocks para testes se Fazer.ai falhar):', e.message);
       return { activeLoad: [], performance: [] };
     }
  }

  async getSummaryAgentReports(since, until, businessHours = true) {
    try {
      const actId = process.env.ACCOUNT_ID;
      const cfg = this._getAxiosConfig();
      const response = await axios.get(`/api/v2/accounts/${actId}/summary_reports/agent`, {
        ...cfg,
        params: {
          since,
          until,
          business_hours: businessHours,
        }
      });
      return this._asArray(response.data);
    } catch (e) {
      console.log('Falha ao obter summary_reports/agent:', e.message);
      return [];
    }
  }

  async getConversationsByFilters(filters = {}) {
    try {
      const actId = process.env.ACCOUNT_ID;
      const cfg = this._getAxiosConfig();
      const response = await axios.get(`/api/v1/accounts/${actId}/conversations`, {
        ...cfg,
        params: filters,
      });

      return {
        meta: response.data?.data?.meta || {},
        payload: this._asArray(response.data),
      };
    } catch (e) {
      console.log('Falha ao obter conversas filtradas:', e.message);
      return { meta: {}, payload: [] };
    }
  }

  async getCommercialDashboard({ since, until, businessHoursEnabled, mapping, filters = {} }) {
    const boardId = mapping?.boardId;
    if (!boardId) {
      return {
        generatedAt: Math.floor(Date.now() / 1000),
        mapping,
        filters,
        summary: {
          totalAgents: 0,
          totalTasks: 0,
          openConversations: 0,
          meetingsScheduled: 0,
          meetingsDone: 0,
          proposalsSent: 0,
          wonCount: 0,
          lostCount: 0,
          pipelineValue: 0,
          weightedPipelineValue: 0,
        },
        agents: [],
        tasksByStage: [],
        tasks: [],
        filterOptions: { inboxes: [], steps: [], agents: [] },
      };
    }

    try {
      const taskFilters = { board_id: boardId };
      if (filters.stepId) {
        taskFilters.board_step_id = filters.stepId;
      }
      if (filters.inboxId) {
        taskFilters.inbox_id = filters.inboxId;
      }
      if (filters.agentId) {
        taskFilters.assigned_agent_ids = filters.agentId;
      }

      const conversationFilters = {
        assignee_type: 'all',
        status: 'open',
        page: 1,
      };
      if (filters.inboxId) {
        conversationFilters.inbox_id = filters.inboxId;
      }

      const [agentsPayload, tasks, reportsPayload, conversationsPayload, boardsPayload] = await Promise.all([
        this.getAgents(),
        this._getAllTasks(taskFilters),
        this.getSummaryAgentReports(since, until, businessHoursEnabled),
        this.getConversationsByFilters(conversationFilters),
        this.getSystemBoards(),
      ]);

      const agents = this._normalizeAgents(agentsPayload);
      const reportsByAgentId = new Map(
        reportsPayload.map((row) => [
          Number(row.id),
          {
            conversationsCount: Number(row.conversations_count || 0),
            resolvedConversationsCount: Number(row.resolved_conversations_count || 0),
            avgResolutionTime: Number(row.avg_resolution_time || 0),
            avgFirstResponseTime: Number(row.avg_first_response_time || 0),
            avgReplyTime: Number(row.avg_reply_time || 0),
          }
        ])
      );

      const openConversations = conversationsPayload.payload || [];
      const board = (boardsPayload || []).find((item) => String(item.id) === String(boardId));
      const steps = board?.steps || [];
      const stepsById = new Map(
        steps.map((step) => [String(step.id), { id: String(step.id), name: step.name, color: step.color || '#475569' }])
      );
      const searchTerm = String(filters.search || '').trim().toLowerCase();

      const mappedStepSets = {
        leadNovo: this._toIdSet([mapping.stepLeadNovoId]),
        qualificado: this._toIdSet([mapping.stepQualificadoId]),
        reuniaoAgendada: this._toIdSet([mapping.stepReuniaoAgendadaId]),
        reuniaoRealizada: this._toIdSet([mapping.stepReuniaoRealizadaId]),
        propostaEnviada: this._toIdSet([mapping.stepPropostaEnviadaId]),
        vendaFechada: this._toIdSet([mapping.stepVendaFechadaId]),
        perdido: this._toIdSet([mapping.stepPerdidoId]),
      };

      const filteredOpenConversations = openConversations.filter((conversation) => {
        const assigneeId = this._extractAssigneeId(conversation);
        if (filters.agentId && String(assigneeId) !== String(filters.agentId)) {
          return false;
        }
        return true;
      });

      const openConversationsByAgent = filteredOpenConversations.reduce((acc, conversation) => {
        const assigneeId = this._extractAssigneeId(conversation);
        if (!assigneeId) {
          return acc;
        }

        const current = acc.get(assigneeId) || { openConversations: 0, unreadConversations: 0 };
        current.openConversations += 1;
        current.unreadConversations += Number(conversation.unread_count || 0) > 0 ? 1 : 0;
        acc.set(assigneeId, current);
        return acc;
      }, new Map());

      const stageMap = new Map(
        steps.map((step) => [
          String(step.id),
          {
            id: String(step.id),
            name: step.name,
            color: step.color || '#475569',
            count: 0,
            value: 0,
            weightedValue: 0,
          }
        ])
      );

      const agentsDashboard = agents.map((agent) => ({
        ...agent,
        taskCount: 0,
        meetingsScheduled: 0,
        meetingsDone: 0,
        proposalsSent: 0,
        wonCount: 0,
        lostCount: 0,
        pipelineValue: 0,
        weightedPipelineValue: 0,
        openConversations: openConversationsByAgent.get(agent.id)?.openConversations || 0,
        unreadConversations: openConversationsByAgent.get(agent.id)?.unreadConversations || 0,
        conversationsCount: reportsByAgentId.get(agent.id)?.conversationsCount || 0,
        resolvedConversationsCount: reportsByAgentId.get(agent.id)?.resolvedConversationsCount || 0,
        avgResolutionTimeSeconds: reportsByAgentId.get(agent.id)?.avgResolutionTime || 0,
        avgFirstResponseTimeSeconds: reportsByAgentId.get(agent.id)?.avgFirstResponseTime || 0,
        avgReplyTimeSeconds: reportsByAgentId.get(agent.id)?.avgReplyTime || 0,
      }));

      const agentsById = new Map(agentsDashboard.map((agent) => [agent.id, agent]));
      const normalizedTasks = tasks
        .map((task) => this._normalizeTask(task, stepsById))
        .filter((task) => {
          if (!searchTerm) {
            return true;
          }

          const haystack = [
            task.title,
            task.description,
            task.boardStepName,
            ...(task.contactNames || []),
            ...(task.assignedAgents || []).map((agent) => agent.name),
            ...(task.labels || []),
            task.inbox?.name || '',
          ].join(' ').toLowerCase();

          return haystack.includes(searchTerm);
        });
      const visibleAgentIds = filters.agentId
        ? new Set([Number(filters.agentId)])
        : new Set();
      const inboxMap = new Map();

      normalizedTasks.forEach((task) => {
        const stepId = String(task.boardStepId || '');
        const taskValue = task.value;
        const taskWeightedValue = task.weightedValue;
        const stage = stageMap.get(stepId);
        if (stage) {
          stage.count += 1;
          stage.value += taskValue;
          stage.weightedValue += taskWeightedValue;
        }

        if (task.inbox?.id) {
          inboxMap.set(String(task.inbox.id), {
            id: String(task.inbox.id),
            name: task.inbox.name,
          });
        }

        task.assignedAgents.forEach((assignedAgent) => {
          const agent = agentsById.get(Number(assignedAgent.id));
          if (!agent) {
            return;
          }
          visibleAgentIds.add(Number(assignedAgent.id));

          agent.taskCount += 1;
          agent.pipelineValue += taskValue;
          agent.weightedPipelineValue += taskWeightedValue;

          if (mappedStepSets.reuniaoAgendada.has(stepId)) {
            agent.meetingsScheduled += 1;
          }
          if (mappedStepSets.reuniaoRealizada.has(stepId)) {
            agent.meetingsDone += 1;
          }
          if (mappedStepSets.propostaEnviada.has(stepId)) {
            agent.proposalsSent += 1;
          }
          if (mappedStepSets.vendaFechada.has(stepId)) {
            agent.wonCount += 1;
          }
          if (mappedStepSets.perdido.has(stepId)) {
            agent.lostCount += 1;
          }
        });
      });

      const finalAgents = agentsDashboard
        .filter((agent) => {
          if (filters.agentId) {
            return String(agent.id) === String(filters.agentId);
          }

          if (normalizedTasks.length) {
            return visibleAgentIds.has(agent.id) || agent.openConversations > 0;
          }

          return true;
        })
        .map((agent) => ({
          ...agent,
          conversionRate: agent.meetingsScheduled > 0 ? (agent.wonCount / agent.meetingsScheduled) * 100 : 0,
          loadStatus: this._computeLoadStatus(agent.openConversations),
        }))
        .sort((a, b) => {
          const scoreA = (a.wonCount * 12) + (a.meetingsScheduled * 4) + (a.pipelineValue / 100) - (a.avgFirstResponseTimeSeconds / 120);
          const scoreB = (b.wonCount * 12) + (b.meetingsScheduled * 4) + (b.pipelineValue / 100) - (b.avgFirstResponseTimeSeconds / 120);
          return scoreB - scoreA;
        });

      return {
        generatedAt: Math.floor(Date.now() / 1000),
        mapping,
        filters,
        summary: {
          totalAgents: finalAgents.length,
          totalTasks: normalizedTasks.length,
          openConversations: this._sum(finalAgents, 'openConversations'),
          meetingsScheduled: this._sum(finalAgents, 'meetingsScheduled'),
          meetingsDone: this._sum(finalAgents, 'meetingsDone'),
          proposalsSent: this._sum(finalAgents, 'proposalsSent'),
          wonCount: this._sum(finalAgents, 'wonCount'),
          lostCount: this._sum(finalAgents, 'lostCount'),
          pipelineValue: this._sum(finalAgents, 'pipelineValue'),
          weightedPipelineValue: this._sum(finalAgents, 'weightedPipelineValue'),
        },
        agents: finalAgents,
        tasksByStage: Array.from(stageMap.values()).filter((stage) => stage.count > 0).sort((a, b) => b.count - a.count),
        tasks: normalizedTasks.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
        filterOptions: {
          inboxes: Array.from(inboxMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
          steps: steps.map((step) => ({ id: String(step.id), name: step.name })),
          agents: agents.map((agent) => ({ id: String(agent.id), name: agent.name })),
        },
      };
    } catch (e) {
      console.log('Falha ao montar dashboard comercial:', e.message);
      return {
        generatedAt: Math.floor(Date.now() / 1000),
        mapping,
        filters,
        summary: {
          totalAgents: 0,
          totalTasks: 0,
          openConversations: 0,
          meetingsScheduled: 0,
          meetingsDone: 0,
          proposalsSent: 0,
          wonCount: 0,
          lostCount: 0,
          pipelineValue: 0,
          weightedPipelineValue: 0,
        },
        agents: [],
        tasksByStage: [],
        tasks: [],
        filterOptions: { inboxes: [], steps: [], agents: [] },
      };
    }
  }

  async getAgentPerformanceDashboard(since, until) {
    try {
      const [agentsPayload, reportsPayload] = await Promise.all([
        this.getAgents(),
        this.getAgentReports(since, until)
      ]);

      const agents = this._normalizeAgents(agentsPayload);
      const activeLoad = this._asArray(reportsPayload?.activeLoad);
      const performanceRows = this._normalizePerformanceRows(reportsPayload?.performance);
      const performanceByAgentId = new Map(performanceRows.map((row) => [row.agentId, row]));
      const activeByAgentId = activeLoad.reduce((acc, conversation) => {
        const assigneeId = this._extractAssigneeId(conversation);
        if (!assigneeId) {
          return acc;
        }

        acc.set(assigneeId, (acc.get(assigneeId) || 0) + 1);
        return acc;
      }, new Map());

      const agentsDashboard = agents
        .map((agent) => {
          const performance = performanceByAgentId.get(agent.id) || {};
          const activeConversations = activeByAgentId.get(agent.id) || 0;
          const status = this._computeLoadStatus(activeConversations);

          return {
            ...agent,
            activeConversations,
            resolvedConversations: performance.resolvedConversations || 0,
            conversationsCount: performance.conversationsCount || 0,
            sentMessages: performance.sentMessages || 0,
            avgFirstResponseTimeSeconds: performance.avgFirstResponseTimeSeconds || 0,
            avgResolutionTimeSeconds: performance.avgResolutionTimeSeconds || 0,
            csatScore: performance.csatScore || 0,
            loadStatus: status,
          };
        })
        .sort((a, b) => {
          const scoreA = (a.activeConversations * 3) + a.resolvedConversations + a.sentMessages;
          const scoreB = (b.activeConversations * 3) + b.resolvedConversations + b.sentMessages;
          return scoreB - scoreA;
        });

      const onlineCount = agentsDashboard.filter((agent) => ['online', 'available'].includes(String(agent.availabilityStatus).toLowerCase())).length;
      const busyCount = agentsDashboard.filter((agent) => String(agent.availabilityStatus).toLowerCase() === 'busy').length;
      const criticalLoadCount = agentsDashboard.filter((agent) => agent.loadStatus === 'critical').length;

      return {
        generatedAt: Math.floor(Date.now() / 1000),
        period: { since, until },
        summary: {
          totalAgents: agentsDashboard.length,
          onlineCount,
          busyCount,
          offlineCount: Math.max(agentsDashboard.length - onlineCount - busyCount, 0),
          activeConversations: agentsDashboard.reduce((sum, agent) => sum + agent.activeConversations, 0),
          resolvedConversations: agentsDashboard.reduce((sum, agent) => sum + agent.resolvedConversations, 0),
          sentMessages: agentsDashboard.reduce((sum, agent) => sum + agent.sentMessages, 0),
          avgFirstResponseTimeSeconds: this._average(agentsDashboard, 'avgFirstResponseTimeSeconds'),
          avgResolutionTimeSeconds: this._average(agentsDashboard, 'avgResolutionTimeSeconds'),
          avgCsatScore: this._average(agentsDashboard, 'csatScore'),
          criticalLoadCount,
        },
        agents: agentsDashboard,
      };
    } catch (e) {
      console.log('Falha ao montar dashboard de agentes:', e.message);
      return {
        generatedAt: Math.floor(Date.now() / 1000),
        period: { since, until },
        summary: {
          totalAgents: 0,
          onlineCount: 0,
          busyCount: 0,
          offlineCount: 0,
          activeConversations: 0,
          resolvedConversations: 0,
          sentMessages: 0,
          avgFirstResponseTimeSeconds: 0,
          avgResolutionTimeSeconds: 0,
          avgCsatScore: 0,
          criticalLoadCount: 0,
        },
        agents: [],
      };
    }
  }

}

module.exports = new ChatwootService();
