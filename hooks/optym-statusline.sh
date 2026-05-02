#!/bin/bash
# optym-code — statusline for Claude Code
# Format: S:40% O:20% H:40% ↓80% savings | optym.pro
# All in blue tones — discrete, professional

COUNTER_FILE="${HOME}/.optym-lite/routing.json"

SONNET=0; OPUS=0; HAIKU=0
if [ -f "$COUNTER_FILE" ] && [ ! -L "$COUNTER_FILE" ]; then
  DATA=$(head -c 512 "$COUNTER_FILE" 2>/dev/null)
  SONNET=$(echo "$DATA" | grep -o '"sonnet": *[0-9]*' | sed 's/.*: *//')
  OPUS=$(echo "$DATA" | grep -o '"opus": *[0-9]*' | sed 's/.*: *//')
  HAIKU=$(echo "$DATA" | grep -o '"haiku": *[0-9]*' | sed 's/.*: *//')
fi

SONNET=${SONNET:-0}; OPUS=${OPUS:-0}; HAIKU=${HAIKU:-0}
TOTAL=$((SONNET + OPUS + HAIKU))

IS_PRO=0
[ -n "$OPTYM_PRO_KEY" ] && IS_PRO=1

# Blue tones: dark=24, mid=33, light=39, bright=75
if [ "$TOTAL" -gt 0 ]; then
  S_PCT=$((SONNET * 100 / TOTAL))
  O_PCT=$((OPUS * 100 / TOTAL))
  H_PCT=$((HAIKU * 100 / TOTAL))
  SAVED_PCT=$(( (TOTAL - OPUS) * 100 / TOTAL ))

  # Distribution in blue tones (dark → light)
  printf '\033[38;5;24mS:%s%% O:%s%% H:%s%%\033[0m ' "$S_PCT" "$O_PCT" "$H_PCT"

  # Savings + branding
  if [ "$IS_PRO" -eq 1 ]; then
    printf '\033[38;5;75m↓%s%% savings\033[0m \033[38;5;220m| OPTYM.PRO\033[0m' "$SAVED_PCT"
  else
    printf '\033[38;5;75m↓%s%% savings\033[0m \033[38;5;33m| optym.pro\033[0m' "$SAVED_PCT"
  fi
else
  if [ "$IS_PRO" -eq 1 ]; then
    printf '\033[38;5;220mOPTYM.PRO\033[0m'
  else
    printf '\033[38;5;33moptym.pro\033[0m'
  fi
fi
