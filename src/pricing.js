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
