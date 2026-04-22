const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const chatwootService = require('../services/chatwoot');
const { readCommercialConfig, saveCommercialConfig } = require('../utils/commercialConfig');

const TOKEN_MASK = '••••••••••••••••';

function parseEnvFile(content = '') {
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return acc;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

function stringifyEnvFile(payload = {}) {
  return `${Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`;
}

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
  const { baseURL, accountId, token, defaultInboxId } = req.body;

  try {
    const envPath = path.join(__dirname, '../../backend/.env');
    const existingEnv = fs.existsSync(envPath)
      ? parseEnvFile(fs.readFileSync(envPath, 'utf8'))
      : {};

    const resolvedBaseURL = String(baseURL || existingEnv.CHATWOOT_BASE_URL || '').trim();
    const resolvedAccountId = String(accountId || existingEnv.ACCOUNT_ID || '').trim();
    const resolvedToken = !token || token === TOKEN_MASK
      ? String(existingEnv.API_ACCESS_TOKEN || '').trim()
      : String(token).trim();

    if (!resolvedBaseURL || !resolvedAccountId || !resolvedToken) {
      return res.status(400).json({ error: 'Faltam parâmetros para salvar.' });
    }

    const nextEnv = {
      ...existingEnv,
      CHATWOOT_BASE_URL: resolvedBaseURL,
      ACCOUNT_ID: resolvedAccountId,
      API_ACCESS_TOKEN: resolvedToken,
      PORT: existingEnv.PORT || process.env.PORT || 3000,
    };

    if (defaultInboxId !== undefined && String(defaultInboxId).trim() !== '') {
      nextEnv.DEFAULT_INBOX_ID = String(defaultInboxId).trim();
    }

    fs.writeFileSync(envPath, stringifyEnvFile(nextEnv), 'utf8');

    process.env.CHATWOOT_BASE_URL = resolvedBaseURL;
    process.env.ACCOUNT_ID = resolvedAccountId;
    process.env.API_ACCESS_TOKEN = resolvedToken;
    if (defaultInboxId !== undefined && String(defaultInboxId).trim() !== '') {
      process.env.DEFAULT_INBOX_ID = String(defaultInboxId).trim();
    }

    res.json({ success: true, message: 'Configurações salvas com sucesso.' });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Erro interno ao salvar configurações.' });
  }
});

// GET /api/config/status
router.get('/status', async (_req, res) => {
  try {
    const status = await chatwootService.validateStatus();
    res.json({
      ...status,
      defaultInboxId: process.env.DEFAULT_INBOX_ID || '',
    });
  } catch (_error) {
    res.status(500).json({ error: 'Erro ao validar status.' });
  }
});

// GET /api/config/commercial-mapping
router.get('/commercial-mapping', async (_req, res) => {
  try {
    res.json({ success: true, data: readCommercialConfig() });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Erro ao carregar mapeamento comercial.' });
  }
});

// POST /api/config/commercial-mapping
router.post('/commercial-mapping', async (req, res) => {
  try {
    const mapping = saveCommercialConfig(req.body || {});
    res.json({ success: true, data: mapping });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Erro ao salvar mapeamento comercial.' });
  }
});

// GET /api/config/boards-preview
router.get('/boards-preview', async (_req, res) => {
  try {
    const boards = await chatwootService.getSystemBoards();
    res.json({ success: true, data: boards });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Erro ao carregar boards do Chatwoot.' });
  }
});

module.exports = router;
