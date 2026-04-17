const axios = require('axios');

class ChatwootService {
  /**
   * Helper unificado de captura de exceções
   */
  handleError(error) {
     if (error.response) {
        let message = 'Erro interno com Chatwoot';
        switch (error.response.status) {
          case 401: message = 'Token de acesso inválido ou expirado (401).'; break;
          case 404: message = 'Recurso não encontrado no Chatwoot (404).'; break;
          case 429: message = 'Muitas requisições (Too Many Requests). Tente novamente mais tarde (429).'; break;
          default: message = `Erro na API Chatwoot (Status: ${error.response.status}).`; break;
        }
        throw new Error(message);
      }
      throw new Error('Falha na requisição. Verifique a URL ou a sua conexão com a internet.');
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

  async getConversations(status = 'open') {
    try {
      const cfg = this._getAxiosConfig();
      // O endpoint para pegar TODAS as conversas (podemos passar o status)
      // /api/v1/accounts/{account_id}/conversations
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/conversations`, {
        ...cfg,
        params: { status }
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

  // --- M2/M3: STAGING & BOARDS DISPATCH --- //

  async getSystemBoards() {
    try {
      // Mock do acesso de boards (custom API da fazer.ai?)
      // Adaptar conforme a real URL da documentação deles.
      const cfg = this._getAxiosConfig();
      const result = await axios.get(`/api/v1/accounts/${process.env.ACCOUNT_ID}/custom_boards`, cfg);
      // Fallback em caso de erro formatado
      return result.data.payload || result.data || [];
    } catch (err) {
      // Para fins de dev sem crashar cron:
      console.log('Aviso (Mock): falha ao obter boards reais.', err.message);
      return []; 
    }
  }

  async createLeadFlow(leadData, boardId, stepId, assigneeId) {
     const cfg = this._getAxiosConfig();
     const actId = process.env.ACCOUNT_ID;
     
     // Passo 1: Criar Contato
     const contactRes = await axios.post(`/api/v1/accounts/${actId}/contacts`, {
         inbox_id: null,
         name: leadData.name,
         email: leadData.email,
         phone_number: leadData.phone
     }, cfg);
     const contact = contactRes.data.payload.contact || contactRes.data;

     // Passo 2: POST Endpoints de tasks do board -> cria tarefa
     // Esse endpoint e custom (fazer.ai especifico CRM)
     const taskRes = await axios.post(`/api/v1/accounts/${actId}/boards/${boardId}/tasks`, {
         title: contact.name,
         description: 'Importado via Staging CSV'
     }, cfg);
     const task = taskRes.data.payload || taskRes.data;

     // Passo 3: PATCH Associa a tarefa ao contato criado
     await axios.patch(`/api/v1/accounts/${actId}/tasks/${task.id}`, {
         contact_id: contact.id
     }, cfg);

     // Passo 4: PATCH Define o step inicial conforme o board selecionado
     await axios.patch(`/api/v1/accounts/${actId}/tasks/${task.id}/step`, {
         step_id: stepId
     }, cfg);

     // Passo 5: PATCH Atribui o agente
     if (assigneeId) {
         await axios.patch(`/api/v1/accounts/${actId}/tasks/${task.id}/assignee`, {
             assignee_id: assigneeId
         }, cfg);
     }

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

}

module.exports = new ChatwootService();
