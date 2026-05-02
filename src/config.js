'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULTS = {
  port: 8088,
  nudgeInterval: 20,
  nudgeEnabled: true,
  silent: false,
  defaultTier: null,
  upstream: 'https://api.anthropic.com',
  proUpstream: 'https://api.optym.pro',
};

function getDataDir() {
  const dir = process.env.OPTYM_LITE_DIR || path.join(os.homedir(), '.optym-lite');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function configPath() {
  return path.join(getDataDir(), 'config.json');
}

function load() {
  let stored = {};
  const cfgPath = configPath();
  if (fs.existsSync(cfgPath)) {
    stored = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }

  const proKey = process.env.OPTYM_PRO_KEY || null;

  return {
    ...DEFAULTS,
    ...stored,
    proMode: !!proKey,
    proKey,
  };
}

function save(overrides) {
  const cfgPath = configPath();
  let existing = {};
  if (fs.existsSync(cfgPath)) {
    existing = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
  const merged = { ...existing, ...overrides };
  delete merged.proMode;
  delete merged.proKey;
  fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2));
}

module.exports = { load, save, getDataDir, DEFAULTS };
