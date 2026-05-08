# optym-code

**Stop burning expensive AI quota on cheap tasks.** Smart model routing for Claude Code and Codex CLI.

## The Problem

Claude Code and Codex charge per request — or burn through quota fast. Most tasks don't need your most expensive model.

```
Without optym-code:
  "hello"               → Opus / o3    (expensive, wasted)
  "read this file"      → Opus / o3    (expensive, wasted)
  "add try-catch"       → Opus / o3    (expensive, wasted)
  "design architecture" → Opus / o3    (actually needed)
  Result: quota gone in 2 hours

With optym-code:
  "hello"               → Haiku / gpt-4.1-mini  (20x cheaper)
  "read this file"      → Haiku / gpt-4.1-mini  (20x cheaper)
  "add try-catch"       → Sonnet / gpt-4.1      (5x cheaper)
  "design architecture" → Opus / o3             (escalated)
  Result: same work, 30-55% less cost
```

Works as a local proxy — invisible to your CLI. No config beyond install, no data leaves your machine.

## Install

```bash
curl -s https://raw.githubusercontent.com/arturoyo/optym-code/master/install.sh | bash
```

Restart Claude Code. Done.

## Codex CLI Support

```bash
optym-code setup codex
optym-code start
```

Writes `~/.codex/config.toml` pointing Codex at the proxy. Requires `OPENAI_API_KEY` set in your environment.

## How It Works

A local proxy runs on `localhost:8088`. Your CLI sends requests through it.

1. Classifies prompt complexity (local regex rules — instant, free, no data sent)
2. Routes to cheapest model that can handle the task:
   - **Haiku / gpt-4.1-mini** — greetings, file reads, git ops, simple questions
   - **Sonnet / gpt-4.1** — moderate tasks, default for ambiguous prompts
   - **Opus / o3** — architecture, complex debug, multi-file refactors, code with context
3. Forwards directly to Anthropic or OpenAI (your keys, your auth)
4. Tracks savings in local SQLite

**Pro mode** upgrades classification to ML (92% accuracy, 45-55% savings) via `api.optym.pro`. Your LLM traffic never goes through optym servers — only the classification request does.

## Compatibility

| CLI | Supported | Setup |
|-----|-----------|-------|
| Claude Code (subscription) | Yes | `install.sh` |
| Claude Code (API key) | Yes | `install.sh` + set `ANTHROPIC_BASE_URL` |
| Codex CLI | Yes | `optym-code setup codex` |
| Aider, Cursor, any Anthropic client | Yes | Set `ANTHROPIC_BASE_URL=http://localhost:8088` |

## Savings

Real numbers from production usage:

| Mode | Routing accuracy | Typical savings |
|------|-----------------|-----------------|
| Free (local rules) | ~70% | 20-35% |
| Pro (ML cloud) | 92% | 45-55% |

## Commands (Claude Code)

| Command | What |
|---------|------|
| `/optym` | Activate terse mode (cuts output tokens ~65%) |
| `/savings` | Show savings dashboard |
| `/force-opus` | Force Opus for all requests |
| `/force-haiku` | Force Haiku for all requests |
| `/force-sonnet` | Force Sonnet for all requests |
| `/optym-reset` | Return to auto-routing |
| `stop optym` | Deactivate terse mode |

## Manual proxy control

```bash
optym-code start          # start proxy (auto-started on Claude Code session)
optym-code stop           # stop proxy
optym-code status         # show proxy status and savings
optym-code setup codex    # configure Codex CLI
```

## Optym Pro

Free tier: static regex rules, 100% local, 20-35% savings.

**[Optym Pro](https://optym.pro)** — ML classification, 92% accuracy, 45-55% savings. $9/month.

```bash
export OPTYM_PRO_KEY=optym_your_key
```

Your LLM traffic stays direct to Anthropic/OpenAI. Only prompt text is sent to classify.

## Privacy

- **Free mode**: 100% local. Nothing leaves your machine.
- **Pro mode**: prompt text sent to `api.optym.pro/v1/classify` for ML routing. Not stored.
- **Telemetry**: anonymous daily ping — install count, model distribution, savings %. No prompts.
- **Opt-out**: `{"telemetry": false}` in `~/.optym-lite/config.json`

## License

MIT
