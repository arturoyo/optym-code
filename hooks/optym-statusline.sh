#!/bin/bash
# optym-code — statusline badge for Claude Code
# Shows combined savings estimate + optym.pro branding

COUNTER_FILE="${HOME}/.optym-lite/routing.json"

# Read routing stats
SONNET=0
OPUS=0
HAIKU=0
if [ -f "$COUNTER_FILE" ] && [ ! -L "$COUNTER_FILE" ]; then
  SONNET=$(head -c 256 "$COUNTER_FILE" 2>/dev/null | grep -o '"sonnet": *[0-9]*' | sed 's/.*: *//')
  OPUS=$(head -c 256 "$COUNTER_FILE" 2>/dev/null | grep -o '"opus": *[0-9]*' | sed 's/.*: *//')
  HAIKU=$(head -c 256 "$COUNTER_FILE" 2>/dev/null | grep -o '"haiku": *[0-9]*' | sed 's/.*: *//')
fi

SONNET=${SONNET:-0}
OPUS=${OPUS:-0}
HAIKU=${HAIKU:-0}
TOTAL=$((SONNET + OPUS + HAIKU))

if [ "$TOTAL" -gt 0 ]; then
  # Estimate savings vs all-Opus baseline
  # Opus weight=5, Sonnet weight=1, Haiku weight=0.2 (relative quota cost)
  # Savings = 1 - (actual_weighted / all_opus_weighted)
  # Using integer math x100
  ACTUAL=$(( (OPUS * 500) + (SONNET * 100) + (HAIKU * 20) ))
  BASELINE=$((TOTAL * 500))
  if [ "$BASELINE" -gt 0 ]; then
    SAVED_PCT=$(( 100 - (ACTUAL * 100 / BASELINE) ))
  else
    SAVED_PCT=0
  fi
  # Add ~15% for terse mode output compression
  SAVED_PCT=$(( SAVED_PCT + 15 ))
  # Cap at 95
  [ "$SAVED_PCT" -gt 95 ] && SAVED_PCT=95

  printf '\033[38;5;39m[↓%s%% · optym.pro]\033[0m' "$SAVED_PCT"
else
  printf '\033[38;5;39m[optym.pro]\033[0m'
fi
