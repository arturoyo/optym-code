'use strict';

let lastNudgeAt = 0;

function formatFooter(sessionStats, proMode) {
  const pct = sessionStats.savingsPct || 0;
  const usd = (sessionStats.savingsUsd || 0).toFixed(2);

  if (proMode) {
    return ` optym PRO: savings ${pct}% ($${usd} saved) | optym.pro/dashboard`;
  }
  return ` optym-lite: savings ${pct}% ($${usd} saved) | optym.pro`;
}

function shouldShowNudge(totalRequests, nudgeInterval) {
  if (nudgeInterval <= 0) return false;
  if (totalRequests > 0 && totalRequests % nudgeInterval === 0 && totalRequests !== lastNudgeAt) {
    lastNudgeAt = totalRequests;
    return true;
  }
  return false;
}

function formatNudge(savingsPct, savingsUsd) {
  return [
    '----------------------------------------------',
    ` This session: ${savingsPct}% savings with basic routing`,
    ' Optym Pro averages 50% with ML + cache + healing',
    ' optym.pro/upgrade | 14-day free trial',
    '----------------------------------------------',
  ].join('\n');
}

function resetNudgeState() {
  lastNudgeAt = 0;
}

module.exports = { formatFooter, shouldShowNudge, formatNudge, resetNudgeState };
