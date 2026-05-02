#!/bin/bash
# optym-code — Claude Code plugin installer
# Installs hooks + statusline + proxy dependencies
set -e

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"

echo "Installing optym-code..."

# 1. Install npm dependencies for proxy
if [ -f "$PLUGIN_DIR/package.json" ]; then
  cd "$PLUGIN_DIR" && npm install --production 2>/dev/null
  echo "  Dependencies installed"
fi

# 2. Copy statusline script
mkdir -p "$HOOKS_DIR"
cp "$SCRIPT_DIR/../hooks/optym-statusline.sh" "$HOOKS_DIR/optym-statusline.sh" 2>/dev/null || true
chmod +x "$HOOKS_DIR/optym-statusline.sh" 2>/dev/null || true

# 3. Link CLI globally
cd "$PLUGIN_DIR" && npm link 2>/dev/null
echo "  CLI linked: optym-code"

# 4. Wire hooks into settings.json
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

if command -v node >/dev/null 2>&1; then
  OPTYM_SETTINGS="$SETTINGS" OPTYM_PLUGIN_DIR="$PLUGIN_DIR" node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync(process.env.OPTYM_SETTINGS, 'utf8'));
    const pluginDir = process.env.OPTYM_PLUGIN_DIR;

    if (!settings.hooks) settings.hooks = {};

    // SessionStart hook
    if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
    const hasStart = settings.hooks.SessionStart.some(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('optym'))
    );
    if (!hasStart) {
      settings.hooks.SessionStart.push({
        hooks: [{
          type: 'command',
          command: 'node \"' + pluginDir + '/hooks/optym-activate.js\"',
          timeout: 5,
          statusMessage: 'Loading optym-code...'
        }]
      });
    }

    // UserPromptSubmit hook
    if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
    const hasPrompt = settings.hooks.UserPromptSubmit.some(e =>
      e.hooks && e.hooks.some(h => h.command && h.command.includes('optym'))
    );
    if (!hasPrompt) {
      settings.hooks.UserPromptSubmit.push({
        hooks: [{
          type: 'command',
          command: 'node \"' + pluginDir + '/hooks/optym-mode-tracker.js\"',
          timeout: 5,
          statusMessage: 'optym-code tracking...'
        }]
      });
    }

    // Statusline
    const hooksDir = (process.env.CLAUDE_CONFIG_DIR || require('os').homedir() + '/.claude') + '/hooks';
    if (!settings.statusLine) {
      settings.statusLine = {
        type: 'command',
        command: 'bash \"' + hooksDir + '/optym-statusline.sh\"'
      };
      console.log('  Statusline configured.');
    } else {
      console.log('  Statusline exists — add optym-statusline.sh manually if needed.');
    }

    fs.writeFileSync(process.env.OPTYM_SETTINGS, JSON.stringify(settings, null, 2) + '\n');
    console.log('  Hooks wired in settings.json');
  "
fi

# 5. Add ANTHROPIC_BASE_URL to .bashrc if not present
if ! grep -q 'ANTHROPIC_BASE_URL' "$HOME/.bashrc" 2>/dev/null; then
  echo '' >> "$HOME/.bashrc"
  echo '# optym-code: route Claude requests through optimization proxy' >> "$HOME/.bashrc"
  echo 'export ANTHROPIC_BASE_URL=http://localhost:8088' >> "$HOME/.bashrc"
  echo "  Added ANTHROPIC_BASE_URL to .bashrc"
fi

# 6. Start proxy
optym-code start &>/dev/null &
echo "  Proxy started on :8088"

echo ""
echo "Done! Restart Claude Code to activate."
echo ""
echo "What's installed:"
echo "  - Smart model routing (Haiku/Sonnet/Opus by complexity)"
echo "  - Terse mode (/optym lite|full|ultra)"
echo "  - Savings tracking (/savings)"
echo "  - Statusline badge [OPTYM]"
echo "  - Proxy on localhost:8088"
