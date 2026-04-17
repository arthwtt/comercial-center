const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const chatwootService = require('../services/chatwoot');

// POST /api/config/test
router.post('/test', async (req, res) => {
  const { baseURL, accountId, token } = req.body;

  if (!baseURL || !accountId || !token) {
    return res.status(400).json({ error: 'Base URL, Account ID e API Token são obrigatórios.' });
  }

  try {
    const agents = await chatwootService.testConnection(baseURL, accountId, token);
    res.json({ success: true, agents });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/config/save
router.post('/save', async (req, res) => {
  const { baseURL, accountId, token } = req.body;

  if (!baseURL || !accountId || !token) {
    return res.status(400).json({ error: 'Faltam parâmetros para salvar.' });
  }

  try {
    const envContent = `CHATWOOT_BASE_URL=${baseURL}\nACCOUNT_ID=${accountId}\nAPI_ACCESS_TOKEN=${token}\nPORT=${process.env.PORT || 3000}\n`;
    const envPath = path.join(__dirname, '../../backend/.env');
    fs.writeFileSync(envPath, envContent, 'utf8');

    // Update in memory for immediate use
    process.env.CHATWOOT_BASE_URL = baseURL;
    process.env.ACCOUNT_ID = accountId;
    process.env.API_ACCESS_TOKEN = token;

    res.json({ success: true, message: 'Configurações salvas com sucesso.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno ao salvar configurações.' });
  }
});

// GET /api/config/status
router.get('/status', async (req, res) => {
  try {
    const status = await chatwootService.validateStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao validar status.' });
  }
});

module.exports = router;
