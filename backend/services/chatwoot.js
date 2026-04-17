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
}

module.exports = new ChatwootService();
