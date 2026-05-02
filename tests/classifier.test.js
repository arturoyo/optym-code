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
