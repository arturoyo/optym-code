#!/usr/bin/env node
// optym-code — UserPromptSubmit hook
// Tracks mode changes + emits per-turn terse reinforcement

const fs = require('fs');
const path = require('path');
const os = require('os');

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const flagPath = path.join(claudeDir, '.optym-active');

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

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim().toLowerCase();

    // /optym commands
    if (prompt.startsWith('/optym')) {
      const parts = prompt.split(/\s+/);
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
    if (/\b(activate|enable|turn on|start)\b.*\boptym\b/i.test(prompt) ||
        /\boptym\b.*\b(mode|activate|enable)\b/i.test(prompt)) {
      if (!/\b(stop|disable|turn off)\b/i.test(prompt)) {
        safeWriteFlag(flagPath, 'full');
      }
    }

    // Deactivation
    if (/\b(stop|disable|turn off)\b.*\boptym\b/i.test(prompt) ||
        /\boptym\b.*\b(stop|disable|turn off)\b/i.test(prompt) ||
        /\bnormal mode\b/i.test(prompt)) {
      try { fs.unlinkSync(flagPath); } catch {}
    }

    // Per-turn reinforcement
    const activeMode = readFlag(flagPath);
    if (activeMode) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "OPTYM-CODE ACTIVE (" + activeMode + "). " +
            "Drop articles/filler/pleasantries/hedging. Fragments OK. " +
            "Code/commits/security: write normal."
        }
      }));
    }
  } catch {}
});
