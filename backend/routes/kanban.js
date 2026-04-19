const express = require('express');
const router = express.Router();
const chatwootService = require('../services/chatwoot');

// Retorna todas a conversas ativas (inbox unificado)
router.get('/conversations', async (req, res) => {
  try {
    const data = await chatwootService.getConversations('open');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retorna lista de tasks (CRM Boards)
router.get('/tasks', async (req, res) => {
  try {
    const { board_id } = req.query;
    const data = await chatwootService.getTasks(board_id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retorna lista de agentes (para fins de filtro)
router.get('/agents', async (req, res) => {
  try {
    const data = await chatwootService.getAgents();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
