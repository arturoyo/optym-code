'use strict';

const Database = require('better-sqlite3');
const path = require('node:path');
const { getDataDir } = require('./config');

let db = null;

function init(sessionId) {
  const dbPath = path.join(getDataDir(), 'savings.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      session_id TEXT NOT NULL,
      original_model TEXT NOT NULL,
      routed_model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      input_compressed INTEGER,
      output_tokens INTEGER NOT NULL,
      cost_actual REAL NOT NULL,
      cost_original REAL NOT NULL,
      classifier_score REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT DEFAULT (datetime('now')),
      total_requests INTEGER DEFAULT 0,
      total_saved REAL DEFAULT 0
    );
  `);

  db.prepare(`INSERT OR IGNORE INTO sessions (id) VALUES (?)`).run(sessionId);
}

const MODEL_TO_TIER_NAME = {
  'claude-haiku-4-5-20251001': 'haiku',
  'claude-sonnet-4-6': 'sonnet',
  'claude-opus-4-6': 'opus',
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'gpt-4.1': 'gpt-4.1',
  'o3': 'o3',
};

function record(data) {
  const insert = db.prepare(`
    INSERT INTO requests (session_id, original_model, routed_model, input_tokens, input_compressed, output_tokens, cost_actual, cost_original, classifier_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateSession = db.prepare(`
    UPDATE sessions SET total_requests = total_requests + 1, total_saved = total_saved + ? WHERE id = ?
  `);

  const saved = data.costOriginal - data.costActual;

  insert.run(
    data.sessionId, data.originalModel, data.routedModel,
    data.inputTokens, data.inputCompressed, data.outputTokens,
    data.costActual, data.costOriginal, data.classifierScore
  );
  updateSession.run(saved, data.sessionId);
}

function getSessionStats(sessionId) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as requests,
      COALESCE(SUM(cost_original - cost_actual), 0) as savings_usd,
      COALESCE(SUM(cost_original), 0) as total_original,
      COALESCE(SUM(cost_actual), 0) as total_actual
    FROM requests WHERE session_id = ?
  `).get(sessionId);

  const tiers = db.prepare(`
    SELECT routed_model, COUNT(*) as cnt
    FROM requests WHERE session_id = ?
    GROUP BY routed_model
  `).all(sessionId);

  const tierDistribution = { haiku: 0, sonnet: 0, opus: 0, 'gpt-4.1-mini': 0, 'gpt-4.1': 0, 'o3': 0 };
  for (const t of tiers) {
    const name = MODEL_TO_TIER_NAME[t.routed_model] || 'unknown';
    tierDistribution[name] = t.cnt;
  }

  return {
    requests: row.requests,
    savingsUsd: parseFloat(row.savings_usd.toFixed(4)),
    savingsPct: row.total_original > 0
      ? parseFloat(((row.savings_usd / row.total_original) * 100).toFixed(1))
      : 0,
    totalCost: parseFloat(row.total_actual.toFixed(4)),
    tierDistribution,
  };
}

function getAllTimeStats() {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(cost_original - cost_actual), 0) as savings_usd,
      COALESCE(SUM(cost_original), 0) as total_original
    FROM requests
  `).get();

  return {
    totalRequests: row.total_requests,
    savingsUsd: parseFloat(row.savings_usd.toFixed(4)),
    savingsPct: row.total_original > 0
      ? parseFloat(((row.savings_usd / row.total_original) * 100).toFixed(1))
      : 0,
  };
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { init, record, getSessionStats, getAllTimeStats, close };
