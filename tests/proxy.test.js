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

    // Mock upstream that echoes back what it received (multi-protocol)
    mockUpstream = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body);
        if (req.url === '/v1/chat/completions' && parsed.stream) {
          // SSE streaming mock
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","model":"' + parsed.model + '","choices":[{"delta":{"content":"Hi"},"index":0}]}\n\n');
          res.write('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","model":"' + parsed.model + '","choices":[{"delta":{},"index":0,"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n');
          res.write('data: [DONE]\n\n');
          res.end();
        } else if (req.url === '/v1/chat/completions') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            model: parsed.model,
            choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          }));
        } else if (req.url === '/v1/responses') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'resp-test',
            object: 'response',
            model: parsed.model,
            output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hello!' }] }],
            usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello!' }],
            model: parsed.model,
            usage: { input_tokens: 100, output_tokens: 50 },
          }));
        }
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

  function makeOpenAIRequest(body, endpoint = '/v1/chat/completions') {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
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

  it('handles OpenAI Chat Completions endpoint with model rewrite', async () => {
    const res = await makeOpenAIRequest({
      model: 'o3',
      messages: [{ role: 'user', content: 'hello' }],
    });
    assert.strictEqual(res.status, 200);
    // "hello" -> cheap -> gpt-4.1-mini
    assert.strictEqual(res.body.model, 'gpt-4.1-mini');
  });

  it('routes complex OpenAI Chat Completions to o3', async () => {
    const res = await makeOpenAIRequest({
      model: 'o3',
      messages: [{ role: 'user', content: 'design a microservices architecture for payment processing with authentication and rate limiting' }],
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.model, 'o3');
  });

  it('handles OpenAI Responses API endpoint with model rewrite', async () => {
    const res = await makeOpenAIRequest({
      model: 'o3',
      input: 'hello',
    }, '/v1/responses');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.model, 'gpt-4.1-mini');
  });

  it('handles OpenAI Responses API with array input', async () => {
    const res = await makeOpenAIRequest({
      model: 'o3',
      input: [{ role: 'user', content: 'design a distributed system architecture for real-time data processing' }],
    }, '/v1/responses');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.model, 'o3');
  });

  it('streams SSE responses without buffering for OpenAI', async () => {
    const chunks = [];
    await new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: 'o3',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      });
      const req = http.request({
        hostname: 'localhost',
        port: proxyPort,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        assert.strictEqual(res.headers['content-type'], 'text/event-stream');
        res.on('data', chunk => { chunks.push(chunk.toString()); });
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    const full = chunks.join('');
    assert.ok(full.includes('data: '));
    assert.ok(full.includes('[DONE]'));
    // Model was rewritten to gpt-4.1-mini (simple "hello")
    assert.ok(full.includes('gpt-4.1-mini'));
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
