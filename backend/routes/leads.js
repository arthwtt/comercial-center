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
const { readCommercialConfig } = require('../utils/commercialConfig');

const uploadDir = require('os').tmpdir();
const upload = multer({ dest: uploadDir });

function sanitizeCustomAttributes(attributes = {}) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return ['1', 'true', 'on', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function deriveBatchName(fileName = '') {
  const cleanName = String(fileName || '').trim();
  if (!cleanName) {
    return `Importacao ${new Date().toLocaleString('pt-BR')}`;
  }

  return cleanName.replace(/\.[^.]+$/, '') || cleanName;
}

function buildLeadRecordData(normalizedLead, origin = 'manual', metadata = null, status = 'pending', batchId = null) {
  const customAttributes = sanitizeCustomAttributes(metadata?.customAttributes);
  const company = sanitizeCustomAttributes(metadata?.company || customAttributes);

  return {
    name: normalizedLead.name,
    email: normalizedLead.email,
    phone: normalizedLead.phone,
    batch_id: batchId,
    identifier: metadata?.identifier || null,
    custom_attributes: customAttributes,
    company,
    source_row: metadata?.sourceRow || null,
    status,
    origin,
  };
}

function formatLeadRecord(lead) {
  const customAttributes = sanitizeCustomAttributes(lead.custom_attributes);
  const company = sanitizeCustomAttributes(lead.company || customAttributes);

  return {
    ...lead,
    batchId: lead.batch_id || null,
    identifier: lead.identifier || null,
    customAttributes,
    company,
    sourceRow: lead.source_row || null,
  };
}

function formatImportBatch(batch) {
  const locatedCount = Number(batch.located_count || 0);
  const processedCount = Number(batch.processed_count || 0);
  const progressPercent = locatedCount > 0
    ? Math.min(100, Math.round((processedCount / locatedCount) * 100))
    : ['completed', 'failed'].includes(batch.status)
      ? 100
      : 0;

  return {
    ...batch,
    progressPercent,
    leadCount: batch._count?.leads || 0,
  };
}

function buildLeadDataForDispatch(lead) {
  const formattedLead = formatLeadRecord(lead);

  return {
    name: formattedLead.name,
    phone: formattedLead.phone,
    email: formattedLead.email,
    origin: formattedLead.origin,
    identifier: formattedLead.identifier,
    customAttributes: formattedLead.customAttributes,
  };
}

async function createStagingLeadFromInput(rawLead, origin = 'manual', metadata = null, options = {}) {
  const normalized = normalizeLeadInput(rawLead);
  const identifier = metadata?.identifier || null;
  const shouldCheckRemoteDuplicates = Boolean(options.checkRemoteDuplicates);

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

    let existingRemote = null;
    if (shouldCheckRemoteDuplicates) {
      existingRemote = await chatwootService.findExistingContact({
        phone: normalized.phone,
        email: normalized.email,
        identifier,
        name: normalized.name,
        includeName: false,
      });
    }

    isDuplicate = Boolean(existingLocal || existingRemote);
  } catch (_error) {
    isDuplicate = false;
  }

  const createdLead = await prisma.leadStaging.create({
    data: buildLeadRecordData(
      normalized,
      origin,
      metadata || { identifier },
      isDuplicate ? 'skipped' : 'pending',
      options.batchId || null
    ),
  });

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

function buildImportMetadata(mappedLead) {
  const customAttributes = sanitizeCustomAttributes(mappedLead.customAttributes);
  return {
    identifier: mappedLead.identifier,
    customAttributes,
    company: customAttributes,
    sourceRow: mappedLead.sourceRow,
  };
}

function chunk(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function findExistingLeadsForImport(phones = [], emails = []) {
  const existingPhones = new Set();
  const existingEmails = new Set();

  for (const phoneChunk of chunk(phones.filter(Boolean), 5000)) {
    const existingByPhone = await prisma.leadStaging.findMany({
      where: { phone: { in: phoneChunk } },
      select: { phone: true },
    });

    existingByPhone.forEach((lead) => {
      if (lead.phone) {
        existingPhones.add(lead.phone);
      }
    });
  }

  for (const emailChunk of chunk(emails.filter(Boolean), 5000)) {
    const existingByEmail = await prisma.leadStaging.findMany({
      where: { email: { in: emailChunk } },
      select: { email: true },
    });

    existingByEmail.forEach((lead) => {
      if (lead.email) {
        existingEmails.add(lead.email);
      }
    });
  }

  return { existingPhones, existingEmails };
}

async function updateImportBatchProgress(batchId, payload) {
  await prisma.importBatch.update({
    where: { id: batchId },
    data: payload,
  });
}

async function processImportBatch(batchId, file) {
  try {
    await updateImportBatchProgress(batchId, {
      status: 'analyzing',
      started_at: new Date(),
    });

    const rows = await parseSpreadsheetFile(file);
    const totalRows = rows.length;
    const mappedRows = rows.map((row) => {
      const mappedLead = mapSpreadsheetLead(row);
      return {
        mappedLead,
        normalizedLead: normalizeLeadInput(mappedLead),
      };
    });

    const validRows = mappedRows.filter(({ normalizedLead }) => (
      Boolean(normalizedLead.name && (normalizedLead.phone || normalizedLead.email))
    ));
    const locatedCount = validRows.length;
    const ignoredCount = totalRows - locatedCount;

    await updateImportBatchProgress(batchId, {
      status: 'processing',
      total_rows: totalRows,
      located_count: locatedCount,
      ignored_count: ignoredCount,
    });

    const phones = Array.from(new Set(validRows.map(({ normalizedLead }) => normalizedLead.phone).filter(Boolean)));
    const emails = Array.from(new Set(validRows.map(({ normalizedLead }) => normalizedLead.email).filter(Boolean)));
    const { existingPhones, existingEmails } = await findExistingLeadsForImport(phones, emails);
    const seenPhones = new Set();
    const seenEmails = new Set();
    const createBuffer = [];
    let processedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    for (const { mappedLead, normalizedLead } of validRows) {
      const isDuplicate = Boolean(
        (normalizedLead.phone && (existingPhones.has(normalizedLead.phone) || seenPhones.has(normalizedLead.phone))) ||
        (normalizedLead.email && (existingEmails.has(normalizedLead.email) || seenEmails.has(normalizedLead.email)))
      );

      if (normalizedLead.phone) {
        seenPhones.add(normalizedLead.phone);
      }
      if (normalizedLead.email) {
        seenEmails.add(normalizedLead.email);
      }

      createBuffer.push(
        buildLeadRecordData(
          normalizedLead,
          'csv',
          buildImportMetadata(mappedLead),
          isDuplicate ? 'skipped' : 'pending',
          batchId
        )
      );

      processedCount += 1;
      if (isDuplicate) {
        skippedCount += 1;
      } else {
        insertedCount += 1;
      }

      if (createBuffer.length >= 25) {
        const data = createBuffer.splice(0, createBuffer.length);
        await prisma.leadStaging.createMany({ data });
        await updateImportBatchProgress(batchId, {
          processed_count: processedCount,
          inserted_count: insertedCount,
          skipped_count: skippedCount,
        });
      }
    }

    if (createBuffer.length) {
      await prisma.leadStaging.createMany({ data: createBuffer });
    }

    await updateImportBatchProgress(batchId, {
      status: 'completed',
      processed_count: processedCount,
      inserted_count: insertedCount,
      skipped_count: skippedCount,
      finished_at: new Date(),
    });
  } catch (error) {
    await updateImportBatchProgress(batchId, {
      status: 'failed',
      error_message: error.message,
      finished_at: new Date(),
    });
  } finally {
    if (file?.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
}

async function processDispatch(dispatchId, { leadIds, boardId, stepId, assigneeId, priority }) {
  try {
    await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'processing',
        started_at: new Date(),
      },
    });

    const pendingLeads = await prisma.leadStaging.findMany({
      where: {
        id: { in: leadIds },
        status: 'pending',
      },
    });

    const pendingLeadMap = new Map(pendingLeads.map((lead) => [lead.id, lead]));
    const successfulLeadIds = [];
    const errors = [];
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const leadId of leadIds) {
      const lead = pendingLeadMap.get(leadId);

      if (!lead) {
        processedCount += 1;
        failedCount += 1;
        errors.push({
          id: leadId,
          name: 'Lead indisponivel',
          reason: 'Lead nao encontrado no staging pendente.',
        });
      } else {
        try {
          const assigneeIds = assigneeId ? [Number(assigneeId)] : [];
          await chatwootService.createLeadInChatwootFlow(
            buildLeadDataForDispatch(lead),
            boardId,
            stepId,
            assigneeIds,
            priority
          );

          successfulLeadIds.push(lead.id);
          processedCount += 1;
          successCount += 1;
        } catch (err) {
          processedCount += 1;
          failedCount += 1;
          errors.push({
            id: lead.id,
            name: lead.name,
            reason: err.message,
          });
        }
      }

      await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
          processed_count: processedCount,
          success_count: successCount,
          failed_count: failedCount,
          error_details: errors,
        },
      });
    }

    if (successfulLeadIds.length) {
      await prisma.leadStaging.updateMany({
        where: { id: { in: successfulLeadIds } },
        data: { status: 'dispatched' },
      });
    }

    await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        status: failedCount
          ? successCount
            ? 'completed_with_errors'
            : 'failed'
          : 'completed',
        processed_count: processedCount,
        success_count: successCount,
        failed_count: failedCount,
        error_details: errors,
        finished_at: new Date(),
      },
    });
  } catch (error) {
    await prisma.dispatch.update({
      where: { id: dispatchId },
      data: {
        status: 'failed',
        finished_at: new Date(),
        error_details: [{ reason: error.message }],
      },
    });
  }
}

