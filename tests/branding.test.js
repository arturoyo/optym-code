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
