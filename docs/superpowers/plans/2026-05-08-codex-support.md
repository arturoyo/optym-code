# Plan: Codex CLI Support via Multi-Protocol Proxy

**Goal:** Extend optym-code to intercept OpenAI API calls from Codex CLI, route to cheapest OpenAI model (gpt-4.1-mini / gpt-4.1 / o3), track savings, and provide `setup codex` CLI subcommand.

**Architecture:** Single proxy on port 8088 detects protocol by URL path:
- `POST /v1/messages` -> existing Anthropic flow (unchanged)
- `POST /v1/responses` -> new OpenAI Responses API handler
- `POST /v1/chat/completions` -> new OpenAI Chat Completions handler

**Tech stack:** Node.js, better-sqlite3, node:test, no framework.

**Key constraint:** Streaming passthrough required for OpenAI SSE. Current proxy buffers; OpenAI handlers must pipe SSE directly and extract usage from final chunk.

---

## File structure

| File | Change |
|------|--------|
| `src/pricing.js` | Add `OPENAI_MODELS` table + register in `PRICING_BY_MODEL_ID` |
| `src/model-mapper.js` | Add `provider` param to `mapToModel(score, provider)` |
| `src/savings-tracker.js` | Extend `MODEL_TO_TIER_NAME` with OpenAI model IDs |
| `src/proxy.js` | Add protocol detection, OpenAI handlers, streaming passthrough, `forwardOpenAI()` |
| `bin/optym-code.js` | Add `setup codex` subcommand |
| `tests/pricing.test.js` | Tests for OpenAI pricing |
| `tests/model-mapper.test.js` | Tests for provider param |
| `tests/proxy.test.js` | Tests for OpenAI endpoints + streaming |
| `tests/integration.test.js` | End-to-end OpenAI flow test |

---

## Tasks

### Task 1: Add OpenAI pricing table

**Test first** in `tests/pricing.test.js`:

```javascript
it('returns pricing for gpt-4.1-mini', () => {
  const p = getModelPricing('gpt-4.1-mini');
  assert.strictEqual(p.inputPer1M, 0.40);
  assert.strictEqual(p.outputPer1M, 1.60);
});

it('returns pricing for gpt-4.1', () => {
  const p = getModelPricing('gpt-4.1');
  assert.strictEqual(p.inputPer1M, 2.00);
  assert.strictEqual(p.outputPer1M, 8.00);
});

it('returns pricing for o3', () => {
  const p = getModelPricing('o3');
  assert.strictEqual(p.inputPer1M, 10.00);
  assert.strictEqual(p.outputPer1M, 40.00);
});

it('calculates OpenAI cost correctly', () => {
  const cost = calculateCost('gpt-4.1-mini', 1000, 500);
  assert.strictEqual(cost, 0.0012);
});

it('exports OPENAI_MODELS with tier info', () => {
  assert.strictEqual(OPENAI_MODELS.cheap.id, 'gpt-4.1-mini');
  assert.strictEqual(OPENAI_MODELS.mid.id, 'gpt-4.1');
  assert.strictEqual(OPENAI_MODELS.premium.id, 'o3');
});
```

**Implementation** in `src/pricing.js`:

```javascript
const OPENAI_MODELS = {
  cheap: { id: 'gpt-4.1-mini', tier: 'cheap', inputPer1M: 0.40, outputPer1M: 1.60, maxOutputTokens: 32768 },
  mid: { id: 'gpt-4.1', tier: 'mid', inputPer1M: 2.00, outputPer1M: 8.00, maxOutputTokens: 32768 },
  premium: { id: 'o3', tier: 'premium', inputPer1M: 10.00, outputPer1M: 40.00, maxOutputTokens: 100000 },
};

// Register OpenAI models in PRICING_BY_MODEL_ID
for (const tier of Object.values(OPENAI_MODELS)) {
  PRICING_BY_MODEL_ID[tier.id] = tier;
}

module.exports = { MODELS, OPENAI_MODELS, getModelPricing, calculateCost, PRICING_BY_MODEL_ID };
```

**Verify:** `node --test tests/pricing.test.js` -> all pass
**Commit:** `feat(pricing): add OpenAI models table (gpt-4.1-mini, gpt-4.1, o3)`

---

### Task 2: Parametrize model-mapper by provider

**Test first** in `tests/model-mapper.test.js`:

```javascript
describe('openai provider', () => {
  it('maps low score to gpt-4.1-mini', () => {
    const model = mapToModel(0.1, 'openai');
    assert.strictEqual(model.id, 'gpt-4.1-mini');
  });

  it('maps mid score to gpt-4.1', () => {
    const model = mapToModel(0.5, 'openai');
    assert.strictEqual(model.id, 'gpt-4.1');
  });

  it('maps high score to o3', () => {
    const model = mapToModel(0.8, 'openai');
    assert.strictEqual(model.id, 'o3');
  });

  it('defaults to anthropic when no provider given', () => {
    const model = mapToModel(0.1);
    assert.strictEqual(model.id, 'claude-haiku-4-5-20251001');
  });
});
```

