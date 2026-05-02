# optym-lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source local proxy that routes Anthropic API requests to the cheapest Claude model capable of handling the task, saving 20-30% on costs.

**Architecture:** Node.js HTTP proxy on localhost:8088 intercepts Anthropic Messages API calls. A static-rules classifier scores prompt complexity (0-1), a compressor reduces input tokens, and a model mapper rewrites the model field to Haiku/Sonnet/Opus. SQLite tracks savings. CLI manages the proxy lifecycle.

**Tech Stack:** Node.js, better-sqlite3, commander

---

## File Structure

```
optym-lite/
├── package.json
├── bin/
│   └── optym-lite.js              # CLI entry point (commander)
├── src/
│   ├── proxy.js                   # HTTP proxy server
│   ├── classifier.js              # Static rules complexity classifier
│   ├── compressor.js              # Input token reduction
│   ├── model-mapper.js            # Complexity score → model ID
│   ├── savings-tracker.js         # SQLite savings persistence
│   ├── stats-writer.js            # Write ~/.optym-lite/stats.json
│   ├── branding.js                # Nudge engine + footer generation
│   ├── config.js                  # Config load/save (~/.optym-lite/config.json)
│   └── pricing.js                 # Anthropic model pricing constants
├── tests/
│   ├── classifier.test.js
│   ├── compressor.test.js
│   ├── model-mapper.test.js
│   ├── savings-tracker.test.js
│   ├── branding.test.js
│   ├── proxy.test.js
│   └── config.test.js
├── skills/                        # Claude Code skills (optional)
│   ├── savings/
│   │   └── skill.md
│   ├── force-opus/
│   │   └── skill.md
│   ├── force-haiku/
│   │   └── skill.md
│   ├── force-sonnet/
│   │   └── skill.md
│   ├── optym-status/
│   │   └── skill.md
│   └── optym-reset/
│       └── skill.md
└── README.md
```

---

### Task 1: Project scaffolding + pricing constants

**Files:**
- Create: `package.json`
- Create: `src/pricing.js`
- Create: `tests/pricing.test.js`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "optym-lite",
  "version": "0.1.0",
  "description": "Open-source local proxy for Anthropic API cost optimization. Routes to Haiku/Sonnet/Opus based on prompt complexity.",
  "main": "src/proxy.js",
  "bin": {
    "optym-lite": "./bin/optym-lite.js"
  },
  "scripts": {
    "test": "node --test tests/*.test.js",
    "start": "node bin/optym-lite.js start"
  },
  "keywords": ["anthropic", "claude", "proxy", "cost-optimization", "llm", "routing"],
  "author": "Arturo <arturoyo@gmail.com>",
  "license": "MIT",
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "commander": "^12.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Write pricing test**

Create `tests/pricing.test.js`:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getModelPricing, calculateCost, MODELS } = require('../src/pricing');

