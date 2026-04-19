const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatwootService = require('../services/chatwoot');
const { normalizeLeadInput } = require('../utils/leadNormalization');

// Usa /tmp ou pasta local pra uploads
const uploadDir = require('os').tmpdir();
const upload = multer({ dest: uploadDir });

async function createStagingLeadFromInput(rawLead, origin = 'manual') {
    const normalized = normalizeLeadInput(rawLead);
    if (!normalized.name) {
        return { inserted: false, skipped: true, reason: 'missing_name' };
    }

    if (!normalized.phone && !normalized.email) {
        return { inserted: false, skipped: true, reason: 'missing_contact' };
    }

    let isDuplicate = false;
    try {
        const existing = await chatwootService.findExistingContact({
            phone: normalized.phone,
            email: normalized.email,
            name: normalized.name,
        });
        isDuplicate = Boolean(existing);
    } catch (_error) {
        isDuplicate = false;
    }

    await prisma.leadStaging.create({
        data: {
            name: normalized.name,
            email: normalized.email,
            phone: normalized.phone,
            status: isDuplicate ? 'skipped' : 'pending',
            origin,
        }
    });

    return { inserted: !isDuplicate, skipped: isDuplicate, reason: isDuplicate ? 'duplicate' : null };
}

// POST /api/leads/import
router.post('/import', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Arquivo CSV obrigatório sob a tag "file"' });
    
    const results = [];
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            fs.unlinkSync(req.file.path); // Limpa cache FS
            
            let inserted = 0;
            let skipped = 0;

            for (const row of results) {
                try {
                   const result = await createStagingLeadFromInput(row, 'csv');
                   if (result.inserted) inserted++;
                   if (result.skipped) skipped++;
                } catch(_e) {
                   skipped++;
                }
            }

            res.json({ success: true, metrics: { inserted, skipped } });
        });
});

// POST /api/leads/manual
router.post('/manual', async (req, res) => {
    try {
        const result = await createStagingLeadFromInput(req.body || {}, 'manual');
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/leads/staging
router.get('/staging', async (req, res) => {
    try {
        const { status } = req.query;
        let params = { orderBy: { created_at: 'desc' } };
        if (status) params.where = { status };
        
        const leads = await prisma.leadStaging.findMany(params);
        res.json({ success: true, data: leads });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/leads/dispatch
router.post('/dispatch', async (req, res) => {
    const { leadIds, boardId, stepId, assigneeId } = req.body;
    if (!leadIds || !leadIds.length || !boardId || !stepId) {
        return res.status(400).json({ error: 'Faltam propriedades obrigatórias (leadIds, boardId, stepId)' });
    }

    try {
        // Criar registro historico na tabela de Dispatches
        const dispatchEntry = await prisma.dispatch.create({
            data: {
                admin_id: 'auto-ui', 
                lead_count: leadIds.length,
                target_board_id: String(boardId),
                target_agent_id: assigneeId ? Number(assigneeId) : null,
            }
        });

        let successCount = 0;
        let errors = [];

        for (const id of leadIds) {
            const lead = await prisma.leadStaging.findUnique({ where: { id } });
            if (!lead || lead.status !== 'pending') continue;

            try {
                // Roda as rotas HTTP de Push ao Chatwoot sequencialmente e tratadas no ChatwootService
                await chatwootService.createLeadFlow(lead, boardId, stepId, assigneeId);
                
                await prisma.leadStaging.update({
                    where: { id },
                    data: { status: 'dispatched' }
                });
                successCount++;
            } catch (err) {
                // Registra erro unicamente para devolver ao Frontend, mas O LOTE CONTINUA!
                errors.push({ id, name: lead.name, reason: err.message });
            }
        }

        res.json({ 
            success: true, 
            dispatch_id: dispatchEntry.id,
            metrics: { success: successCount, failed: errors.length },
            errors
        });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
