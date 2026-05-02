#!/usr/bin/env node
// optym-code — UserPromptSubmit hook
// 1. Tracks mode changes
// 2. Classifies prompt complexity
// 3. Injects routing instruction (dispatch to cheaper subagent)
// 4. Per-turn terse reinforcement

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.optym-active');
const dataDir = process.env.OPTYM_LITE_DIR || path.join(os.homedir(), '.optym-lite');
const routingFile = path.join(dataDir, 'routing.json');

function safeWriteFlag(p, content) {
  try { if (fs.lstatSync(p).isSymbolicLink()) return; } catch {}
  try {
    const tmp = p + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, content, { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch {}
}

function readFlag(p) {
  try {
    if (fs.lstatSync(p).isSymbolicLink()) return null;
    const content = fs.readFileSync(p, 'utf8').trim().slice(0, 64).replace(/[^a-z0-9-]/g, '');
    const valid = ['off', 'lite', 'full', 'ultra'];
    return valid.includes(content) ? content : null;
  } catch { return null; }
}

// Lightweight classifier (same logic as proxy classifier)
const HAIKU_PATTERNS = [
  /^(hi|hello|hey|yes|no|ok|okay|thanks|thank you|gracias|sí|vale|sure|yep|nope)[\s!?.]*$/i,
  /^(what|where|when|who|how many|how much|qué|dónde|cuándo|quién)\b/i,
  /\b(git status|git log|git diff|git branch|commit message|git show)\b/i,
  /\b(read|show|cat|print|display|muestra|lee|list)\s+(the\s+)?(file|content|code|output)/i,
  /\bwhat does this error mean\b/i,
  /^(run|execute|check|verify|test)\s/i,
];

const OPUS_PATTERNS = [
  /\b(architect|design|redesign|refactor|restructur|rediseñ)/i,
  /\b(debug|troubleshoot)\b.*\b(fail|crash|broken|not work|error|issue)/i,
  /\bwhy\b.*\b(fail|crash|broken|not work|error)/i,
  /\b(across|multiple files|all files|every file|todos los archivos|entire codebase)/i,
  /\b(write a|create a|build a|implement|genera|crea|construye)\b/i,
  /\b(explain|compare|analyze|evalua|analiz).*\b(detail|depth|thorough|comprehensive)/i,
  /\b(migrate|migration|convert|transform)\b.*\b(from|to|into)\b/i,
];

function classifyLocal(text) {
  text = (text || '').trim();

  let haikuHits = 0;
  for (const p of HAIKU_PATTERNS) {
    if (p.test(text)) haikuHits++;
  }

  let opusHits = 0;
  for (const p of OPUS_PATTERNS) {
    if (p.test(text)) opusHits++;
  }

  if (opusHits > 0 || text.length > 2000) return 'opus';
  if (haikuHits > 0 && text.length < 200) return 'haiku';
  if (haikuHits > 0) return 'sonnet';
  return 'sonnet';
}

function classifyPro(text) {
  // Call api.optym.pro/v1/classify for ML classification
  const proKey = process.env.OPTYM_PRO_KEY;
  if (!proKey) return null;

  try {
    const https = require('https');
    return new Promise((resolve) => {
      const data = JSON.stringify({
        prompt: text.slice(0, 4000),
        provider: 'anthropic',
      });

      const req = https.request({
        hostname: 'api.optym.pro',
        port: 443,
        path: '/v1/classify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proKey}`,
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 2000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.tier || null);
          } catch { resolve(null); }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(data);
      req.end();
    });
  } catch { return null; }
}

async function classifyPrompt(text) {
  // Try Pro (ML) first, fallback to local (regex)
  const proResult = await classifyPro(text);
  if (proResult) return proResult;
  return classifyLocal(text);
}

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim();
    const promptLower = prompt.toLowerCase();

    // /optym commands
    if (promptLower.startsWith('/optym')) {
      const parts = promptLower.split(/\s+/);
      const arg = parts[1] || '';

      let mode = null;
      if (arg === 'lite') mode = 'lite';
      else if (arg === 'ultra') mode = 'ultra';
      else if (arg === 'off') mode = 'off';
      else mode = 'full';

      if (mode && mode !== 'off') {
        safeWriteFlag(flagPath, mode);
      } else if (mode === 'off') {
        try { fs.unlinkSync(flagPath); } catch {}
      }
    }

    // Natural language activation
    if (/\b(activate|enable|turn on|start)\b.*\boptym\b/i.test(promptLower) ||
        /\boptym\b.*\b(mode|activate|enable)\b/i.test(promptLower)) {
      if (!/\b(stop|disable|turn off)\b/i.test(promptLower)) {
        safeWriteFlag(flagPath, 'full');
      }
    }

    // Deactivation
    if (/\b(stop|disable|turn off)\b.*\boptym\b/i.test(promptLower) ||
        /\boptym\b.*\b(stop|disable|turn off)\b/i.test(promptLower) ||
        /\bnormal mode\b/i.test(promptLower)) {
      try { fs.unlinkSync(flagPath); } catch {}
    }

    // Build output
    const activeMode = readFlag(flagPath);
    let additionalContext = '';

    if (activeMode) {
      additionalContext = "OPTYM-CODE ACTIVE (" + activeMode + "). " +
        "Drop articles/filler/pleasantries/hedging. Fragments OK. " +
        "Code/commits/security: write normal.";
    }

    // Classify and inject routing instruction
    // Default model is now Sonnet. Only escalate to Opus when needed.
    const isCommand = promptLower.startsWith('/');
    const isTooShort = prompt.length < 5;
    const isConfirmation = /^(si|sí|yes|ok|vale|no|nah|nope)[\s!?.]*$/i.test(prompt);

    if (!isCommand && !isTooShort && !isConfirmation) {
      const tier = await classifyPrompt(prompt);

      // Track routing decision + current model
      try {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        let routing = { sonnet: 0, opus: 0, haiku: 0, current: 'sonnet' };
        try { routing = JSON.parse(fs.readFileSync(routingFile, 'utf8')); } catch {}
        routing[tier] = (routing[tier] || 0) + 1;
        routing.current = tier;
        fs.writeFileSync(routingFile, JSON.stringify(routing, null, 2));
      } catch {}

      if (tier === 'opus') {
        additionalContext += "\n\nOPTYM-ESCALATE: This prompt requires high complexity reasoning. " +
          "Dispatch to an Opus subagent using: Agent tool with model='opus'. " +
          "Pass the user's FULL prompt as the subagent's task. " +
          "Include relevant conversation context if the prompt references prior work. " +
          "Show the subagent's response directly to the user.";
      }
      // sonnet/haiku → handle normally (already running on Sonnet)
    }

    if (additionalContext) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: additionalContext.trim()
        }
      }));
    }
  } catch {}
});
