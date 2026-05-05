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
    try {
      fs.renameSync(tmp, p);
    } catch {
      // Windows: renameSync throws EPERM if destination exists — fall back to direct write
      try { fs.unlinkSync(tmp); } catch {}
      fs.writeFileSync(p, content);
    }
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

// Auto-configure statusline if not set
try {
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const currentCmd = settings.statusLine?.command || '';
    if (!currentCmd.includes('optym-statusline')) {
      // Find the statusline script — check plugin cache and marketplace locations
      let scriptPath = '';
      const locations = [
        path.join(__dirname, 'optym-statusline.sh'),
        path.join(claudeDir, 'hooks', 'optym-statusline.sh'),
        path.join(claudeDir, 'plugins', 'marketplaces', 'optym-code', 'hooks', 'optym-statusline.sh'),
      ];
      for (const loc of locations) {
        if (fs.existsSync(loc)) { scriptPath = loc; break; }
      }

      // Also check plugin cache (where claude plugin install puts files)
      if (!scriptPath) {
        try {
          const cacheDir = path.join(claudeDir, 'plugins', 'cache', 'optym-code');
          const entries = fs.readdirSync(cacheDir, { recursive: true });
          for (const e of entries) {
            if (e.toString().endsWith('optym-statusline.sh')) {
              scriptPath = path.join(cacheDir, e.toString());
              break;
            }
          }
        } catch {}
      }

      if (scriptPath) {
        // Copy to hooks dir for stable path
        const hooksDir = path.join(claudeDir, 'hooks');
        if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
        const stablePath = path.join(hooksDir, 'optym-statusline.sh');
        if (!fs.existsSync(stablePath)) {
          fs.copyFileSync(scriptPath, stablePath);
          fs.chmodSync(stablePath, 0o755);
        }

        if (currentCmd) {
          // Existing statusline — create combined script
          const combinedPath = path.join(hooksDir, 'combined-statusline.sh');
          if (!fs.existsSync(combinedPath)) {
            const combined = `#!/bin/bash\n# Combined statusline\nOLD=$(${currentCmd} 2>/dev/null)\nOPTYM=$(bash "${stablePath}" 2>/dev/null)\n[ -n "$OLD" ] && printf '%s ' "$OLD"\nprintf '%s' "$OPTYM"\n`;
            fs.writeFileSync(combinedPath, combined, { mode: 0o755 });
          }
          settings.statusLine = { type: 'command', command: `bash "${combinedPath}"` };
        } else {
          settings.statusLine = { type: 'command', command: `bash "${stablePath}"` };
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      }
    }
  }
} catch {
  // Never block session start over statusline
}

// First-run onboarding
const onboardFile = path.join(dataDir, 'onboarded');
let isFirstRun = false;
try {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(onboardFile)) {
    isFirstRun = true;
    fs.writeFileSync(onboardFile, new Date().toISOString());
  }
} catch {}

let onboardMsg = '';
if (isFirstRun) {
  onboardMsg = `

## Welcome to optym-code!

You are now saving Opus quota automatically. Here's what's active:

- **Smart routing** — running on Sonnet by default, Opus only when needed
- **Terse mode** — concise responses, less token waste
- **Savings tracking** — check statusline for live stats

Commands: /optym-code:optym (terse levels) | /optym-code:savings | /optym-code:upgrade

Show this welcome message to the user on their first interaction.
After showing it, proceed normally with their request.`;
}

// optym.pro platform nudge — every 20 sessions, for users building LLM apps
const sessionCountFile = path.join(dataDir, 'session_count');
let sessionCount = 0;
try { sessionCount = parseInt(fs.readFileSync(sessionCountFile, 'utf8') || '0'); } catch {}
sessionCount++;
try { fs.writeFileSync(sessionCountFile, sessionCount.toString()); } catch {}

let platformNudge = '';
if (sessionCount % 20 === 0) {
  platformNudge = `\n\n> 💡 **optym.pro** — building apps that call LLMs?\n` +
    `> Cache · Compress · Route · Calibrate — works with any AI (OpenAI, Anthropic, Gemini...)\n` +
    `> Up to 85% cheaper. Drop-in OpenAI-compatible endpoint. → **optym.pro**`;
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

const output = `OPTYM-CODE ACTIVE — terse level: ${mode}.${savingsInfo}${onboardMsg}${platformNudge}

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

// Anonymous telemetry ping (once per day, non-blocking)
try {
  const idFile = path.join(dataDir, 'install_id');
  const lastPingFile = path.join(dataDir, 'last_ping');
  const routingFile = path.join(dataDir, 'routing.json');

  // Generate or read anonymous UUID
  let installId;
  try {
    installId = fs.readFileSync(idFile, 'utf8').trim();
  } catch {
    installId = 'anon_' + require('crypto').randomBytes(12).toString('hex');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(idFile, installId);
  }

  // Check opt-out
  const configFile = path.join(dataDir, 'config.json');
  let telemetryEnabled = true;
  try {
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (cfg.telemetry === false) telemetryEnabled = false;
  } catch {}

  // Check if already pinged today
  let lastPing = 0;
  try { lastPing = parseInt(fs.readFileSync(lastPingFile, 'utf8')); } catch {}
  const oneDayMs = 86400000;
  const now = Date.now();

  if (telemetryEnabled && (now - lastPing > oneDayMs)) {
    // Read routing stats
    let routing = { sonnet: 0, opus: 0, haiku: 0 };
    try { routing = JSON.parse(fs.readFileSync(routingFile, 'utf8')); } catch {}

    // Count sessions
    let sessionCount = 0;
    try {
      const sc = path.join(dataDir, 'session_count');
      sessionCount = parseInt(fs.readFileSync(sc, 'utf8') || '0') + 1;
      fs.writeFileSync(sc, sessionCount.toString());
    } catch {
      fs.writeFileSync(path.join(dataDir, 'session_count'), '1');
      sessionCount = 1;
    }

    // Calculate savings
    const total = (routing.sonnet || 0) + (routing.opus || 0) + (routing.haiku || 0);
    let savingsPct = 0;
    if (total > 0) {
      const actual = ((routing.opus || 0) * 500) + ((routing.sonnet || 0) * 100) + ((routing.haiku || 0) * 20);
      savingsPct = Math.min(95, 100 - Math.round((actual * 100) / (total * 500)) + 15);
    }

    const payload = JSON.stringify({
      id: installId,
      v: '0.2.0',
      mode: process.env.OPTYM_PRO_KEY ? 'pro' : 'free',
      platform: process.platform,
      sonnet: routing.sonnet || 0,
      opus: routing.opus || 0,
      haiku: routing.haiku || 0,
      savings_pct: savingsPct,
      escalations: routing.opus || 0,
      terse_level: mode,
      session_count: sessionCount,
      days_active: lastPing === 0 ? 1 : Math.max(1, Math.round((now - lastPing) / oneDayMs)),
    });

    // Fire and forget — never block session start
    const https = require('https');
    const req = https.request({
      hostname: 'api.optym.pro',
      port: 443,
      path: '/v1/telemetry',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 3000,
    });
    req.on('error', () => {}); // silent fail
    req.on('timeout', () => req.destroy());
    req.write(payload);
    req.end();

    // Mark pinged
    fs.writeFileSync(lastPingFile, now.toString());
  }
} catch {
  // Never let telemetry crash session start
}
