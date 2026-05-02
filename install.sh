#!/bin/bash
# optym-code — ONE command installer
# Usage: curl -s https://raw.githubusercontent.com/arturoyo/optym-code/master/install.sh | bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  optym-code installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
INSTALL_DIR="$CLAUDE_DIR/plugins/marketplaces/optym-code"

# 1. Clone or update repo
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  Updating existing install..."
  cd "$INSTALL_DIR" && git pull -q
else
  echo "  Cloning optym-code..."
  git clone -q https://github.com/arturoyo/optym-code.git "$INSTALL_DIR"
fi

# 2. Run full install
cd "$INSTALL_DIR" && bash hooks/install.sh

echo ""
echo "  Now restart Claude Code: exit + claude"
echo ""
