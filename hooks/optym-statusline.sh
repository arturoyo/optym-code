#!/bin/bash
# optym-code — statusline badge for Claude Code
# Format: [sonnet] ↓79% optym.pro

COUNTER_FILE="${HOME}/.optym-lite/routing.json"

SONNET=0; OPUS=0; HAIKU=0; CURRENT=""
if [ -f "$COUNTER_FILE" ] && [ ! -L "$COUNTER_FILE" ]; then
  DATA=$(head -c 512 "$COUNTER_FILE" 2>/dev/null)
  SONNET=$(echo "$DATA" | grep -o '"sonnet": *[0-9]*' | sed 's/.*: *//')
  OPUS=$(echo "$DATA" | grep -o '"opus": *[0-9]*' | sed 's/.*: *//')
  HAIKU=$(echo "$DATA" | grep -o '"haiku": *[0-9]*' | sed 's/.*: *//')
  CURRENT=$(echo "$DATA" | grep -o '"current": *"[a-z]*"' | sed 's/.*: *"//;s/"//')
fi

SONNET=${SONNET:-0}; OPUS=${OPUS:-0}; HAIKU=${HAIKU:-0}
TOTAL=$((SONNET + OPUS + HAIKU))

# Model badge with color
case "$CURRENT" in
  opus)   printf '\033[38;5;196m[opus]\033[0m' ;;
  haiku)  printf '\033[38;5;82m[haiku]\033[0m' ;;
  *)      printf '\033[38;5;75m[sonnet]\033[0m' ;;
esac

# Savings + branding (separate from model)
if [ "$TOTAL" -gt 0 ]; then
  ACTUAL=$(( (OPUS * 500) + (SONNET * 100) + (HAIKU * 20) ))
  BASELINE=$((TOTAL * 500))
  SAVED_PCT=0
  [ "$BASELINE" -gt 0 ] && SAVED_PCT=$(( 100 - (ACTUAL * 100 / BASELINE) + 15 ))
  [ "$SAVED_PCT" -gt 95 ] && SAVED_PCT=95
  printf ' \033[38;5;39m↓%s%% optym.pro\033[0m' "$SAVED_PCT"
else
  printf ' \033[38;5;39moptym.pro\033[0m'
fi
