# CLAUDE.md — optym-code

## What is optym-code

Dual optimization plugin for Claude Code:
1. **Model routing** — routes requests to cheapest Claude model (Haiku/Sonnet/Opus) based on prompt complexity
2. **Terse mode** — compressed communication that cuts output tokens ~65%

Combined savings: 20-55% cost reduction on Claude Code usage.

## Plugin structure

| File | Purpose |
|------|---------|
| `skills/optym/skill.md` | Main terse mode skill (/optym lite\|full\|ultra) |
| `skills/savings/skill.md` | Show savings dashboard |
| `skills/force-opus/skill.md` | Force Opus tier |
| `skills/force-haiku/skill.md` | Force Haiku tier |
| `skills/force-sonnet/skill.md` | Force Sonnet tier |
| `skills/optym-status/skill.md` | Proxy status |
| `skills/optym-reset/skill.md` | Reset to auto-routing |
| `hooks/optym-activate.js` | SessionStart: activate terse + auto-start proxy |
| `hooks/optym-mode-tracker.js` | UserPromptSubmit: track mode + reinforce terse |
| `src/` | Proxy server source code |
| `bin/optym-code.js` | CLI entry point |

## How it works

Local proxy on localhost:8088 intercepts Anthropic API requests. Classifies prompt complexity with static rules. Routes to Haiku (simple), Sonnet (medium), or Opus (complex). Compresses input tokens for cheaper tiers. Injects terse instructions to reduce output tokens.

## Hooks

- **SessionStart**: writes `.optym-active` flag, emits terse ruleset, auto-starts proxy
- **UserPromptSubmit**: tracks `/optym` commands, emits per-turn terse reinforcement

## Commands

- `/optym` — activate terse mode (default: full)
- `/optym lite` — professional compact
- `/optym ultra` — maximum compression
- `/savings` — show savings dashboard
- `/force-opus` — force premium tier
- `/force-haiku` — force cheap tier
- `stop optym` / `normal mode` — deactivate terse

## Pro mode

Set `OPTYM_PRO_KEY` env var to upgrade routing from static rules (70% accuracy, 20-30% savings) to ML cloud classifier (92% accuracy, 45-55% savings) via api.optym.pro.
