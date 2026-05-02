'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getDataDir } = require('./config');

function writeStats(sessionStats, allTimeStats) {
  const statsPath = path.join(getDataDir(), 'stats.json');
  const data = {
    session: {
      requests: sessionStats.requests,
      savings_pct: sessionStats.savingsPct,
      savings_usd: sessionStats.savingsUsd,
      tier_distribution: sessionStats.tierDistribution,
    },
    alltime: {
      savings_usd: allTimeStats.savingsUsd,
      savings_pct: allTimeStats.savingsPct,
    },
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(statsPath, JSON.stringify(data, null, 2));
}

function readStats() {
  const statsPath = path.join(getDataDir(), 'stats.json');
  if (!fs.existsSync(statsPath)) return null;
  return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}

module.exports = { writeStats, readStats };
