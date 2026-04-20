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
const { getLeadMetadata, saveLeadMetadata } = require('../utils/stagingMetadata');

const uploadDir = require('os').tmpdir();
const upload = multer({ dest: uploadDir });

function sanitizeCustomAttributes(attributes = {}) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

async function createStagingLeadFromInput(rawLead, origin = 'manual', metadata = null) {
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
    const dispatchEntry = await prisma.dispatch.create({
      data: {
        admin_id: 'auto-ui',
        lead_count: leadIds.length,
        target_board_id: String(boardId),
        target_agent_id: assigneeId ? Number(assigneeId) : null,
      }
    });

    let successCount = 0;
    const errors = [];

    for (const id of leadIds) {
      const lead = await prisma.leadStaging.findUnique({ where: { id } });
      if (!lead || lead.status !== 'pending') continue;

      try {
        const metadata = getLeadMetadata(id) || {};
        await chatwootService.createLeadFlow({
          ...lead,
          identifier: metadata.identifier || null,
          customAttributes: metadata.customAttributes || {},
        }, boardId, stepId, assigneeId);

        await prisma.leadStaging.update({
          where: { id },
          data: { status: 'dispatched' }
        });
        successCount++;
      } catch (err) {
        errors.push({ id, name: lead.name, reason: err.message });
      }
    }

    res.json({
      success: true,
      dispatch_id: dispatchEntry.id,
      metrics: { success: successCount, failed: errors.length },
      errors,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
