#!/bin/bash
# optym-code — FULL installer. One script, zero manual config.
# Run: bash hooks/install.sh
# Windows users: run  node hooks/install.js  instead
set -e

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_DIR/hooks"
SETTINGS="$CLAUDE_DIR/settings.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$HOME/.optym-lite"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Installing optym-code..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 0. Create data dir
mkdir -p "$DATA_DIR"
mkdir -p "$HOOKS_DIR"

# 1. Copy statusline script to stable location
cp "$SCRIPT_DIR/optym-statusline.sh" "$HOOKS_DIR/optym-statusline.sh"
chmod +x "$HOOKS_DIR/optym-statusline.sh"
echo "  ✓ Statusline script installed"

# 2. Initialize routing data
if [ ! -f "$DATA_DIR/routing.json" ]; then
  echo '{"sonnet":0,"opus":0,"haiku":0,"current":"sonnet"}' > "$DATA_DIR/routing.json"
fi

# 3. Wire hooks + statusline into settings.json
if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi
cp "$SETTINGS" "$SETTINGS.bak.optym"

if command -v node >/dev/null 2>&1; then
  OPTYM_SETTINGS="$SETTINGS" OPTYM_PLUGIN_DIR="$PLUGIN_DIR" OPTYM_HOOKS_DIR="$HOOKS_DIR" node -e "
    const fs = require('fs');
    const settings = JSON.parse(fs.readFileSync(process.env.OPTYM_SETTINGS, 'utf8'));
    const pluginDir = process.env.OPTYM_PLUGIN_DIR;
    const hooksDir = process.env.OPTYM_HOOKS_DIR;

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
      console.log('  ✓ SessionStart hook added');
    } else {
      console.log('  ✓ SessionStart hook already exists');
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
      console.log('  ✓ UserPromptSubmit hook added');
    } else {
      console.log('  ✓ UserPromptSubmit hook already exists');
    }

    // Statusline — always set or append
    const statusCmd = 'bash \"' + hooksDir + '/optym-statusline.sh\"';
    if (!settings.statusLine) {
      settings.statusLine = { type: 'command', command: statusCmd };
      console.log('  ✓ Statusline configured');
    } else {
      const existing = settings.statusLine.command || '';
      if (!existing.includes('optym-statusline')) {
        // Create combined script
        const combinedPath = hooksDir + '/combined-statusline.sh';
        const combined = '#!/bin/bash\\n' +
          'OLD=\$(bash -c ' + JSON.stringify(existing) + ' 2>/dev/null)\\n' +
          'OPTYM=\$(bash \"' + hooksDir + '/optym-statusline.sh\" 2>/dev/null)\\n' +
          '[ -n \"\$OLD\" ] && printf \"%s \" \"\$OLD\"\\n' +
          'printf \"%s\" \"\$OPTYM\"\\n';
        require('fs').writeFileSync(combinedPath, combined.replace(/\\\\n/g, '\\n'), { mode: 0o755 });
        settings.statusLine = { type: 'command', command: 'bash \"' + combinedPath + '\"' };
        console.log('  ✓ Statusline combined with existing');
      } else {
        console.log('  ✓ Statusline already configured');
      }
    }

    fs.writeFileSync(process.env.OPTYM_SETTINGS, JSON.stringify(settings, null, 2) + '\\n');
    console.log('  ✓ settings.json updated');
  "
else
  echo "  ✗ Node.js not found — hooks not wired (install node and re-run)"
fi

# 4. Add alias to bashrc/zshrc — model sonnet by default
SHELL_RC="$HOME/.bashrc"
[ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

if ! grep -q 'alias claude.*model sonnet' "$SHELL_RC" 2>/dev/null; then
  echo '' >> "$SHELL_RC"
  echo '# optym-code: Sonnet default, Opus only when needed' >> "$SHELL_RC"
  echo 'alias claude="claude --model sonnet"' >> "$SHELL_RC"
  echo "  ✓ Alias added to $(basename $SHELL_RC) (Sonnet default)"
else
  echo "  ✓ Alias already in $(basename $SHELL_RC)"
fi

# 5. Source rc file
. "$SHELL_RC" 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  optym-code installed!"
echo ""
echo "  Next: restart Claude Code (exit + claude)"
echo ""
echo "  You'll see:"
echo "    S:0% O:0% H:0% optym.pro"
echo "  in statusline. Stats fill as you work."
echo ""
echo "  Commands:"
echo "    /optym-code:optym    — terse mode"
echo "    /optym-code:savings  — savings dashboard"
echo "    /optym-code:upgrade  — Pro info"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
