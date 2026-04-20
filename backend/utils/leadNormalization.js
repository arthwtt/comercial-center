function stripNonDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhoneBR(value) {
  const digits = stripNonDigits(value);
  if (!digits) {
    return null;
  }

  let normalized = digits;

  if (normalized.startsWith('55') && normalized.length >= 12) {
    normalized = normalized.slice(2);
  }

  if (normalized.startsWith('0')) {
    normalized = normalized.replace(/^0+/, '');
  }

  if (normalized.length === 10 || normalized.length === 11) {
    return `+55${normalized}`;
  }

  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return `+${digits}`;
  }

  return null;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizeLeadInput(row = {}) {
  const name = String(
    row.name ||
    row.Nome ||
    row.NAME ||
    row.nome ||
    ''
  ).trim();

  const email = normalizeEmail(
    row.email ||
    row.Email ||
    row.EMAIL ||
    null
  );

  const phone = normalizePhoneBR(
    row.phone ||
    row.Phone ||
    row.PHONE ||
    row.telefone ||
    row.Telefone ||
    null
  );

  return {
    name,
    email,
    phone,
    isValid: Boolean(name && (phone || email)),
  };
}

module.exports = {
  normalizePhoneBR,
  normalizeEmail,
  normalizeLeadInput,
};