describe('pricing', () => {
  it('returns pricing for haiku', () => {
    const p = getModelPricing('claude-haiku-4-5-20251001');
    assert.strictEqual(p.inputPer1M, 0.80);
    assert.strictEqual(p.outputPer1M, 4.00);
  });

  it('returns pricing for sonnet', () => {
    const p = getModelPricing('claude-sonnet-4-6');
    assert.strictEqual(p.inputPer1M, 3.00);
    assert.strictEqual(p.outputPer1M, 15.00);
  });

  it('returns pricing for opus', () => {
    const p = getModelPricing('claude-opus-4-6');
    assert.strictEqual(p.inputPer1M, 15.00);
    assert.strictEqual(p.outputPer1M, 75.00);
  });

  it('calculates cost correctly', () => {
    const cost = calculateCost('claude-haiku-4-5-20251001', 1000, 500);
    // input: 1000/1M * 0.80 = 0.0008
    // output: 500/1M * 4.00 = 0.002
    assert.strictEqual(cost, 0.0028);
  });

  it('returns null for unknown model', () => {
    const p = getModelPricing('unknown-model');
    assert.strictEqual(p, null);
  });

  it('exports MODELS with tier info', () => {
    assert.strictEqual(MODELS.cheap.id, 'claude-haiku-4-5-20251001');
    assert.strictEqual(MODELS.mid.id, 'claude-sonnet-4-6');
    assert.strictEqual(MODELS.premium.id, 'claude-opus-4-6');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/pricing.test.js`
Expected: FAIL — module not found

- [ ] **Step 4: Implement pricing module**

Create `src/pricing.js`:
```javascript
'use strict';

const MODELS = {
  cheap: {
    id: 'claude-haiku-4-5-20251001',
    tier: 'cheap',
    inputPer1M: 0.80,
    outputPer1M: 4.00,
    maxOutputTokens: 8192,
  },
  mid: {
    id: 'claude-sonnet-4-6',
    tier: 'mid',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    maxOutputTokens: 16384,
  },
  premium: {
    id: 'claude-opus-4-6',
    tier: 'premium',
    inputPer1M: 15.00,
    outputPer1M: 75.00,
    maxOutputTokens: 32768,
  },
};

const PRICING_BY_MODEL_ID = {};
for (const tier of Object.values(MODELS)) {
  PRICING_BY_MODEL_ID[tier.id] = tier;
}

function getModelPricing(modelId) {
  return PRICING_BY_MODEL_ID[modelId] || null;
}

function calculateCost(modelId, inputTokens, outputTokens) {
  const pricing = getModelPricing(modelId);
  if (!pricing) return null;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return parseFloat((inputCost + outputCost).toFixed(6));
}

module.exports = { MODELS, getModelPricing, calculateCost, PRICING_BY_MODEL_ID };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/pricing.test.js`
Expected: All 6 tests PASS

- [ ] **Step 6: Install dependencies**

Run: `cd /home/arturo/optym-lite && npm install`

- [ ] **Step 7: Commit**

```bash
cd /home/arturo/optym-lite
git add package.json src/pricing.js tests/pricing.test.js
git commit -m "feat: project scaffolding + pricing constants"
```

---

### Task 2: Classifier (static rules)

**Files:**
- Create: `src/classifier.js`
- Create: `tests/classifier.test.js`

- [ ] **Step 1: Write classifier tests**

Create `tests/classifier.test.js`:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { classify } = require('../src/classifier');

describe('classifier', () => {
  describe('haiku tier (score < 0.3)', () => {
    it('classifies greetings', () => {
      const result = classify('hello');
      assert.ok(result.score < 0.3, `score ${result.score} should be < 0.3`);
      assert.strictEqual(result.tier, 'cheap');
    });

    it('classifies confirmations', () => {
      const result = classify('yes');
      assert.ok(result.score < 0.3);
      assert.strictEqual(result.tier, 'cheap');
    });

    it('classifies git ops', () => {
      const result = classify('show me the git status');
      assert.ok(result.score < 0.3);
    });

    it('classifies file reading', () => {
      const result = classify('read the package.json file');
      assert.ok(result.score < 0.3);
    });

    it('classifies short factual questions', () => {
      const result = classify('what is a promise in javascript?');
      assert.ok(result.score < 0.3);
    });
  });

  describe('opus tier (score > 0.6)', () => {
    it('classifies architecture requests', () => {
      const result = classify('design a microservices architecture for our payment system');
      assert.ok(result.score > 0.6, `score ${result.score} should be > 0.6`);
      assert.strictEqual(result.tier, 'premium');
    });

    it('classifies complex debug', () => {
      const result = classify('debug why the authentication is failing intermittently in production');
      assert.ok(result.score > 0.6);
    });

    it('classifies multi-file operations', () => {
      const result = classify('refactor the auth module across all files to use the new token format');
      assert.ok(result.score > 0.6);
    });

    it('classifies code generation', () => {
      const result = classify('build a REST API with authentication, rate limiting and database connection pooling');
      assert.ok(result.score > 0.6);
    });

    it('classifies long prompts as complex', () => {
      const longPrompt = 'explain this code in detail: ' + 'x'.repeat(2100);
      const result = classify(longPrompt);
      assert.ok(result.score > 0.6);
    });
  });

  describe('sonnet tier (default, 0.3-0.6)', () => {
    it('classifies medium tasks', () => {
      const result = classify('add error handling to this function');
      assert.ok(result.score >= 0.3 && result.score <= 0.6, `score ${result.score} should be 0.3-0.6`);
      assert.strictEqual(result.tier, 'mid');
    });

    it('defaults unknown patterns to sonnet', () => {
      const result = classify('do the thing with the stuff');
      assert.strictEqual(result.tier, 'mid');
    });
  });

  describe('result structure', () => {
    it('returns score, tier, and signals', () => {
      const result = classify('hello');
      assert.ok('score' in result);
      assert.ok('tier' in result);
      assert.ok('signals' in result);
      assert.ok(Array.isArray(result.signals));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/classifier.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement classifier**

Create `src/classifier.js`:
```javascript
'use strict';

const HAIKU_PATTERNS = [
  { pattern: /^(hi|hello|hey|yes|no|ok|okay|thanks|thank you|gracias|sí|vale|sure|yep|nope)[\s!?.]*$/i, signal: 'greeting_or_confirmation' },
  { pattern: /^(what|where|when|who|how many|how much|qué|dónde|cuándo|quién)\b/i, signal: 'factual_question' },
  { pattern: /\b(git status|git log|git diff|git branch|commit message|git show)\b/i, signal: 'git_ops' },
  { pattern: /\b(read|show|cat|print|display|muestra|lee|list)\s+(the\s+)?(file|content|code|output)/i, signal: 'file_reading' },
  { pattern: /\bwhat does this error mean\b/i, signal: 'error_lookup' },
  { pattern: /^(run|execute|check|verify|test)\s/i, signal: 'simple_command' },
];

const OPUS_PATTERNS = [
  { pattern: /\b(architect|design|redesign|refactor|restructur|rediseñ)/i, signal: 'architecture' },
  { pattern: /\b(debug|troubleshoot)\b.*\b(fail|crash|broken|not work|error|issue)/i, signal: 'complex_debug' },
  { pattern: /\bwhy\b.*\b(fail|crash|broken|not work|error)/i, signal: 'why_failing' },
  { pattern: /\b(across|multiple files|all files|every file|todos los archivos|entire codebase)/i, signal: 'multi_file' },
  { pattern: /\b(write a|create a|build a|implement|genera|crea|construye)\b/i, signal: 'generation' },
  { pattern: /\b(explain|compare|analyze|evalua|analiz).*\b(detail|depth|thorough|comprehensive)/i, signal: 'deep_analysis' },
  { pattern: /\b(migrate|migration|convert|transform)\b.*\b(from|to|into)\b/i, signal: 'migration' },
];

const SHORT_THRESHOLD = 200;
const LONG_THRESHOLD = 2000;

function classify(prompt) {
  const text = (prompt || '').trim();
  const signals = [];
  let score = 0.5; // default: sonnet

  // Check haiku patterns
  let haikuHits = 0;
  for (const { pattern, signal } of HAIKU_PATTERNS) {
    if (pattern.test(text)) {
      signals.push(signal);
      haikuHits++;
    }
  }

  // Check opus patterns
  let opusHits = 0;
  for (const { pattern, signal } of OPUS_PATTERNS) {
    if (pattern.test(text)) {
      signals.push(signal);
      opusHits++;
    }
  }

  // Length signals
  if (text.length < SHORT_THRESHOLD) {
    signals.push('short_prompt');
  }
  if (text.length > LONG_THRESHOLD) {
    signals.push('long_prompt');
  }

  // Scoring logic
  if (opusHits > 0 || text.length > LONG_THRESHOLD) {
    score = 0.7 + (opusHits * 0.05);
    if (score > 1) score = 1;
  } else if (haikuHits > 0 && text.length < SHORT_THRESHOLD) {
    score = 0.1 + (haikuHits > 1 ? 0 : 0.05);
  } else if (haikuHits > 0) {
    score = 0.25;
  }

  // Determine tier
  let tier;
  if (score < 0.3) {
    tier = 'cheap';
  } else if (score > 0.6) {
    tier = 'premium';
  } else {
    tier = 'mid';
  }

  return { score: parseFloat(score.toFixed(2)), tier, signals };
}

module.exports = { classify };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/classifier.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/arturo/optym-lite
git add src/classifier.js tests/classifier.test.js
git commit -m "feat: static rules classifier (3-tier complexity scoring)"
```

---

### Task 3: Compressor (input reduction)

**Files:**
- Create: `src/compressor.js`
- Create: `tests/compressor.test.js`

- [ ] **Step 1: Write compressor tests**

Create `tests/compressor.test.js`:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { compress } = require('../src/compressor');

describe('compressor', () => {
  describe('whitespace cleanup', () => {
    it('collapses multiple blank lines', () => {
      const input = 'line1\n\n\n\nline2\n\n\nline3';
      const result = compress(input, 'mid');
      assert.strictEqual(result.text, 'line1\n\nline2\n\nline3');
    });

    it('trims trailing whitespace', () => {
      const input = 'line1   \nline2  \nline3';
      const result = compress(input, 'mid');
      assert.strictEqual(result.text, 'line1\nline2\nline3');
    });
  });

  describe('comment stripping (haiku only)', () => {
    it('strips single-line JS comments for haiku', () => {
      const input = 'const x = 1; // this is a comment\nconst y = 2;';
      const result = compress(input, 'cheap');
      assert.ok(!result.text.includes('// this is a comment'));
      assert.ok(result.text.includes('const x = 1;'));
    });

    it('strips Python comments for haiku', () => {
      const input = 'x = 1  # comment\ny = 2';
      const result = compress(input, 'cheap');
      assert.ok(!result.text.includes('# comment'));
    });

    it('does NOT strip comments for mid tier', () => {
      const input = 'const x = 1; // keep this comment';
      const result = compress(input, 'mid');
      assert.ok(result.text.includes('// keep this comment'));
    });
  });

  describe('import collapse (haiku only)', () => {
    it('collapses JS import blocks for haiku', () => {
      const input = "import React from 'react';\nimport { useState } from 'react';\nimport axios from 'axios';\n\nfunction App() {}";
      const result = compress(input, 'cheap');
      assert.ok(result.text.includes('[3 imports collapsed]'));
      assert.ok(result.text.includes('function App() {}'));
    });

    it('does NOT collapse imports for mid tier', () => {
      const input = "import React from 'react';\nimport axios from 'axios';\n\nfunction App() {}";
      const result = compress(input, 'mid');
      assert.ok(result.text.includes("import React from 'react'"));
    });
  });

  describe('no compression for premium', () => {
    it('returns input unchanged for premium tier', () => {
      const input = 'const x = 1; // comment\n\n\n\nline2';
      const result = compress(input, 'premium');
      assert.strictEqual(result.text, input);
      assert.strictEqual(result.savings, 0);
    });
  });

  describe('result structure', () => {
    it('returns text, originalLength, compressedLength, savings', () => {
      const result = compress('hello   \n\n\n\nworld', 'mid');
      assert.ok('text' in result);
      assert.ok('originalLength' in result);
      assert.ok('compressedLength' in result);
      assert.ok('savings' in result);
      assert.ok(result.savings >= 0 && result.savings <= 1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/compressor.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement compressor**

Create `src/compressor.js`:
```javascript
'use strict';

function collapseWhitespace(text) {
  // Collapse 3+ newlines to 2
  let result = text.replace(/\n{3,}/g, '\n\n');
  // Trim trailing whitespace per line
  result = result.replace(/[ \t]+$/gm, '');
  return result;
}

function stripComments(text) {
  // Strip single-line JS/TS comments (// ...) but not URLs (://)
  let result = text.replace(/(?<!:)\/\/[^\n]*/g, '');
  // Strip Python/Shell comments (# ...) but not shebangs and not inside strings
  result = result.replace(/(?<!^#!)(?<=\s)#[^\n]*/gm, '');
  // Clean up empty lines left behind
  result = result.replace(/^\s*\n/gm, '\n');
  return result;
}

function collapseImports(text) {
  // Match consecutive import/require lines
  const importRegex = /^(import\s+.+|const\s+.+=\s*require\(.+\));?\s*$/;
  const lines = text.split('\n');
  const result = [];
  let importBlock = [];

  for (let i = 0; i < lines.length; i++) {
    if (importRegex.test(lines[i].trim())) {
      importBlock.push(lines[i]);
    } else {
      if (importBlock.length > 0) {
        if (importBlock.length >= 2) {
          result.push(`[${importBlock.length} imports collapsed]`);
        } else {
          result.push(...importBlock);
        }
        importBlock = [];
      }
      result.push(lines[i]);
    }
  }

  // Flush remaining imports
  if (importBlock.length >= 2) {
    result.push(`[${importBlock.length} imports collapsed]`);
  } else if (importBlock.length > 0) {
    result.push(...importBlock);
  }

  return result.join('\n');
}

function compress(text, tier) {
  if (tier === 'premium') {
    return {
      text,
      originalLength: text.length,
      compressedLength: text.length,
      savings: 0,
    };
  }

  const originalLength = text.length;
  let compressed = text;

  // Always: whitespace cleanup
  compressed = collapseWhitespace(compressed);

  // Haiku only: strip comments + collapse imports
  if (tier === 'cheap') {
    compressed = stripComments(compressed);
    compressed = collapseImports(compressed);
    compressed = collapseWhitespace(compressed); // re-clean after stripping
  }

  const compressedLength = compressed.length;
  const savings = originalLength > 0
    ? parseFloat(((originalLength - compressedLength) / originalLength).toFixed(4))
    : 0;

  return { text: compressed, originalLength, compressedLength, savings };
}

module.exports = { compress };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/compressor.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/arturo/optym-lite
git add src/compressor.js tests/compressor.test.js
git commit -m "feat: input compressor (whitespace, comments, imports)"
```

---

### Task 4: Model Mapper

**Files:**
- Create: `src/model-mapper.js`
- Create: `tests/model-mapper.test.js`

- [ ] **Step 1: Write model-mapper tests**

Create `tests/model-mapper.test.js`:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mapToModel, setOverride, clearOverride, getOverride } = require('../src/model-mapper');
const { MODELS } = require('../src/pricing');

describe('model-mapper', () => {
  it('maps low score to haiku', () => {
    const model = mapToModel(0.1);
    assert.strictEqual(model.id, MODELS.cheap.id);
  });

  it('maps mid score to sonnet', () => {
    const model = mapToModel(0.5);
    assert.strictEqual(model.id, MODELS.mid.id);
  });

  it('maps high score to opus', () => {
    const model = mapToModel(0.8);
    assert.strictEqual(model.id, MODELS.premium.id);
  });

  it('maps boundary 0.3 to mid', () => {
    const model = mapToModel(0.3);
    assert.strictEqual(model.id, MODELS.mid.id);
  });

  it('maps boundary 0.6 to mid', () => {
    const model = mapToModel(0.6);
    assert.strictEqual(model.id, MODELS.mid.id);
  });

  it('maps boundary 0.61 to premium', () => {
    const model = mapToModel(0.61);
    assert.strictEqual(model.id, MODELS.premium.id);
  });

  describe('override', () => {
    it('overrides tier regardless of score', () => {
      setOverride('cheap');
      const model = mapToModel(0.9); // would be opus
      assert.strictEqual(model.id, MODELS.cheap.id);
      clearOverride();
    });

    it('clearOverride restores normal mapping', () => {
      setOverride('premium');
      clearOverride();
      const model = mapToModel(0.1);
      assert.strictEqual(model.id, MODELS.cheap.id);
    });

    it('getOverride returns current override', () => {
      setOverride('mid');
      assert.strictEqual(getOverride(), 'mid');
      clearOverride();
      assert.strictEqual(getOverride(), null);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/model-mapper.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement model-mapper**

Create `src/model-mapper.js`:
```javascript
'use strict';

const { MODELS } = require('./pricing');

let currentOverride = null;

function mapToModel(score) {
  if (currentOverride && MODELS[currentOverride]) {
    return MODELS[currentOverride];
  }

  if (score > 0.6) return MODELS.premium;
  if (score < 0.3) return MODELS.cheap;
  return MODELS.mid;
}

function setOverride(tier) {
  if (!MODELS[tier]) throw new Error(`Unknown tier: ${tier}`);
  currentOverride = tier;
}

function clearOverride() {
  currentOverride = null;
}

function getOverride() {
  return currentOverride;
}

module.exports = { mapToModel, setOverride, clearOverride, getOverride };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/model-mapper.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/arturo/optym-lite
git add src/model-mapper.js tests/model-mapper.test.js
git commit -m "feat: model mapper with tier override support"
```

---

### Task 5: Config manager

**Files:**
- Create: `src/config.js`
- Create: `tests/config.test.js`

- [ ] **Step 1: Write config tests**

Create `tests/config.test.js`:
```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Use temp dir for tests
const testDir = path.join(os.tmpdir(), 'optym-lite-test-' + Date.now());

describe('config', () => {
  let config;

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    // Re-require with test dir
    delete require.cache[require.resolve('../src/config')];
    process.env.OPTYM_LITE_DIR = testDir;
    config = require('../src/config');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.OPTYM_LITE_DIR;
  });

  it('returns defaults when no config file', () => {
    const cfg = config.load();
    assert.strictEqual(cfg.port, 8088);
    assert.strictEqual(cfg.nudgeInterval, 20);
    assert.strictEqual(cfg.nudgeEnabled, true);
    assert.strictEqual(cfg.silent, false);
    assert.strictEqual(cfg.defaultTier, null);
  });

  it('saves and loads config', () => {
    config.save({ port: 9090, nudgeInterval: 50 });
    const cfg = config.load();
    assert.strictEqual(cfg.port, 9090);
    assert.strictEqual(cfg.nudgeInterval, 50);
  });

  it('detects pro mode from env', () => {
    process.env.OPTYM_PRO_KEY = 'optym_test_key';
    const cfg = config.load();
    assert.strictEqual(cfg.proMode, true);
    assert.strictEqual(cfg.proKey, 'optym_test_key');
    delete process.env.OPTYM_PRO_KEY;
  });

  it('detects free mode when no key', () => {
    delete process.env.OPTYM_PRO_KEY;
    const cfg = config.load();
    assert.strictEqual(cfg.proMode, false);
    assert.strictEqual(cfg.proKey, null);
  });

  it('getDataDir creates directory', () => {
    const dir = config.getDataDir();
    assert.ok(fs.existsSync(dir));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/config.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement config**

Create `src/config.js`:
```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULTS = {
  port: 8088,
  nudgeInterval: 20,
  nudgeEnabled: true,
  silent: false,
  defaultTier: null,
  upstream: 'https://api.anthropic.com',
  proUpstream: 'https://api.optym.pro',
};

function getDataDir() {
  const dir = process.env.OPTYM_LITE_DIR || path.join(os.homedir(), '.optym-lite');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function configPath() {
  return path.join(getDataDir(), 'config.json');
}

function load() {
  let stored = {};
  const cfgPath = configPath();
  if (fs.existsSync(cfgPath)) {
    stored = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }

  const proKey = process.env.OPTYM_PRO_KEY || null;

  return {
    ...DEFAULTS,
    ...stored,
    proMode: !!proKey,
    proKey,
  };
}

function save(overrides) {
  const cfgPath = configPath();
  let existing = {};
  if (fs.existsSync(cfgPath)) {
    existing = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
  const merged = { ...existing, ...overrides };
  // Don't persist runtime-only fields
  delete merged.proMode;
  delete merged.proKey;
  fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2));
}

module.exports = { load, save, getDataDir, DEFAULTS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/config.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/arturo/optym-lite
git add src/config.js tests/config.test.js
git commit -m "feat: config manager with pro mode detection"
```

---

### Task 6: Savings Tracker (SQLite)

**Files:**
- Create: `src/savings-tracker.js`
- Create: `src/stats-writer.js`
- Create: `tests/savings-tracker.test.js`

- [ ] **Step 1: Write savings tracker tests**

Create `tests/savings-tracker.test.js`:
```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const testDir = path.join(os.tmpdir(), 'optym-lite-tracker-' + Date.now());

describe('savings-tracker', () => {
  let tracker;

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    process.env.OPTYM_LITE_DIR = testDir;
    delete require.cache[require.resolve('../src/savings-tracker')];
    delete require.cache[require.resolve('../src/config')];
    tracker = require('../src/savings-tracker');
    tracker.init('test-session-1');
  });

  afterEach(() => {
    tracker.close();
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.OPTYM_LITE_DIR;
  });

  it('records a request and returns stats', () => {
    tracker.record({
      sessionId: 'test-session-1',
      originalModel: 'claude-opus-4-6',
      routedModel: 'claude-haiku-4-5-20251001',
      inputTokens: 1000,
      inputCompressed: 800,
      outputTokens: 500,
      costActual: 0.0028,
      costOriginal: 0.0525,
      classifierScore: 0.1,
    });

    const stats = tracker.getSessionStats('test-session-1');
    assert.strictEqual(stats.requests, 1);
    assert.ok(stats.savingsUsd > 0);
    assert.ok(stats.savingsPct > 0);
  });

  it('tracks tier distribution', () => {
    tracker.record({
      sessionId: 'test-session-1',
      originalModel: 'claude-opus-4-6',
      routedModel: 'claude-haiku-4-5-20251001',
      inputTokens: 100, inputCompressed: 100,
      outputTokens: 50, costActual: 0.001,
      costOriginal: 0.01, classifierScore: 0.1,
    });
    tracker.record({
      sessionId: 'test-session-1',
      originalModel: 'claude-opus-4-6',
      routedModel: 'claude-sonnet-4-6',
      inputTokens: 100, inputCompressed: 100,
      outputTokens: 50, costActual: 0.005,
      costOriginal: 0.01, classifierScore: 0.5,
    });

    const stats = tracker.getSessionStats('test-session-1');
    assert.strictEqual(stats.requests, 2);
    assert.strictEqual(stats.tierDistribution.haiku, 1);
    assert.strictEqual(stats.tierDistribution.sonnet, 1);
    assert.strictEqual(stats.tierDistribution.opus, 0);
  });

  it('gets all-time stats', () => {
    tracker.record({
      sessionId: 'test-session-1',
      originalModel: 'claude-opus-4-6',
      routedModel: 'claude-haiku-4-5-20251001',
      inputTokens: 1000, inputCompressed: 800,
      outputTokens: 500, costActual: 0.003,
      costOriginal: 0.05, classifierScore: 0.1,
    });

    const stats = tracker.getAllTimeStats();
    assert.ok(stats.savingsUsd > 0);
    assert.ok(stats.totalRequests >= 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/savings-tracker.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement savings tracker**

Create `src/savings-tracker.js`:
```javascript
'use strict';

const Database = require('better-sqlite3');
const path = require('node:path');
const { getDataDir } = require('./config');

let db = null;

function init(sessionId) {
  const dbPath = path.join(getDataDir(), 'savings.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      session_id TEXT NOT NULL,
      original_model TEXT NOT NULL,
      routed_model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      input_compressed INTEGER,
      output_tokens INTEGER NOT NULL,
      cost_actual REAL NOT NULL,
      cost_original REAL NOT NULL,
      classifier_score REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT DEFAULT (datetime('now')),
      total_requests INTEGER DEFAULT 0,
      total_saved REAL DEFAULT 0
    );
  `);

  // Upsert session
  db.prepare(`
    INSERT OR IGNORE INTO sessions (id) VALUES (?)
  `).run(sessionId);
}

const MODEL_TO_TIER_NAME = {
  'claude-haiku-4-5-20251001': 'haiku',
  'claude-sonnet-4-6': 'sonnet',
  'claude-opus-4-6': 'opus',
};

function record(data) {
  const insert = db.prepare(`
    INSERT INTO requests (session_id, original_model, routed_model, input_tokens, input_compressed, output_tokens, cost_actual, cost_original, classifier_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateSession = db.prepare(`
    UPDATE sessions SET total_requests = total_requests + 1, total_saved = total_saved + ? WHERE id = ?
  `);

  const saved = data.costOriginal - data.costActual;

  insert.run(
    data.sessionId, data.originalModel, data.routedModel,
    data.inputTokens, data.inputCompressed, data.outputTokens,
    data.costActual, data.costOriginal, data.classifierScore
  );
  updateSession.run(saved, data.sessionId);
}

function getSessionStats(sessionId) {
  const row = db.prepare(`
    SELECT
      COUNT(*) as requests,
      COALESCE(SUM(cost_original - cost_actual), 0) as savings_usd,
      COALESCE(SUM(cost_original), 0) as total_original,
      COALESCE(SUM(cost_actual), 0) as total_actual
    FROM requests WHERE session_id = ?
  `).get(sessionId);

  const tiers = db.prepare(`
    SELECT routed_model, COUNT(*) as cnt
    FROM requests WHERE session_id = ?
    GROUP BY routed_model
  `).all(sessionId);

  const tierDistribution = { haiku: 0, sonnet: 0, opus: 0 };
  for (const t of tiers) {
    const name = MODEL_TO_TIER_NAME[t.routed_model] || 'unknown';
    tierDistribution[name] = t.cnt;
  }

  return {
    requests: row.requests,
    savingsUsd: parseFloat(row.savings_usd.toFixed(4)),
    savingsPct: row.total_original > 0
      ? parseFloat(((row.savings_usd / row.total_original) * 100).toFixed(1))
      : 0,
    totalCost: parseFloat(row.total_actual.toFixed(4)),
    tierDistribution,
  };
}

function getAllTimeStats() {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total_requests,
      COALESCE(SUM(cost_original - cost_actual), 0) as savings_usd,
      COALESCE(SUM(cost_original), 0) as total_original
    FROM requests
  `).get();

  return {
    totalRequests: row.total_requests,
    savingsUsd: parseFloat(row.savings_usd.toFixed(4)),
    savingsPct: row.total_original > 0
      ? parseFloat(((row.savings_usd / row.total_original) * 100).toFixed(1))
      : 0,
  };
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { init, record, getSessionStats, getAllTimeStats, close };
```

- [ ] **Step 4: Implement stats writer**

Create `src/stats-writer.js`:
```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getDataDir } = require('./config');

function writeStats(sessionStats, allTimeStats) {
  const statsPath = path.join(getDataDir(), 'stats.json');
  const data = {
    session: {
      requests: sessionStats.requests,
      savings_pct: sessionStats.savingsPct,
      savings_usd: sessionStats.savingsUsd,
      tier_distribution: sessionStats.tierDistribution,
    },
    alltime: {
      savings_usd: allTimeStats.savingsUsd,
      savings_pct: allTimeStats.savingsPct,
    },
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(statsPath, JSON.stringify(data, null, 2));
}

function readStats() {
  const statsPath = path.join(getDataDir(), 'stats.json');
  if (!fs.existsSync(statsPath)) return null;
  return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
}

module.exports = { writeStats, readStats };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/savings-tracker.test.js`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /home/arturo/optym-lite
git add src/savings-tracker.js src/stats-writer.js tests/savings-tracker.test.js
git commit -m "feat: savings tracker (SQLite) + stats writer"
```

---

### Task 7: Branding engine

**Files:**
- Create: `src/branding.js`
- Create: `tests/branding.test.js`

- [ ] **Step 1: Write branding tests**

Create `tests/branding.test.js`:
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatFooter, shouldShowNudge, formatNudge, resetNudgeState } = require('../src/branding');

describe('branding', () => {
  describe('formatFooter', () => {
    it('formats free mode footer', () => {
      const line = formatFooter({ savingsPct: 23, savingsUsd: 2.10 }, false);
      assert.ok(line.includes('optym-lite'));
      assert.ok(line.includes('23%'));
      assert.ok(line.includes('2.10'));
      assert.ok(line.includes('optym.pro'));
    });

    it('formats pro mode footer', () => {
      const line = formatFooter({ savingsPct: 48, savingsUsd: 3.20 }, true);
      assert.ok(line.includes('optym PRO'));
      assert.ok(line.includes('48%'));
    });
  });

  describe('nudge logic', () => {
    it('shows nudge after N requests', () => {
      resetNudgeState();
      assert.strictEqual(shouldShowNudge(19, 20), false);
      assert.strictEqual(shouldShowNudge(20, 20), true);
    });

    it('does not re-nudge until next interval', () => {
      resetNudgeState();
      assert.strictEqual(shouldShowNudge(20, 20), true);
      assert.strictEqual(shouldShowNudge(21, 20), false);
      assert.strictEqual(shouldShowNudge(40, 20), true);
    });

    it('formats nudge message', () => {
      const msg = formatNudge(23, 2.10);
      assert.ok(msg.includes('23%'));
      assert.ok(msg.includes('optym.pro/upgrade'));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/branding.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement branding**

Create `src/branding.js`:
```javascript
'use strict';

let lastNudgeAt = 0;

function formatFooter(sessionStats, proMode) {
  const pct = sessionStats.savingsPct || 0;
  const usd = (sessionStats.savingsUsd || 0).toFixed(2);

  if (proMode) {
    return ` optym PRO: savings ${pct}% ($${usd} saved) | optym.pro/dashboard`;
  }
  return ` optym-lite: savings ${pct}% ($${usd} saved) | optym.pro`;
}

function shouldShowNudge(totalRequests, nudgeInterval) {
  if (nudgeInterval <= 0) return false;
  if (totalRequests > 0 && totalRequests % nudgeInterval === 0 && totalRequests !== lastNudgeAt) {
    lastNudgeAt = totalRequests;
    return true;
  }
  return false;
}

function formatNudge(savingsPct, savingsUsd) {
  return [
    '----------------------------------------------',
    ` This session: ${savingsPct}% savings with basic routing`,
    ' Optym Pro averages 50% with ML + cache + healing',
    ' optym.pro/upgrade | 14-day free trial',
    '----------------------------------------------',
  ].join('\n');
}

function resetNudgeState() {
  lastNudgeAt = 0;
}

module.exports = { formatFooter, shouldShowNudge, formatNudge, resetNudgeState };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/branding.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/arturo/optym-lite
git add src/branding.js tests/branding.test.js
git commit -m "feat: branding engine with footer and nudge logic"
```

---

### Task 8: HTTP Proxy

**Files:**
- Create: `src/proxy.js`
- Create: `tests/proxy.test.js`

- [ ] **Step 1: Write proxy tests**

Create `tests/proxy.test.js`:
```javascript
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const testDir = path.join(os.tmpdir(), 'optym-lite-proxy-' + Date.now());

describe('proxy', () => {
  let proxy, mockUpstream, proxyPort, upstreamPort;

  before(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.env.OPTYM_LITE_DIR = testDir;

    // Mock upstream that echoes back what it received
    mockUpstream = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello!' }],
          model: parsed.model,
          usage: { input_tokens: 100, output_tokens: 50 },
        }));
      });
    });

    await new Promise(resolve => {
      mockUpstream.listen(0, () => {
        upstreamPort = mockUpstream.address().port;
        resolve();
      });
    });

    // Clear cached modules
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/proxy')];
    delete require.cache[require.resolve('../src/savings-tracker')];

    const { startProxy } = require('../src/proxy');
    const server = await startProxy({
      port: 0,
      upstream: `http://localhost:${upstreamPort}`,
      sessionId: 'test-proxy-session',
    });
    proxyPort = server.address().port;
    proxy = server;
  });

  after(async () => {
    if (proxy) proxy.close();
    if (mockUpstream) mockUpstream.close();
    const tracker = require('../src/savings-tracker');
    tracker.close();
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.OPTYM_LITE_DIR;
  });

  function makeRequest(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  it('proxies request and rewrites model', async () => {
    const res = await makeRequest({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 100,
    });
    assert.strictEqual(res.status, 200);
    // "hello" should classify as haiku (greeting + short)
    assert.strictEqual(res.body.model, 'claude-haiku-4-5-20251001');
  });

  it('routes complex prompts to opus', async () => {
    const res = await makeRequest({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: 'design a microservices architecture for payment processing with authentication and rate limiting' }],
      max_tokens: 4000,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.model, 'claude-opus-4-6');
  });

  it('respects X-Optym-Force-Tier header', async () => {
    const data = JSON.stringify({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 100,
    });
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
          'X-Optym-Force-Tier': 'premium',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    assert.strictEqual(res.body.model, 'claude-opus-4-6');
  });

  it('passes through non-messages endpoints', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/health',
        method: 'GET',
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('optym-lite'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/arturo/optym-lite && node --test tests/proxy.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement proxy**

Create `src/proxy.js`:
```javascript
'use strict';

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const { classify } = require('./classifier');
const { compress } = require('./compressor');
const { mapToModel } = require('./model-mapper');
const { calculateCost } = require('./pricing');
const tracker = require('./savings-tracker');
const { writeStats, readStats } = require('./stats-writer');
const { load: loadConfig } = require('./config');

function extractUserContent(messages) {
  if (!Array.isArray(messages)) return '';
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return '';
  if (typeof lastUser.content === 'string') return lastUser.content;
  if (Array.isArray(lastUser.content)) {
    return lastUser.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  }
  return '';
}

function startProxy(options = {}) {
  const config = loadConfig();
  const port = options.port ?? config.port;
  const upstream = options.upstream ?? (config.proMode ? config.proUpstream : config.upstream);
  const sessionId = options.sessionId ?? `session-${Date.now()}`;

  tracker.init(sessionId);

  const server = http.createServer((req, res) => {
    // Health endpoint
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      const stats = readStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'optym-lite',
        mode: config.proMode ? 'pro' : 'free',
        session: sessionId,
        stats: stats?.session || null,
      }));
      return;
    }

    // Only intercept POST /v1/messages
    const isMessagesEndpoint = req.method === 'POST' && req.url === '/v1/messages';

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!isMessagesEndpoint) {
        // Pass through other endpoints
        forwardRequest(req, res, body, upstream, null);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const originalModel = parsed.model;
      const userContent = extractUserContent(parsed.messages);

      // Check force-tier header
      const forceTier = req.headers['x-optym-force-tier'];

      // Classify
      const classification = classify(userContent);
      let selectedModel;

      if (forceTier) {
        const tierMap = { cheap: 'cheap', haiku: 'cheap', mid: 'mid', sonnet: 'mid', premium: 'premium', opus: 'premium' };
        const tier = tierMap[forceTier.toLowerCase()];
        if (tier) {
          const { MODELS } = require('./pricing');
          selectedModel = MODELS[tier];
        } else {
          selectedModel = mapToModel(classification.score);
        }
      } else {
        selectedModel = mapToModel(classification.score);
      }

      // Compress input for non-premium tiers
      const tier = selectedModel.tier;
      if (tier !== 'premium' && parsed.system) {
        const compressed = compress(parsed.system, tier);
        parsed.system = compressed.text;
      }

      // Rewrite model
      parsed.model = selectedModel.id;
      const newBody = JSON.stringify(parsed);

      // Forward
      forwardRequest(req, res, newBody, upstream, (responseBody) => {
        // Track savings after response
        try {
          const respParsed = JSON.parse(responseBody);
          const usage = respParsed.usage || {};
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;

          const costActual = calculateCost(selectedModel.id, inputTokens, outputTokens) || 0;
          const costOriginal = calculateCost(originalModel, inputTokens, outputTokens) || costActual;

          tracker.record({
            sessionId,
            originalModel,
            routedModel: selectedModel.id,
            inputTokens,
            inputCompressed: inputTokens,
            outputTokens,
            costActual,
            costOriginal,
            classifierScore: classification.score,
          });

          // Update stats file
          const sessionStats = tracker.getSessionStats(sessionId);
          const allTimeStats = tracker.getAllTimeStats();
          writeStats(sessionStats, allTimeStats);
        } catch {
          // Don't crash proxy on tracking errors
        }
      });
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

function forwardRequest(clientReq, clientRes, body, upstream, onResponse) {
  const upstreamUrl = new URL(upstream);
  const isHttps = upstreamUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers = { ...clientReq.headers };
  delete headers['host'];
  delete headers['x-optym-force-tier'];
  headers['content-length'] = Buffer.byteLength(body);

  const options = {
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (isHttps ? 443 : 80),
    path: clientReq.url,
    method: clientReq.method,
    headers,
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    let responseBody = '';
    proxyRes.on('data', chunk => { responseBody += chunk; });
    proxyRes.on('end', () => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      clientRes.end(responseBody);
      if (onResponse) onResponse(responseBody);
    });
  });

  proxyReq.on('error', (err) => {
    clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Upstream error', message: err.message }));
  });

  proxyReq.write(body);
  proxyReq.end();
}

module.exports = { startProxy };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/arturo/optym-lite && node --test tests/proxy.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/arturo/optym-lite
git add src/proxy.js tests/proxy.test.js
git commit -m "feat: HTTP proxy with classification, compression, and tracking"
```

---

### Task 9: CLI (commander)

**Files:**
- Create: `bin/optym-lite.js`

- [ ] **Step 1: Create CLI entry point**

Create `bin/optym-lite.js`:
```javascript
#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('node:path');
const fs = require('node:fs');
const { version } = require('../package.json');

program
  .name('optym-lite')
  .description('Local proxy for Anthropic API cost optimization')
  .version(version);

program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('--pro', 'Force Pro mode (requires OPTYM_PRO_KEY env var)')
  .action(async (opts) => {
    const config = require('../src/config');
    const cfg = config.load();
    const port = opts.port || cfg.port;

    if (opts.pro && !cfg.proKey) {
      console.error('Error: --pro requires OPTYM_PRO_KEY environment variable');
      process.exit(1);
    }

    const mode = cfg.proMode ? 'PRO' : 'free';
    const upstream = cfg.proMode ? cfg.proUpstream : cfg.upstream;

    console.log(`optym-lite v${version}`);
    console.log(`Mode: ${mode}`);
    console.log(`Upstream: ${upstream}`);
    console.log(`Starting on port ${port}...`);

    const { startProxy } = require('../src/proxy');
    const server = await startProxy({ port });

    console.log(`\noptym-lite running on http://localhost:${port}`);
    console.log(`\nSetup: export ANTHROPIC_BASE_URL=http://localhost:${port}`);
    console.log('\nPress Ctrl+C to stop');

    // Write PID file for stop command
    const pidFile = path.join(config.getDataDir(), 'proxy.pid');
    fs.writeFileSync(pidFile, process.pid.toString());

    process.on('SIGINT', () => {
      console.log('\nStopping optym-lite...');
      server.close();
      const tracker = require('../src/savings-tracker');
      tracker.close();
      fs.unlinkSync(pidFile);
      process.exit(0);
    });
  });

program
  .command('stop')
  .description('Stop the proxy server')
  .action(() => {
    const config = require('../src/config');
    const pidFile = path.join(config.getDataDir(), 'proxy.pid');
    if (!fs.existsSync(pidFile)) {
      console.log('optym-lite is not running');
      return;
    }
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    try {
      process.kill(pid, 'SIGINT');
      console.log('optym-lite stopped');
    } catch {
      console.log('optym-lite was not running (stale PID)');
      fs.unlinkSync(pidFile);
    }
  });

program
  .command('status')
  .description('Show proxy status')
  .action(() => {
    const config = require('../src/config');
    const { readStats } = require('../src/stats-writer');
    const pidFile = path.join(config.getDataDir(), 'proxy.pid');
    const running = fs.existsSync(pidFile);
    const cfg = config.load();
    const stats = readStats();

    console.log(`optym-lite ${running ? 'RUNNING' : 'STOPPED'}`);
    console.log(`Mode: ${cfg.proMode ? 'PRO' : 'free'}`);
    console.log(`Port: ${cfg.port}`);
    if (stats?.session) {
      console.log(`Session: ${stats.session.requests} requests | ${stats.session.savings_pct}% savings ($${stats.session.savings_usd.toFixed(2)} saved)`);
    }
  });

program
  .command('stats')
  .description('Show savings statistics')
  .option('-a, --all', 'Show all-time stats')
  .action((opts) => {
    const { readStats } = require('../src/stats-writer');
    const stats = readStats();
    if (!stats) {
      console.log('No stats yet. Start the proxy and make some requests.');
      return;
    }

    const s = stats.session;
    console.log('╭─────────────── optym-lite ───────────────╮');
    console.log(`│ Session:  ${s.requests} requests                     │`);
    console.log(`│ Routing:  Haiku ${s.tier_distribution.haiku} | Sonnet ${s.tier_distribution.sonnet} | Opus ${s.tier_distribution.opus}`);
    console.log(`│ Saved:    $${s.savings_usd.toFixed(2)} (${s.savings_pct}%)`);
    if (opts.all) {
      const a = stats.alltime;
      console.log(`│─────────────────────────────────────────│`);
      console.log(`│ All time: $${a.savings_usd.toFixed(2)} saved (${a.savings_pct}%)`);
    }
    console.log('╰───────────────────────────────────────────╯');
  });

program
  .command('config')
  .description('Configure optym-lite')
  .option('--show', 'Show current config')
  .option('--port <port>', 'Set proxy port', parseInt)
  .option('--nudge-interval <n>', 'Set nudge interval (requests)', parseInt)
  .option('--no-nudge', 'Disable upgrade nudges')
  .option('--default-tier <tier>', 'Set default tier (cheap/mid/premium)')
  .option('--silent', 'Disable all output')
  .action((opts) => {
    const config = require('../src/config');
    if (opts.show) {
      const cfg = config.load();
      console.log(JSON.stringify(cfg, null, 2));
      return;
    }
    const updates = {};
    if (opts.port) updates.port = opts.port;
    if (opts.nudgeInterval) updates.nudgeInterval = opts.nudgeInterval;
    if (opts.nudge === false) updates.nudgeEnabled = false;
    if (opts.defaultTier) updates.defaultTier = opts.defaultTier;
    if (opts.silent) updates.silent = true;

    if (Object.keys(updates).length > 0) {
      config.save(updates);
      console.log('Config updated:', updates);
    } else {
      console.log('No changes. Use --show to see current config.');
    }
  });

program
  .command('upgrade')
  .description('Open Optym Pro upgrade page')
  .action(() => {
    const { exec } = require('node:child_process');
    const url = 'https://optym.pro/upgrade';
    console.log(`Opening ${url}...`);
    // Cross-platform open
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} ${url}`);
  });

program.parse();
```

- [ ] **Step 2: Make executable and test CLI help**

Run: `chmod +x /home/arturo/optym-lite/bin/optym-lite.js && cd /home/arturo/optym-lite && node bin/optym-lite.js --help`
Expected: Shows help with all commands (start, stop, status, stats, config, upgrade)

- [ ] **Step 3: Commit**

```bash
cd /home/arturo/optym-lite
git add bin/optym-lite.js
git commit -m "feat: CLI with start/stop/status/stats/config/upgrade commands"
```

---

### Task 10: Claude Code skills

**Files:**
- Create: `skills/savings/skill.md`
- Create: `skills/force-opus/skill.md`
- Create: `skills/force-haiku/skill.md`
- Create: `skills/force-sonnet/skill.md`
- Create: `skills/optym-status/skill.md`
- Create: `skills/optym-reset/skill.md`

- [ ] **Step 1: Create savings skill**

Create `skills/savings/skill.md`:
```markdown
---
name: savings
description: Show optym-lite savings dashboard for current session
---

Read the optym-lite stats file and display savings dashboard.

Run this command and display the output to the user:

\`\`\`bash
optym-lite stats
\`\`\`

If optym-lite is not installed or not running, inform the user:
"optym-lite is not running. Start it with: optym-lite start"
```

- [ ] **Step 2: Create force-tier skills**

Create `skills/force-opus/skill.md`:
```markdown
---
name: force-opus
description: Force all requests to use Claude Opus (premium tier)
---

Write "premium" to the optym-lite override file:

\`\`\`bash
mkdir -p ~/.optym-lite && echo "premium" > ~/.optym-lite/force-tier
\`\`\`

Tell the user: "All requests will now use Opus. Use /optym-reset to return to auto-routing."
```

Create `skills/force-haiku/skill.md`:
```markdown
---
name: force-haiku
description: Force all requests to use Claude Haiku (cheap tier)
---

Write "cheap" to the optym-lite override file:

\`\`\`bash
mkdir -p ~/.optym-lite && echo "cheap" > ~/.optym-lite/force-tier
\`\`\`

Tell the user: "All requests will now use Haiku. Use /optym-reset to return to auto-routing."
```

Create `skills/force-sonnet/skill.md`:
```markdown
---
name: force-sonnet
description: Force all requests to use Claude Sonnet (mid tier)
---

Write "mid" to the optym-lite override file:

\`\`\`bash
mkdir -p ~/.optym-lite && echo "mid" > ~/.optym-lite/force-tier
\`\`\`

Tell the user: "All requests will now use Sonnet. Use /optym-reset to return to auto-routing."
```

- [ ] **Step 3: Create status and reset skills**

Create `skills/optym-status/skill.md`:
```markdown
---
name: optym-status
description: Show optym-lite proxy status (running/stopped, mode, port)
---

Run this command and display the output to the user:

\`\`\`bash
optym-lite status
\`\`\`
```

Create `skills/optym-reset/skill.md`:
```markdown
---
name: optym-reset
description: Clear tier override and return to auto-routing
---

Remove the optym-lite override file:

\`\`\`bash
rm -f ~/.optym-lite/force-tier
\`\`\`

Tell the user: "Auto-routing restored. optym-lite will classify prompts automatically."
```

- [ ] **Step 4: Commit**

```bash
cd /home/arturo/optym-lite
git add skills/
git commit -m "feat: Claude Code skills (savings, force-tier, status, reset)"
```

---

### Task 11: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Create `README.md`:
```markdown
# optym-lite

**Save 20-30% on your Anthropic API costs.** Open-source local proxy that routes Claude requests to the cheapest model that can handle the task.

```
You (always Opus) ──→ $$$$$
You + optym-lite  ──→ $$    (Haiku for simple tasks, Sonnet for medium, Opus for complex)
You + Optym Pro   ──→ $     (ML routing + cache + healing → 45-55% savings)
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
Your Client → optym-lite (localhost:8088) → api.anthropic.com
                  │
                  ├─ Classifies prompt complexity
                  ├─ Routes to Haiku / Sonnet / Opus
                  ├─ Compresses input tokens
                  └─ Tracks your savings
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

If you use Claude Code, install the skills for in-session control:

```bash
optym-lite install-skills
```

Then use:
- `/savings` — Show savings dashboard
- `/force-opus` — Force Opus for all requests
- `/force-haiku` — Force Haiku for all requests
- `/force-sonnet` — Force Sonnet for all requests
- `/optym-reset` — Return to auto-routing
- `/optym-status` — Proxy status

## Optym Pro

optym-lite gives you **20-30% savings** with static rules. Want more?

**[Optym Pro](https://optym.pro)** uses ML classifiers, semantic caching, speculative execution, and self-healing to achieve **45-55% savings**.

Upgrade is a config change — no reinstall needed:

```bash
export OPTYM_PRO_KEY=optym_your_key
optym-lite restart
```

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
cd /home/arturo/optym-lite
git add README.md
git commit -m "docs: add README with quickstart, usage, and Pro upgrade info"
```

---

### Task 12: Integration test + full run

**Files:**
- Create: `tests/integration.test.js`

- [ ] **Step 1: Write integration test**

Create `tests/integration.test.js`:
```javascript
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const testDir = path.join(os.tmpdir(), 'optym-lite-integration-' + Date.now());

describe('integration: full request cycle', () => {
  let proxy, mockUpstream, proxyPort;

  before(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.env.OPTYM_LITE_DIR = testDir;

    // Clear all cached modules
    for (const key of Object.keys(require.cache)) {
      if (key.includes('optym-lite/src')) delete require.cache[key];
    }

    // Mock Anthropic upstream
    mockUpstream = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Response' }],
          model: parsed.model,
          usage: { input_tokens: 500, output_tokens: 200 },
        }));
      });
    });

    const upstreamPort = await new Promise(resolve => {
      mockUpstream.listen(0, () => resolve(mockUpstream.address().port));
    });

    const { startProxy } = require('../src/proxy');
    proxy = await startProxy({
      port: 0,
      upstream: `http://localhost:${upstreamPort}`,
      sessionId: 'integration-test',
    });
    proxyPort = proxy.address().port;
  });

  after(() => {
    if (proxy) proxy.close();
    if (mockUpstream) mockUpstream.close();
    const tracker = require('../src/savings-tracker');
    tracker.close();
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.OPTYM_LITE_DIR;
  });

  function post(content) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content }],
        max_tokens: 1000,
      });
      const req = http.request({
        hostname: 'localhost', port: proxyPort,
        path: '/v1/messages', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test', 'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  it('routes simple prompt to haiku, complex to opus, medium to sonnet', async () => {
    const r1 = await post('hello');
    assert.strictEqual(r1.model, 'claude-haiku-4-5-20251001');

    const r2 = await post('design a distributed system architecture for real-time data processing');
    assert.strictEqual(r2.model, 'claude-opus-4-6');

    const r3 = await post('add a try-catch block around this database call');
    assert.strictEqual(r3.model, 'claude-sonnet-4-6');
  });

  it('stats file exists after requests', async () => {
    // Wait a tick for async write
    await new Promise(r => setTimeout(r, 100));
    const statsPath = path.join(testDir, 'stats.json');
    assert.ok(fs.existsSync(statsPath));
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    assert.ok(stats.session.requests >= 3);
    assert.ok(stats.session.savings_pct > 0);
  });

  it('savings DB has records', () => {
    const dbPath = path.join(testDir, 'savings.db');
    assert.ok(fs.existsSync(dbPath));
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd /home/arturo/optym-lite && node --test tests/*.test.js`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /home/arturo/optym-lite
git add tests/integration.test.js
git commit -m "test: integration test for full request cycle"
```

- [ ] **Step 4: Push to remote**

```bash
cd /home/arturo/optym-lite && git push -u origin main
```
