# optym-lite

**Save 20-30% on your Anthropic API costs.** Open-source local proxy that routes Claude requests to the cheapest model that can handle the task.

```
You (always Opus) --> $$$$$
You + optym-lite  --> $$    (Haiku for simple tasks, Sonnet for medium, Opus for complex)
You + Optym Pro   --> $     (ML routing + cache + healing -> 45-55% savings)
```

## Quick Start

```bash
npm install -g optym-lite
optym-lite start
export ANTHROPIC_BASE_URL=http://localhost:8088
```

That's it. Your Claude Code / SDK / any Anthropic client now routes automatically.

## How It Works

optym-lite sits between your client and Anthropic's API:

```
Your Client -> optym-lite (localhost:8088) -> api.anthropic.com
                  |
                  +-- Classifies prompt complexity
                  +-- Routes to Haiku / Sonnet / Opus
                  +-- Compresses input tokens
                  +-- Tracks your savings
```

| Prompt type | Routed to | Cost vs Opus |
|-------------|-----------|-------------|
| "hello", "git status", "read file" | Haiku | **18x cheaper** |
| "add error handling", "explain this" | Sonnet | **5x cheaper** |
| "design architecture", "debug complex issue" | Opus | Full price |

## Compatibility

Works with anything that supports Anthropic's base URL:

- **Claude Code** (CLI, VS Code, JetBrains, Desktop)
- **Anthropic Python/JS SDK**
- **Aider**, **Cursor** (Claude mode)
- Any Anthropic API client

## Commands

```bash
optym-lite start              # Start proxy (localhost:8088)
optym-lite stop               # Stop proxy
optym-lite status             # Show status + stats
optym-lite stats              # Savings dashboard
optym-lite stats --all        # All-time stats
optym-lite config --show      # Show config
optym-lite config --port 9090 # Change port
optym-lite upgrade            # Open Optym Pro page
```

## Claude Code Skills

If you use Claude Code, optym-lite includes skills for in-session control:

- `/savings` -- Show savings dashboard
- `/force-opus` -- Force Opus for all requests
- `/force-haiku` -- Force Haiku for all requests
- `/force-sonnet` -- Force Sonnet for all requests
- `/optym-reset` -- Return to auto-routing
- `/optym-status` -- Proxy status

## Optym Pro

optym-lite gives you **20-30% savings** with static rules. Want more?

**[Optym Pro](https://optym.pro)** uses ML classifiers, semantic caching, speculative execution, and self-healing to achieve **45-55% savings**.

Upgrade is a config change -- no reinstall needed:

```bash
export OPTYM_PRO_KEY=optym_your_key
optym-lite restart
```

## License

MIT
