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
    delete process.env.OPTYM_PRO_KEY; // force free/local mode regardless of environment

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
