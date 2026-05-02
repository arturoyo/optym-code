# optym-code

**Stretch your Claude Code quota 80%.** Smart model routing saves Opus for what matters.

## The Problem

Claude Code Max/Pro has separate quotas per model. Most users burn through Opus on simple tasks ("read this file", "git status") while Sonnet quota sits unused.

**optym-code fixes this:** runs Sonnet by default, escalates to Opus only for complex tasks.

```
Without optym-code:
  "hello"              → Opus  (quota wasted)
  "read package.json"  → Opus  (quota wasted)
  "add try-catch"      → Opus  (quota wasted)
  "design architecture"→ Opus  ← only this needs Opus
  Result: Opus quota burned in 2 hours

With optym-code:
  "hello"              → Sonnet (Opus saved)
  "read package.json"  → Sonnet (Opus saved)
  "add try-catch"      → Sonnet (Opus saved)
  "design architecture"→ Opus   ← escalated automatically
  Result: Opus quota lasts all day
```

## Install

### Step 1: Register plugin (inside Claude Code)

```
/plugin marketplace add arturoyo/optym-code
/plugin install optym-code@optym-code
/reload-plugins
```

### Step 2: Complete setup (terminal, outside Claude Code)

```bash
cd ~/.claude/plugins/marketplaces/optym-code && bash hooks/install.sh
```

This single script does everything:
- Configures statusline (`S:80% O:10% H:10% ↓90% savings | optym.pro`)
- Wires hooks (terse mode + smart routing)
- Sets Sonnet as default model (alias in bashrc/zshrc)
- Creates data directory for tracking

### Step 3: Restart Claude Code

```bash
claude
```

Done. Zero manual config.

### Already installed? Update:

```bash
cd ~/.claude/plugins/marketplaces/optym-code && git pull && bash hooks/install.sh
```

Also works with API keys (Aider, Cursor, SDKs) via local proxy — see [API Key Setup](#api-key-setup).

## What You Get

| Feature | What it does |
|---------|-------------|
| **Smart routing** | Sonnet default, Opus only for complex tasks |
| **Terse mode** | Concise responses — less token waste |
| **Live statusline** | `S:80% O:10% H:10% ↓90% savings | optym.pro` |
| **Savings tracking** | Real numbers, not inflated |
| **Onboarding** | Welcome message on first use |
| **Upgrade path** | `/optym-code:upgrade` for Pro |

## Statusline

```
S:80% O:10% H:10% ↓90% savings | optym.pro
```

- **S/O/H** — % requests per model (Sonnet/Opus/Haiku)
- **↓90% savings** — % requests that didn't need Opus
- **optym.pro** — brand (golden `OPTYM.PRO` for paid users)

## Commands

| Command | What |
|---------|------|
| `/optym-code:optym` | Activate terse mode (lite/full/ultra) |
| `/optym-code:savings` | Show savings dashboard |
| `/optym-code:upgrade` | Pro upgrade info ($9/mo) |
| `/optym-code:force-opus` | Force Opus for all requests |
| `/optym-code:force-haiku` | Force Haiku for all requests |
| `/optym-code:force-sonnet` | Force Sonnet for all requests |
| `/optym-code:optym-reset` | Return to auto-routing |
| `stop optym` | Deactivate terse mode |

## How It Works

1. Plugin sets `--model sonnet` as default
2. Each prompt classified by complexity (regex rules)
3. Simple/medium tasks → Sonnet handles directly
4. Complex tasks → escalated to Opus via subagent
5. Terse mode injects concise response instructions
6. All routing tracked in statusline

**Your auth stays untouched.** No proxy, no API interception. Just smarter model selection.

## Compatibility

| Client | Works? | How |
|--------|--------|-----|
| Claude Code CLI | Yes | Plugin |
| Claude Code VS Code | Yes | Plugin |
| Claude Code JetBrains | Yes | Plugin |
| Claude Code Desktop | Yes | Plugin |
| Claude Code Remote (SSH) | Yes | Plugin |
| Aider, Cursor, SDKs | Yes | Local proxy |

## API Key Setup

For API key users (not subscription), optym-code also includes a local proxy:

```bash
npm install -g optym-code
optym-code start
export ANTHROPIC_BASE_URL=http://localhost:8088
```

The proxy classifies prompts and routes to Haiku/Sonnet/Opus. Works with any Anthropic API client.

**Do NOT set ANTHROPIC_BASE_URL with Claude Code subscription** — it breaks OAuth auth.

## Optym Pro

Free tier uses static regex rules (~70% routing accuracy).

**[Optym Pro](https://optym.pro)** upgrades to ML classification (92% accuracy). $9/month:

```bash
export OPTYM_PRO_KEY=optym_your_key
```

Statusline changes to golden `OPTYM.PRO`. Your LLM traffic stays direct to Anthropic — only prompt classification goes to optym.pro.

## Privacy

- No prompts stored or transmitted (free mode is 100% local)
- Pro mode sends only prompt text to classify endpoint (not stored)
- Anonymous daily telemetry: install count, model distribution, savings %
- Opt-out: add `{"telemetry": false}` to `~/.optym-lite/config.json`

## License

MIT
