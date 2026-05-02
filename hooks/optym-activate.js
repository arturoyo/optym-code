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

// Safety: NEVER auto-set ANTHROPIC_BASE_URL — it breaks subscription auth
// Proxy is only for API key users who explicitly configure it
if (process.env.ANTHROPIC_BASE_URL && process.env.ANTHROPIC_BASE_URL.includes('localhost')) {
  // Warn but don't modify — user may have set it intentionally for API key use
}

let proxyStatus = '';
// Don't auto-start proxy — subscription users don't need it
// Proxy is opt-in via: optym-code start + export ANTHROPIC_BASE_URL=...

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

Respond concisely. Keep all technical substance. Cut filler, pleasantries, and unnecessary words.

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

Code/commits/PRs: write normal. "stop optym" or "normal mode": revert.

## OPTYM Smart Routing (IMPORTANT)

You are running on Sonnet by default to save Opus quota. This is intentional.
Sonnet handles 70-80% of coding tasks perfectly. Opus quota is precious — save it for what matters.

**When you see "OPTYM-ESCALATE" in the context:**
1. The task needs Opus-level reasoning (architecture, complex debug, multi-file refactor)
2. Use the Agent tool with model='opus' to dispatch the task
3. Pass the user's FULL prompt + relevant context as the agent's task
4. Show the Opus subagent's response to the user

**When there is NO OPTYM-ESCALATE instruction:**
- Handle the task yourself on Sonnet — you are more than capable
- Do NOT escalate to Opus unless explicitly asked by the user

**Always escalate when:**
- User explicitly says "use opus" or "esto necesita opus"
- Task involves designing system architecture from scratch
- Complex multi-file debugging with unclear root cause
- Creative writing or nuanced analysis

**Never escalate when:**
- Reading files, git operations, simple questions
- Writing/editing code with clear requirements
- Explaining code, running commands
- Most everyday coding tasks

This maximizes session capacity: Sonnet quota is underused, Opus quota runs out fast.`;

process.stdout.write(output);
