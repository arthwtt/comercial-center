const axios = require('axios');

class ChatwootService {
  /**
   * Test connection with Chatwoot
   */
  async testConnection(baseURL, accountId, token) {
    try {
      // Remover barras de trailing URL, se houver
      const cleanBaseURL = baseURL.replace(/\/$/, "");
      const url = `${cleanBaseURL}/api/v1/accounts/${accountId}/agents`;
      const response = await axios.get(url, {
        headers: {
          'api_access_token': token
        }
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        let message = 'Erro ao conectar com Chatwoot';
        switch (error.response.status) {
          case 401:
            message = 'Token de acesso inválido ou expirado (401).';
            break;
          case 404:
            message = 'URL base ou Account ID incorretos (404).';
            break;
          case 429:
            message = 'Muitas requisições (Too Many Requests). Tente novamente mais tarde (429).';
            break;
          default:
            message = `Erro na API Chatwoot (Status: ${error.response.status}).`;
            break;
        }
        throw new Error(message);
      }
      throw new Error('Falha na requisição. Verifique a URL ou a sua conexão com a internet.');
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
}

module.exports = new ChatwootService();
