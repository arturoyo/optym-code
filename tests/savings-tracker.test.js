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