// GET /api/leads/import-batches
router.get('/import-batches', async (_req, res) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    res.json({ success: true, data: batches.map(formatImportBatch) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/leads/import
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo .xlsx ou .csv obrigatorio sob a tag "file"' });
  }

  const clearBeforeImport = normalizeBoolean(req.body?.clearBeforeImport);
  const importName = String(req.body?.listName || '').trim() || deriveBatchName(req.file.originalname);

  try {
    if (clearBeforeImport) {
      await prisma.leadStaging.deleteMany({});
      await prisma.dispatch.deleteMany({});
      await prisma.importBatch.deleteMany({});
    }

    const importBatch = await prisma.importBatch.create({
      data: {
        name: importName,
        source_file: req.file.originalname || null,
        clear_before: clearBeforeImport,
        status: 'queued',
      },
    });

    setImmediate(() => {
      void processImportBatch(importBatch.id, {
        path: req.file.path,
        originalname: req.file.originalname,
      });
    });

    res.json({
      success: true,
      queued: true,
      batch: formatImportBatch(importBatch),
      metrics: {
        inserted: 0,
        skipped: 0,
        ignored: 0,
        located: 0,
        total_rows: 0,
      },
      message: `Importacao ${importBatch.id.slice(0, 8)} enfileirada para processamento.`,
    });
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
    const result = await createStagingLeadFromInput(req.body || {}, 'manual', null, { checkRemoteDuplicates: true });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/leads/staging
router.get('/staging', async (req, res) => {
  try {
    const { status, batchId, page = 1, pageSize = 60 } = req.query;
    const where = {};
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPageSize = Math.min(120, Math.max(1, Number(pageSize) || 60));

    if (status) {
      where.status = status;
    }
    if (batchId) {
      where.batch_id = String(batchId);
    }

    const [total, leads] = await prisma.$transaction([
      prisma.leadStaging.count({ where }),
      prisma.leadStaging.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (parsedPage - 1) * parsedPageSize,
        take: parsedPageSize,
      }),
    ]);

    res.json({
      success: true,
      data: leads.map(formatLeadRecord),
      meta: {
        page: parsedPage,
        pageSize: parsedPageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsedPageSize)),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/leads/reset
router.post('/reset', async (req, res) => {
  const { includeDispatches = true } = req.body || {};

  try {
    await prisma.leadStaging.deleteMany({});
    await prisma.importBatch.deleteMany({});

    if (includeDispatches) {
      await prisma.dispatch.deleteMany({});
    }

    res.json({
      success: true,
      message: includeDispatches
        ? 'Staging, importacoes e historico de lotes limpos.'
        : 'Staging e importacoes limpos.',
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
    batchId,
    amount,
    boardId = commercialConfig.boardId || 5,
    stepId = commercialConfig.stepLeadNovoId || 22,
    assigneeId,
    priority = 'high',
  } = req.body;

  const parsedBoardId = Number(boardId);
  const parsedStepId = Number(stepId);
  const parsedAmount = Math.max(1, Number(amount) || 1);

  if (!Number.isFinite(parsedBoardId) || !Number.isFinite(parsedStepId)) {
    return res.status(400).json({ error: 'boardId e stepId devem ser numeros validos' });
  }

  try {
    let targetLeadIds = Array.isArray(leadIds) ? leadIds.filter(Boolean) : [];

    if (!targetLeadIds.length) {
      const leadsToDispatch = await prisma.leadStaging.findMany({
        where: {
          status: 'pending',
          ...(batchId ? { batch_id: String(batchId) } : {}),
        },
        orderBy: { created_at: 'desc' },
        take: parsedAmount,
        select: { id: true },
      });

      targetLeadIds = leadsToDispatch.map((lead) => lead.id);
    }

    if (!targetLeadIds.length) {
      return res.status(400).json({ error: 'Nenhum lead pendente encontrado para dispatch.' });
    }

    const dispatchEntry = await prisma.dispatch.create({
      data: {
        admin_id: 'auto-ui',
        lead_count: targetLeadIds.length,
        target_board_id: String(parsedBoardId),
        target_step_id: String(parsedStepId),
        target_agent_id: assigneeId ? Number(assigneeId) : null,
        priority,
        status: 'queued',
      },
    });

    setImmediate(() => {
      void processDispatch(dispatchEntry.id, {
        leadIds: targetLeadIds,
        boardId: parsedBoardId,
        stepId: parsedStepId,
        assigneeId,
        priority,
      });
    });

    res.json({
      success: true,
      queued: true,
      dispatch_id: dispatchEntry.id,
      status: dispatchEntry.status,
      message: `Lote ${dispatchEntry.id.split('-')[0]} enfileirado para processamento em segundo plano.`,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
