#!/bin/bash
# optym-code — statusline badge for Claude Code
# Shows terse mode + savings % from proxy

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.optym-active"
STATS_FILE="${HOME}/.optym-lite/stats.json"

# Read terse mode
MODE=""
if [ -f "$FLAG" ] && [ ! -L "$FLAG" ]; then
  MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr -cd 'a-z0-9-')
  case "$MODE" in
    off|lite|full|ultra) ;;
    *) MODE="" ;;
  esac
fi

# Read savings
SAVINGS_PCT=""
if [ -f "$STATS_FILE" ] && [ ! -L "$STATS_FILE" ]; then
  SAVINGS_PCT=$(head -c 512 "$STATS_FILE" 2>/dev/null | grep -o '"savings_pct": *[0-9.]*' | head -1 | sed 's/.*: *//')
fi

# Build badge
BADGE="OPTYM"

# Add mode suffix if not default full
if [ -n "$MODE" ] && [ "$MODE" != "full" ]; then
  SUFFIX=$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')
  BADGE="OPTYM:${SUFFIX}"
fi

# Add savings
if [ -n "$SAVINGS_PCT" ] && [ "$SAVINGS_PCT" != "0" ]; then
  printf '\033[38;5;39m[%s ↓%s%%]\033[0m' "$BADGE" "$SAVINGS_PCT"
else
  printf '\033[38;5;39m[%s]\033[0m' "$BADGE"
fi
