const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const testDir = path.join(os.tmpdir(), 'optym-lite-proxy-' + Date.now());

describe('proxy', () => {
  let proxy, mockUpstream, proxyPort, upstreamPort;

  before(async () => {
    fs.mkdirSync(testDir, { recursive: true });
    process.env.OPTYM_LITE_DIR = testDir;

    // Mock upstream that echoes back what it received
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
          content: [{ type: 'text', text: 'Hello!' }],
          model: parsed.model,
          usage: { input_tokens: 100, output_tokens: 50 },
        }));
      });
    });

    await new Promise(resolve => {
      mockUpstream.listen(0, () => {
        upstreamPort = mockUpstream.address().port;
        resolve();
      });
    });

    // Clear cached modules
    for (const key of Object.keys(require.cache)) {
      if (key.includes('optym-lite/src')) delete require.cache[key];
    }

    const { startProxy } = require('../src/proxy');
    proxy = await startProxy({
      port: 0,
      upstream: `http://localhost:${upstreamPort}`,
      sessionId: 'test-proxy-session',
    });
    proxyPort = proxy.address().port;
  });

  after(async () => {
    if (proxy) proxy.close();
    if (mockUpstream) mockUpstream.close();
    const tracker = require('../src/savings-tracker');
    tracker.close();
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.OPTYM_LITE_DIR;
  });

  function makeRequest(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  it('proxies request and rewrites model for simple prompt', async () => {
    const res = await makeRequest({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 100,
    });
    assert.strictEqual(res.status, 200);
    // "hello" should classify as haiku (greeting + short)
    assert.strictEqual(res.body.model, 'claude-haiku-4-5-20251001');
  });

  it('routes complex prompts to opus', async () => {
    const res = await makeRequest({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: 'design a microservices architecture for payment processing with authentication and rate limiting' }],
      max_tokens: 4000,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.model, 'claude-opus-4-6');
  });

  it('respects X-Optym-Force-Tier header', async () => {
    const data = JSON.stringify({
      model: 'claude-opus-4-6',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 100,
    });
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01',
          'X-Optym-Force-Tier': 'premium',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    assert.strictEqual(res.body.model, 'claude-opus-4-6');
  });

  it('responds to health endpoint', async () => {
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/health',
        method: 'GET',
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('optym-lite'));
  });
});
