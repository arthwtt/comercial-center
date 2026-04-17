const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/dispatches
router.get('/', async (req, res) => {
    try {
        const dispatches = await prisma.dispatch.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.json({ success: true, data: dispatches });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
