#!/bin/bash
# optym-code — statusline badge for Claude Code
# Shows terse mode + quota savings estimate

FLAG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.optym-active"
COUNTER_FILE="${HOME}/.optym-lite/routing.json"

# Read terse mode
MODE=""
if [ -f "$FLAG" ] && [ ! -L "$FLAG" ]; then
  MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr -cd 'a-z0-9-')
  case "$MODE" in
    off|lite|full|ultra) ;;
    *) MODE="" ;;
  esac
fi

# Read routing stats
SONNET=0
OPUS=0
if [ -f "$COUNTER_FILE" ] && [ ! -L "$COUNTER_FILE" ]; then
  SONNET=$(head -c 256 "$COUNTER_FILE" 2>/dev/null | grep -o '"sonnet": *[0-9]*' | sed 's/.*: *//')
  OPUS=$(head -c 256 "$COUNTER_FILE" 2>/dev/null | grep -o '"opus": *[0-9]*' | sed 's/.*: *//')
fi

TOTAL=$((${SONNET:-0} + ${OPUS:-0}))
SAVED_PCT=0
if [ "$TOTAL" -gt 0 ]; then
  SAVED_PCT=$(( (${SONNET:-0} * 100) / $TOTAL ))
fi

# Build badge
BADGE="OPTYM"
if [ -n "$MODE" ] && [ "$MODE" != "full" ]; then
  SUFFIX=$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')
  BADGE="OPTYM:${SUFFIX}"
fi

# Show quota saved
if [ "$TOTAL" -gt 0 ]; then
  printf '\033[38;5;39m[%s ↓%s%% opus]\033[0m' "$BADGE" "$SAVED_PCT"
else
  printf '\033[38;5;39m[%s]\033[0m' "$BADGE"
fi
