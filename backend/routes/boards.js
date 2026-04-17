const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatwootService = require('../services/chatwoot');

// GET /api/boards
router.get('/', async (req, res) => {
    try {
        const boards = await prisma.board.findMany({
            include: { steps: { orderBy: { position: 'asc' } } }
        });
        res.json({ success: true, data: boards });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/boards/sync
router.post('/sync', async (req, res) => {
    try {
        const boardsData = await chatwootService.getSystemBoards();
        if (!boardsData || !boardsData.length) {
            return res.status(404).json({ success: false, error: "Nenhum board encontrado." });
        }
        for (const b of boardsData) {
            await prisma.board.upsert({
                where: { id: String(b.id) },
                update: { name: b.name, synced_at: new Date() },
                create: { id: String(b.id), name: b.name, synced_at: new Date() }
            });
            if (b.steps) {
                for (const [index, step] of b.steps.entries()) {
                    await prisma.step.upsert({
                        where: { id: String(step.id) },
                        update: { name: step.name, position: index },
                        create: { id: String(step.id), name: step.name, board_id: String(b.id), position: index }
                    });
                }
            }
        }
        res.json({ success: true, message: 'Boards sincronizados' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
module.exports = router;
