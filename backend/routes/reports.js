const express = require('express');
const router = express.Router();
const chatwootService = require('../services/chatwoot');

// GET /api/reports/agents
router.get('/agents', async (req, res) => {
    try {
        const { since, until } = req.query;
        // Padrão: 30 dias se nulo
        let tSince = since ? parseInt(since) : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        let tUntil = until ? parseInt(until) : Math.floor(Date.now() / 1000);

        const data = await chatwootService.getAgentReports(tSince, tUntil);
        res.json({ success: true, data });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
