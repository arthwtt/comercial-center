const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'commercial-mapping.json');

const DEFAULT_CONFIG = {
  boardId: '',
  stepLeadNovoId: '',
  stepQualificadoId: '',
  stepReuniaoAgendadaId: '',
  stepReuniaoRealizadaId: '',
  stepPropostaEnviadaId: '',
  stepVendaFechadaId: '',
  stepPerdidoId: '',
  businessHoursEnabled: true,
  overloadThreshold: 25,
  idleThreshold: 2,
  updatedAt: null,
};

function ensureDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function sanitizeConfig(input = {}) {
  return {
    boardId: String(input.boardId || '').trim(),
    stepLeadNovoId: String(input.stepLeadNovoId || '').trim(),
    stepQualificadoId: String(input.stepQualificadoId || '').trim(),
    stepReuniaoAgendadaId: String(input.stepReuniaoAgendadaId || '').trim(),
    stepReuniaoRealizadaId: String(input.stepReuniaoRealizadaId || '').trim(),
    stepPropostaEnviadaId: String(input.stepPropostaEnviadaId || '').trim(),
    stepVendaFechadaId: String(input.stepVendaFechadaId || '').trim(),
    stepPerdidoId: String(input.stepPerdidoId || '').trim(),
    businessHoursEnabled: input.businessHoursEnabled !== false,
    overloadThreshold: Number(input.overloadThreshold) > 0 ? Number(input.overloadThreshold) : DEFAULT_CONFIG.overloadThreshold,
    idleThreshold: Number(input.idleThreshold) >= 0 ? Number(input.idleThreshold) : DEFAULT_CONFIG.idleThreshold,
    updatedAt: new Date().toISOString(),
  };
}

function readCommercialConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG };
    }

    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    if (!content.trim()) {
      return { ...DEFAULT_CONFIG };
    }

    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch (error) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveCommercialConfig(config) {
  ensureDir();
  const payload = sanitizeConfig(config);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

module.exports = {
  DEFAULT_CONFIG,
  readCommercialConfig,
  saveCommercialConfig,
};
