#!/bin/bash
# optym-code — statusline for Claude Code
# Format: [sonnet] ↓80% savings | optym.pro
# Savings = % of requests that did NOT use Opus (real, not inflated)

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

# Pro detection
IS_PRO=0
[ -n "$OPTYM_PRO_KEY" ] && IS_PRO=1

# Savings = % requests NOT on Opus (simple, real, honest)
if [ "$TOTAL" -gt 0 ]; then
  NOT_OPUS=$((TOTAL - OPUS))
  SAVED_PCT=$(( (NOT_OPUS * 100) / TOTAL ))

  if [ "$IS_PRO" -eq 1 ]; then
    printf ' \033[38;5;220m↓%s%% savings | OPTYM.PRO\033[0m' "$SAVED_PCT"
  else
    printf ' \033[38;5;39m↓%s%% savings | optym.pro\033[0m' "$SAVED_PCT"
  fi
else
  if [ "$IS_PRO" -eq 1 ]; then
    printf ' \033[38;5;220mOPTYM.PRO\033[0m'
  else
    printf ' \033[38;5;39moptym.pro\033[0m'
  fi
fi
