const { normalizeEmail, normalizePhoneBR } = require('./leadNormalization');

function normalizeKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function buildLookup(row = {}) {
  return Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});
}

function getValue(lookup, keys) {
  for (const key of keys) {
    const value = lookup[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function sanitizeIdentifier(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || null;
}

function mapSpreadsheetLead(row = {}) {
  const lookup = buildLookup(row);

  const socio = getValue(lookup, ['Nome do Sócio', 'Nome do Socio', 'Socio', 'Sócio']);
  const fantasia = getValue(lookup, ['Nome Fantasia', 'Fantasia']);
  const razaoSocial = getValue(lookup, ['Razão Social', 'Razao Social']);
  const cnpj = getValue(lookup, ['CNPJ']);
  const telefone1 = getValue(lookup, ['Telefone 1', 'Telefone1', 'Telefone']);
  const telefone2 = getValue(lookup, ['Telefone 2', 'Telefone2']);
  const email = getValue(lookup, ['E-mail', 'Email']);

  const name = socio || fantasia || razaoSocial;
  const phone = normalizePhoneBR(telefone1) || normalizePhoneBR(telefone2);
  const normalizedEmail = normalizeEmail(email);

  return {
    name,
    phone,
    email: normalizedEmail,
    identifier: sanitizeIdentifier(cnpj),
    customAttributes: {
      razao_social: razaoSocial || null,
      nome_fantasia: fantasia || null,
      cnpj: cnpj || null,
      cidade: getValue(lookup, ['Cidade']) || null,
      uf: getValue(lookup, ['UF']) || null,
      bairro: getValue(lookup, ['Bairro']) || null,
      ramo_principal: getValue(lookup, ['CNAE Principal']) || null,
      porte_empresa: getValue(lookup, ['Porte Empresa']) || null,
      regime_tributario: getValue(lookup, ['Regime Tributário', 'Regime Tributario']) || null,
      faturamento_estimado: getValue(lookup, ['Faturamento Estimado']) || null,
      quadro_funcionarios: getValue(lookup, ['Quantidade Funcionários', 'Quantidade Funcionarios']) || null,
      nome_socio: socio || null,
    },
    sourceRow: row,
  };
}

module.exports = {
  mapSpreadsheetLead,
};
