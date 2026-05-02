#!/usr/bin/env node
// optym-code — SessionStart hook
// 1. Writes mode to flag file (statusline reads this)
// 2. Emits terse ruleset as hidden context
// 3. Starts proxy if not running

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.optym-active');
const dataDir = process.env.OPTYM_LITE_DIR || path.join(os.homedir(), '.optym-lite');

// Safe flag write (no symlinks)
function safeWriteFlag(p, content) {
  try {
    if (fs.lstatSync(p).isSymbolicLink()) return;
  } catch {}
  try {
    const tmp = p + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, content, { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch {}
}

// Determine mode
const mode = process.env.OPTYM_MODE || 'full';
if (mode === 'off') {
  try { fs.unlinkSync(flagPath); } catch {}
  process.stdout.write('OK');
  process.exit(0);
}

safeWriteFlag(flagPath, mode);

// Auto-start proxy if not running
const pidFile = path.join(dataDir, 'proxy.pid');
let proxyRunning = false;
try {
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    process.kill(pid, 0); // test if alive
    proxyRunning = true;
  }
} catch {}

let proxyStatus = '';
if (!proxyRunning) {
  try {
    execSync('optym-code start &', { stdio: 'ignore', timeout: 5000 });
    proxyStatus = ' Proxy auto-started on :8088.';
  } catch {
    proxyStatus = ' Proxy not running — start with: optym-code start';
  }
}

// Read savings for context
let savingsInfo = '';
try {
  const statsPath = path.join(dataDir, 'stats.json');
  if (fs.existsSync(statsPath)) {
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    if (stats.alltime && stats.alltime.savings_pct > 0) {
      savingsInfo = ` All-time savings: ${stats.alltime.savings_pct}% ($${stats.alltime.savings_usd.toFixed(2)}).`;
    }
  }
} catch {}

// Emit terse rules
const TERSE_RULES = {
  lite: 'No filler/hedging. Keep articles + full sentences. Professional but tight.',
  full: 'Drop articles/filler/pleasantries/hedging. Fragments OK. Short synonyms. Code/commits/security: write normal.',
  ultra: 'Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows (X → Y), one word when one word enough. Code normal.',
};

const rules = TERSE_RULES[mode] || TERSE_RULES.full;

const output = `OPTYM-CODE ACTIVE — terse level: ${mode}.${proxyStatus}${savingsInfo}

Respond terse like smart engineer. All technical substance stays. Only fluff dies.

## Persistence

ACTIVE EVERY RESPONSE. No revert after many turns. Off only: "stop optym" / "normal mode".

Default: **${mode}**. Switch: \`/optym lite|full|ultra\`.

## Rules

${rules}

Pattern: \`[thing] [action] [reason]. [next step].\`

Not: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Yes: "Bug in auth middleware. Token expiry check use \`<\` not \`<=\`. Fix:"

## Auto-Clarity

Drop terse for: security warnings, irreversible actions, multi-step where fragment order risks misread. Resume after.

## Boundaries

Code/commits/PRs: write normal. "stop optym" or "normal mode": revert.`;

process.stdout.write(output);
