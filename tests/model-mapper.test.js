const { describe, it } = require('node:test');
const assert = require('node:assert');
const { mapToModel, setOverride, clearOverride, getOverride } = require('../src/model-mapper');
const { MODELS, OPENAI_MODELS } = require('../src/pricing');

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
      const model = mapToModel(0.9);
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

    it('override works with openai provider', () => {
      setOverride('cheap');
      const model = mapToModel(0.9, 'openai');
      assert.strictEqual(model.id, 'gpt-4.1-mini');
      clearOverride();
    });
  });
});
