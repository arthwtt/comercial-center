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

function joinAddress(parts = []) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

function cleanDisplayName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[;,\s]+$/g, '')
    .trim();
}

function hasMultiplePeople(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }

  const separators = normalized.match(/;/g);
  if (separators && separators.length >= 1) {
    return true;
  }

  return /\s+E\s+/i.test(normalized);
}

function mapSpreadsheetLead(row = {}) {
  const lookup = buildLookup(row);

  const socio = getValue(lookup, ['Nome do Sócio', 'Nome do Socio', 'Socio', 'Sócio']);
  const fantasia = getValue(lookup, ['Nome Fantasia', 'Fantasia']);
  const razaoSocial = getValue(lookup, ['Razão Social', 'Razao Social', 'Razão', 'Razao']);
  const cnpj = getValue(lookup, ['CNPJ']);
  const telefone1 = getValue(lookup, ['Telefone 1', 'Telefone1', 'Telefone']);
  const telefone2 = getValue(lookup, ['Telefone 2', 'Telefone2']);
  const email = getValue(lookup, ['E-mail', 'Email']);
  const endereco = joinAddress([
    getValue(lookup, ['Tipo']) || null,
    getValue(lookup, ['Endereço', 'Endereco']) || null,
    getValue(lookup, ['Número', 'Numero']) || null,
    getValue(lookup, ['Complemento']) || null,
  ]);

  const cleanedSocio = cleanDisplayName(socio);
  const cleanedFantasia = cleanDisplayName(fantasia);
  const cleanedRazaoSocial = cleanDisplayName(razaoSocial);
  const displaySocio = hasMultiplePeople(cleanedSocio)
    ? ''
    : cleanedSocio;
  const name = displaySocio || cleanedFantasia || cleanedRazaoSocial || cleanedSocio;
  const phone = normalizePhoneBR(telefone1) || normalizePhoneBR(telefone2);
  const normalizedEmail = normalizeEmail(email);

  return {
    name,
    phone,
    email: normalizedEmail,
    identifier: sanitizeIdentifier(cnpj),
    customAttributes: {
      razao_social: cleanedRazaoSocial || null,
      nome_fantasia: cleanedFantasia || null,
      cnpj: cnpj || null,
      cidade: getValue(lookup, ['Cidade']) || null,
      uf: getValue(lookup, ['UF']) || null,
      bairro: getValue(lookup, ['Bairro']) || null,
      endereco: endereco || null,
      cep: getValue(lookup, ['CEP']) || null,
      site: getValue(lookup, ['Site']) || null,
      ramo_principal: getValue(lookup, ['CNAE Principal']) || null,
      cnae_secundario: getValue(lookup, ['CNAE Secundário', 'CNAE Secundario']) || null,
      porte_empresa: getValue(lookup, ['Porte Empresa']) || null,
      regime_tributario: getValue(lookup, ['Regime Tributário', 'Regime Tributario']) || null,
      faturamento_estimado: getValue(lookup, ['Faturamento Estimado']) || null,
      quadro_funcionarios: getValue(lookup, ['Quantidade Funcionários', 'Quantidade Funcionarios', 'Quadro de Funcionários', 'Quadro de Funcionarios']) || null,
      situacao_cadastral: getValue(lookup, ['Situação Cad.', 'Situacao Cad.']) || null,
      natureza_juridica: getValue(lookup, ['Natureza Jurídica', 'Natureza Juridica']) || null,
      capital_social: getValue(lookup, ['Capital Social da Empresa']) || null,
      matriz_filial: getValue(lookup, ['Matriz/Filial']) || null,
      dividas_federais_ativas: getValue(lookup, ['Dívidas Federais Ativas', 'Dividas Federais Ativas']) || null,
      total_dividas: getValue(lookup, ['Total Dívidas', 'Total Dividas']) || null,
      nome_socio: cleanedSocio || null,
    },
    sourceRow: row,
  };
}

module.exports = {
  mapSpreadsheetLead,
};
