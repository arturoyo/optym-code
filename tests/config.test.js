const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const testDir = path.join(os.tmpdir(), 'optym-lite-test-' + Date.now());

describe('config', () => {
  let config;

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
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
