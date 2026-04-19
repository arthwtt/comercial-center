const express = require('express');
const router = express.Router();
const chatwootService = require('../services/chatwoot');
const { readCommercialConfig } = require('../utils/commercialConfig');

// GET /api/reports/agents
router.get('/agents', async (req, res) => {
    try {
        const { since, until } = req.query;
        const tSince = since ? parseInt(since) : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        const tUntil = until ? parseInt(until) : Math.floor(Date.now() / 1000);

        const data = await chatwootService.getAgentReports(tSince, tUntil);
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/reports/agents/dashboard
router.get('/agents/dashboard', async (req, res) => {
    try {
        const { since, until } = req.query;
        const tSince = since ? parseInt(since) : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        const tUntil = until ? parseInt(until) : Math.floor(Date.now() / 1000);

        const data = await chatwootService.getAgentPerformanceDashboard(tSince, tUntil);
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/reports/commercial/dashboard
router.get('/commercial/dashboard', async (req, res) => {
    try {
        const { since, until, agentId, inboxId, stepId, search } = req.query;
        const mapping = readCommercialConfig();
        const tSince = since ? parseInt(since) : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        const tUntil = until ? parseInt(until) : Math.floor(Date.now() / 1000);

        const data = await chatwootService.getCommercialDashboard({
            since: tSince,
            until: tUntil,
            businessHoursEnabled: mapping.businessHoursEnabled,
            mapping,
            filters: {
                agentId: agentId ? String(agentId) : '',
                inboxId: inboxId ? String(inboxId) : '',
                stepId: stepId ? String(stepId) : '',
                search: search ? String(search) : '',
            },
        });
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