**Implementation** in `src/model-mapper.js`:

```javascript
const { MODELS, OPENAI_MODELS } = require('./pricing');

function mapToModel(score, provider = 'anthropic') {
  const models = provider === 'openai' ? OPENAI_MODELS : MODELS;

  if (currentOverride && models[currentOverride]) {
    return models[currentOverride];
  }

  if (score > 0.6) return models.premium;
  if (score < 0.3) return models.cheap;
  return models.mid;
}
```

**Verify:** `node --test tests/model-mapper.test.js` -> all pass
**Commit:** `feat(model-mapper): add provider parameter for OpenAI routing`

---

### Task 3: Extend savings-tracker for OpenAI models

**Implementation** in `src/savings-tracker.js`:

Add to `MODEL_TO_TIER_NAME`:
```javascript
const MODEL_TO_TIER_NAME = {
  'claude-haiku-4-5-20251001': 'haiku',
  'claude-sonnet-4-6': 'sonnet',
  'claude-opus-4-6': 'opus',
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'gpt-4.1': 'gpt-4.1',
  'o3': 'o3',
};
```

Update `getSessionStats` tierDistribution initialization:
```javascript
const tierDistribution = { haiku: 0, sonnet: 0, opus: 0, 'gpt-4.1-mini': 0, 'gpt-4.1': 0, 'o3': 0 };
```

**Verify:** `node --test tests/*.test.js` -> 60+ pass
**Commit:** `feat(savings-tracker): support OpenAI model IDs in tier tracking`

---

### Task 4: Add OpenAI protocol handlers + streaming passthrough to proxy

**Test first** in `tests/proxy.test.js` — add OpenAI test cases:

```javascript
// New mock upstream that handles OpenAI format
it('handles OpenAI Chat Completions endpoint', async () => {
  // POST /v1/chat/completions with OpenAI format
  // Verify model rewrite + response forwarding
});

it('handles OpenAI Responses API endpoint', async () => {
  // POST /v1/responses with input/instructions format
  // Verify model rewrite + response forwarding
});

it('streams SSE responses without buffering', async () => {
  // Mock upstream sends text/event-stream
  // Verify proxy pipes through SSE chunks
});
```

**Implementation** in `src/proxy.js`:

1. Add `OPENAI_MODELS` import
2. Protocol detection in createServer:
   - `/v1/messages` -> existing Anthropic handler
   - `/v1/chat/completions` -> `handleOpenAIChatCompletions()`
   - `/v1/responses` -> `handleOpenAIResponses()`
3. `extractOpenAIContent(parsed, endpoint)` — extracts user content from either format
4. `handleOpenAI(req, res, body, endpoint)` — classify, map model, forward with streaming
5. `forwardOpenAI(req, res, body, onResponse)` — streaming passthrough with SSE pipe

**Verify:** `node --test tests/proxy.test.js` -> all pass
**Commit:** `feat(proxy): add OpenAI Chat Completions + Responses API handlers with SSE streaming`

---

### Task 5: Add `setup codex` CLI subcommand

**Implementation** in `bin/optym-code.js`:

```javascript
const setup = program.command('setup').description('Setup integrations');

setup.command('codex')
  .description('Configure Codex CLI to use optym-code proxy')
  .action(() => {
    const os = require('node:os');
    const configDir = path.join(os.homedir(), '.codex');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    const tomlPath = path.join(configDir, 'config.toml');
    const content = `model = "o3"\n\n[model_providers.optym]\nname = "Optym Router"\nbase_url = "http://localhost:8088"\nenv_key = "OPENAI_API_KEY"\nwire_api = "responses"\n`;
    fs.writeFileSync(tomlPath, content);
    console.log(`Codex CLI configured at ${tomlPath}`);
    console.log('Make sure OPENAI_API_KEY is set in your environment.');
    console.log('Start proxy: optym-code start');
  });
```

**Verify:** `node bin/optym-code.js setup codex --help` works
**Commit:** `feat(cli): add setup codex subcommand`

---

### Task 6: Integration tests for OpenAI flow

**Test** in `tests/integration.test.js`:

```javascript
it('routes OpenAI Chat Completions: simple to gpt-4.1-mini, complex to o3', async () => {
  // POST /v1/chat/completions with simple prompt -> gpt-4.1-mini
  // POST /v1/chat/completions with complex prompt -> o3
});

it('routes OpenAI Responses API: simple to gpt-4.1-mini', async () => {
  // POST /v1/responses with simple input -> gpt-4.1-mini
});
```

**Verify:** `node --test tests/*.test.js` -> all pass (60 + new tests)
**Commit:** `feat(integration): add OpenAI flow end-to-end tests`

---

### Task 7: Update health endpoint

Add `providers: ['anthropic', 'openai']` to health response.

**Verify:** `node --test tests/proxy.test.js` -> health test passes
**Commit:** `feat(proxy): show supported providers in health endpoint`
