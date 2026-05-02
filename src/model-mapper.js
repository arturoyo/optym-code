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
