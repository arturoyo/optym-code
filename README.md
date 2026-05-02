# optym-code

**Cut your Claude Code bill 20-55%.** Smart model routing + terse output. Zero config.

## Before / After

```
Without optym-code:
  Every request → Opus → $$$$$
  Every response → verbose → more $$$$$

With optym-code:
  "hello" → Haiku (18x cheaper)
  "add try-catch" → Sonnet (5x cheaper)
  "design architecture" → Opus (full power)
  All responses → concise (65% fewer output tokens)
```

## Install

### Claude Code Plugin (recommended)

```bash
claude plugin install arturoyo/optym-code
```

Done. Proxy auto-starts. Terse mode auto-activates. Savings tracked.

### Standalone (any Anthropic client)

```bash
npm install -g optym-code
optym-code start
export ANTHROPIC_BASE_URL=http://localhost:8088
```

Works with Claude Code, Aider, Cursor, Anthropic SDKs — anything that talks to Anthropic API.

## What You Get

| Feature | What it does | Savings |
|---------|-------------|---------|
| **Smart routing** | Routes to Haiku/Sonnet/Opus by complexity | 20-30% cost |
| **Terse mode** | Compressed responses, no fluff | ~65% output tokens |
| **Input compression** | Strips whitespace, comments, collapses imports | 15-25% input tokens |
| **Savings dashboard** | Track exactly how much you save | Know your ROI |
| **Statusline badge** | `[OPTYM ↓31%]` in Claude Code | Always visible |

## Commands

In Claude Code:

| Command | What |
|---------|------|
| `/optym` | Activate terse mode (default: full) |
| `/optym lite` | Professional compact — no filler, full sentences |
| `/optym ultra` | Maximum compression — abbreviations, arrows, fragments |
| `/savings` | Show savings dashboard |
| `/force-haiku` | Force all requests to Haiku |
| `/force-opus` | Force all requests to Opus |
| `/optym-reset` | Return to auto-routing |
| `stop optym` | Deactivate terse mode |

CLI:

```bash
optym-code start              # Start proxy
optym-code stop               # Stop proxy
optym-code stats              # Savings dashboard
optym-code stats --all        # All-time stats
optym-code config --show      # Show config
```

## How It Works

```
Claude Code → optym-code proxy (localhost:8088) → Anthropic API
                    |
                    +-- Classifies prompt complexity (regex rules)
                    +-- Routes to cheapest capable model
                    +-- Compresses input tokens
                    +-- Injects terse instructions
                    +-- Tracks savings in SQLite
```

| Prompt type | Routed to | Cost vs Opus |
|-------------|-----------|-------------|
| Greetings, git ops, file reads | Haiku | **18x cheaper** |
| Medium coding, explanations | Sonnet | **5x cheaper** |
| Architecture, complex debug | Opus | Full price |

## Compatibility

| Client | Works? |
|--------|--------|
| Claude Code (CLI, VS Code, JetBrains, Desktop) | Yes |
| Anthropic Python/JS SDK | Yes |
| Aider (Claude mode) | Yes |
| Cursor (Claude mode) | Yes |
| Any Anthropic API client | Yes |

## Optym Pro

optym-code free gives **20-30% savings** with static rules.

**[Optym Pro](https://optym.pro)** upgrades to ML classifiers with **92% routing accuracy** for **45-55% savings**. No reinstall:

```bash
export OPTYM_PRO_KEY=optym_your_key
optym-code start
```

Your LLM traffic stays direct to Anthropic. Only the prompt goes to Optym for classification. Zero trust issues.

## License

MIT
