#!/usr/bin/env node
// optym-code — cross-platform installer (works on Windows, macOS, Linux)
// Usage: node hooks/install.js
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const isWindows = process.platform === 'win32';

const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const hooksDir = path.join(claudeDir, 'hooks');
const settings = path.join(claudeDir, 'settings.json');
const dataDir = process.env.OPTYM_LITE_DIR || path.join(os.homedir(), '.optym-lite');
const pluginDir = path.resolve(__dirname, '..');
const scriptDir = __dirname;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Installing optym-code...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 0. Create data and hooks dirs
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(hooksDir, { recursive: true });

// 1. Copy statusline script (only useful on non-Windows; skip on Windows)
if (!isWindows) {
  const src = path.join(scriptDir, 'optym-statusline.sh');
  const dst = path.join(hooksDir, 'optym-statusline.sh');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, 0o755);
    console.log('  ok Statusline script installed');
  }
} else {
  console.log('  -- Statusline script skipped (Windows: bash not available)');
}

// 2. Initialize routing data
const routingFile = path.join(dataDir, 'routing.json');
if (!fs.existsSync(routingFile)) {
  fs.writeFileSync(routingFile, JSON.stringify({ sonnet: 0, opus: 0, haiku: 0, current: 'sonnet' }, null, 2));
}

// 3. Wire hooks into settings.json
if (!fs.existsSync(settings)) {
  fs.writeFileSync(settings, '{}');
}

// Backup
fs.copyFileSync(settings, settings + '.bak.optym');

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(settings, 'utf8')); } catch {}

if (!cfg.hooks) cfg.hooks = {};

// SessionStart hook
if (!cfg.hooks.SessionStart) cfg.hooks.SessionStart = [];
const hasStart = cfg.hooks.SessionStart.some(e =>
  e.hooks && e.hooks.some(h => h.command && h.command.includes('optym'))
);
if (!hasStart) {
  cfg.hooks.SessionStart.push({
    hooks: [{
      type: 'command',
      command: `node "${path.join(pluginDir, 'hooks', 'optym-activate.js')}"`,
      timeout: 5,
      statusMessage: 'Loading optym-code...',
    }],
  });
  console.log('  ok SessionStart hook added');
} else {
  console.log('  ok SessionStart hook already exists');
}

// UserPromptSubmit hook
if (!cfg.hooks.UserPromptSubmit) cfg.hooks.UserPromptSubmit = [];
const hasPrompt = cfg.hooks.UserPromptSubmit.some(e =>
  e.hooks && e.hooks.some(h => h.command && h.command.includes('optym'))
);
if (!hasPrompt) {
  cfg.hooks.UserPromptSubmit.push({
    hooks: [{
      type: 'command',
      command: `node "${path.join(pluginDir, 'hooks', 'optym-mode-tracker.js')}"`,
      timeout: 5,
      statusMessage: 'optym-code tracking...',
    }],
  });
  console.log('  ok UserPromptSubmit hook added');
} else {
  console.log('  ok UserPromptSubmit hook already exists');
}

// 4. Statusline (non-Windows only)
if (!isWindows) {
  const statuslineScript = path.join(hooksDir, 'optym-statusline.sh');
  const statusCmd = `bash "${statuslineScript}"`;
  if (!cfg.statusLine) {
    cfg.statusLine = { type: 'command', command: statusCmd };
    console.log('  ok Statusline configured');
  } else {
    const existing = cfg.statusLine.command || '';
    if (!existing.includes('optym-statusline')) {
      const combinedPath = path.join(hooksDir, 'combined-statusline.sh');
      const combined = [
        '#!/bin/bash',
        `OLD=$(bash -c ${JSON.stringify(existing)} 2>/dev/null)`,
        `OPTYM=$(bash "${statuslineScript}" 2>/dev/null)`,
        '[ -n "$OLD" ] && printf "%s " "$OLD"',
        'printf "%s" "$OPTYM"',
        '',
      ].join('\n');
      fs.writeFileSync(combinedPath, combined, { mode: 0o755 });
      cfg.statusLine = { type: 'command', command: `bash "${combinedPath}"` };
      console.log('  ok Statusline combined with existing');
    } else {
      console.log('  ok Statusline already configured');
    }
  }
}

fs.writeFileSync(settings, JSON.stringify(cfg, null, 2) + '\n');
console.log('  ok settings.json updated');

// 5. Shell alias — non-Windows only (Windows uses PowerShell, not bash)
if (!isWindows) {
  const homeDir = os.homedir();
  let shellRc = path.join(homeDir, '.bashrc');
  if (fs.existsSync(path.join(homeDir, '.zshrc'))) shellRc = path.join(homeDir, '.zshrc');

  let rcContent = '';
  try { rcContent = fs.readFileSync(shellRc, 'utf8'); } catch {}
  if (!rcContent.includes('alias claude.*model sonnet') && !rcContent.includes('--model sonnet')) {
    fs.appendFileSync(shellRc, [
      '',
      '# optym-code: Sonnet default, Opus only when needed',
      'alias claude="claude --model sonnet"',
      '',
    ].join('\n'));
    console.log(`  ok Alias added to ${path.basename(shellRc)} (Sonnet default)`);
  } else {
    console.log(`  ok Alias already in ${path.basename(shellRc)}`);
  }
} else {
  console.log('  -- Shell alias skipped (Windows: add manually or use PowerShell profile)');
  console.log('     Add to your PowerShell profile: function claude { claude.exe --model sonnet $args }');
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  optym-code installed!');
console.log('');
console.log('  Next: restart Claude Code (exit + claude)');
console.log('');
console.log('  Commands:');
console.log('    /optym-code:optym    -- terse mode');
console.log('    /optym-code:savings  -- savings dashboard');
console.log('    /optym-code:upgrade  -- Pro info');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
