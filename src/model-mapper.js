'use strict';

const { MODELS, OPENAI_MODELS } = require('./pricing');

let currentOverride = null;

function mapToModel(score, provider = 'anthropic') {
  const models = provider === 'openai' ? OPENAI_MODELS : MODELS;

  if (currentOverride && models[currentOverride]) {
    return models[currentOverride];
  }

  if (score > 0.6) return models.premium;
  if (score < 0.3) return models.cheap;
  return models.mid;
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
