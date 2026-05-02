<!-- Karpathy Coding Principles (via forrestchang/andrej-karpathy-skills) -->
## Coding Principles

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform tasks into verifiable goals: "Fix the bug" → "Write a test that reproduces it, then make it pass"
- For multi-step tasks, state a brief plan with verify steps.

---


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
