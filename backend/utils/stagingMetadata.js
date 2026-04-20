const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE_PATH = path.join(DATA_DIR, 'staging-metadata.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return {};
    }

    const content = fs.readFileSync(FILE_PATH, 'utf8');
    return content.trim() ? JSON.parse(content) : {};
  } catch (_error) {
    return {};
  }
}

function writeStore(store) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function saveLeadMetadata(leadId, metadata) {
  const store = readStore();
  store[String(leadId)] = metadata;
  writeStore(store);
}

function getLeadMetadata(leadId) {
  const store = readStore();
  return store[String(leadId)] || null;
}

module.exports = {
  saveLeadMetadata,
  getLeadMetadata,
};
