const { describe, it } = require('node:test');
const assert = require('node:assert');
const { getModelPricing, calculateCost, MODELS, OPENAI_MODELS } = require('../src/pricing');

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
});
