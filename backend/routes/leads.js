const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const chatwootService = require('../services/chatwoot');
const { normalizeLeadInput } = require('../utils/leadNormalization');
const { mapSpreadsheetLead } = require('../utils/spreadsheetLeadMapper');
const { getLeadMetadata, saveLeadMetadata, clearAllMetadata } = require('../utils/stagingMetadata');
const { readCommercialConfig } = require('../utils/commercialConfig');

const uploadDir = require('os').tmpdir();
const upload = multer({ dest: uploadDir });

function sanitizeCustomAttributes(attributes = {}) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

async function createStagingLeadFromInput(rawLead, origin = 'manual', metadata = null) {
  const normalized = normalizeLeadInput(rawLead);
  const identifier = metadata?.identifier || null;
  if (!normalized.name) {
    return { inserted: false, skipped: true, reason: 'missing_name' };
  }

  if (!normalized.phone && !normalized.email) {
    return { inserted: false, skipped: true, reason: 'missing_contact' };
  }

  let isDuplicate = false;
  const localDuplicateWhere = [];
  if (normalized.phone) {
    localDuplicateWhere.push({ phone: normalized.phone });
  }
  if (normalized.email) {
    localDuplicateWhere.push({ email: normalized.email });
  }

  try {
    const existingLocal = localDuplicateWhere.length
      ? await prisma.leadStaging.findFirst({ where: { OR: localDuplicateWhere } })
      : null;

    const existing = await chatwootService.findExistingContact({
      phone: normalized.phone,
      email: normalized.email,
      identifier,
      name: normalized.name,
      includeName: false,
    });
    isDuplicate = Boolean(existingLocal || existing);
  } catch (_error) {
    isDuplicate = false;
  }

  const createdLead = await prisma.leadStaging.create({
    data: {
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      status: isDuplicate ? 'skipped' : 'pending',
      origin,
    }
  });

  if (metadata) {
    saveLeadMetadata(createdLead.id, metadata);
  }

  return {
    inserted: !isDuplicate,
    skipped: isDuplicate,
    reason: isDuplicate ? 'duplicate' : null,
    leadId: createdLead.id,
  };
}

function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function parseSpreadsheetFile(file) {
  const extension = path.extname(file.originalname || file.path).toLowerCase();
  if (extension === '.xlsx' || extension === '.xls') {
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  return parseCsvFile(file.path);
}

// POST /api/leads/import
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo .xlsx ou .csv obrigatório sob a tag "file"' });
  }

  try {
    const rows = await parseSpreadsheetFile(req.file);
    fs.unlinkSync(req.file.path);

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const mapped = mapSpreadsheetLead(row);
        const result = await createStagingLeadFromInput(
          mapped,
          'csv',
          {
            identifier: mapped.identifier,
            customAttributes: sanitizeCustomAttributes(mapped.customAttributes),
            company: sanitizeCustomAttributes(mapped.customAttributes),
            sourceRow: mapped.sourceRow,
          }
        );

        if (result.inserted) inserted++;
        if (result.skipped) skipped++;
      } catch (_error) {
        skipped++;
      }
    }

    res.json({ success: true, metrics: { inserted, skipped } });
  } catch (e) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: e.message });
  }
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
    const params = { orderBy: { created_at: 'desc' } };
    if (status) params.where = { status };

    const leads = await prisma.leadStaging.findMany(params);
    const enrichedLeads = leads.map((lead) => {
      const metadata = getLeadMetadata(lead.id) || {};
      return {
        ...lead,
        identifier: metadata.identifier || null,
        customAttributes: metadata.customAttributes || {},
        company: metadata.company || metadata.customAttributes || {},
        sourceRow: metadata.sourceRow || null,
      };
    });
    res.json({ success: true, data: enrichedLeads });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/leads/reset
router.post('/reset', async (req, res) => {
  const { includeDispatches = true } = req.body || {};

  try {
    await prisma.leadStaging.deleteMany({});
    clearAllMetadata();

    if (includeDispatches) {
      await prisma.dispatch.deleteMany({});
    }

    res.json({
      success: true,
      message: includeDispatches
        ? 'Staging, metadados e histórico de lotes limpos.'
        : 'Staging e metadados limpos.',
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/leads/dispatch
router.post('/dispatch', async (req, res) => {
  const commercialConfig = readCommercialConfig();
  const {
    leadIds,
    boardId = commercialConfig.boardId || 5,
    stepId = commercialConfig.stepLeadNovoId || 22,
    assigneeId,
    priority = 'high'
  } = req.body;
  if (!leadIds || !leadIds.length) {
    return res.status(400).json({ error: 'Faltam leadIds obrigatórios' });
  }

  const parsedBoardId = Number(boardId);
  const parsedStepId = Number(stepId);

  if (!Number.isFinite(parsedBoardId) || !Number.isFinite(parsedStepId)) {
    return res.status(400).json({ error: 'boardId e stepId devem ser números válidos' });
  }

  try {
    const dispatchEntry = await prisma.dispatch.create({
      data: {
        admin_id: 'auto-ui',
        lead_count: leadIds.length,
        target_board_id: String(parsedBoardId),
        target_agent_id: assigneeId ? Number(assigneeId) : null,
      }
    });

    const contactsCreated = [];
    const errors = [];

    for (const id of leadIds) {
      const lead = await prisma.leadStaging.findUnique({ where: { id } });
      if (!lead || lead.status !== 'pending') continue;

      try {
        const metadata = getLeadMetadata(id) || {};
        const leadData = {
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          origin: lead.origin,
          identifier: metadata.identifier || null,
          customAttributes: metadata.customAttributes || {},
        };

        const assigneeIds = assigneeId ? [Number(assigneeId)] : [];
        const result = await chatwootService.createLeadInChatwootFlow(
          leadData,
          parsedBoardId,
          parsedStepId,
          assigneeIds,
          priority
        );

        contactsCreated.push({
          leadId: id,
          contactId: result.contact.id,
          taskId: result.task.id,
          name: lead.name,
          contactCreated: result.contactCreated,
          taskCreated: result.taskCreated
        });
      } catch (err) {
        errors.push({ id, name: lead.name, reason: err.message });
      }
    }

    let successCount = 0;
    if (contactsCreated.length) {
      // Atualizar status dos leads criados com sucesso
      const successfulLeadIds = contactsCreated.map(item => item.leadId);
      await prisma.leadStaging.updateMany({
        where: { id: { in: successfulLeadIds } },
        data: { status: 'dispatched' }
      });
      successCount = successfulLeadIds.length;
    }

    res.json({
      success: true,
      dispatch_id: dispatchEntry.id,
      metrics: { success: successCount, failed: errors.length },
      leads_processed: contactsCreated,
      errors,
      mode: 'chatwoot_direct_with_kanban',
      board_id: parsedBoardId,
      step_id: parsedStepId,
      success_message: successCount
        ? `Criados ${successCount} lead(s) com tarefa(s) no Kanban.`
        : 'Nenhum lead foi processado.',
      failure_message: errors.length
        ? `Falha no processamento de ${errors.length} lead(s).`
        : '',
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
