'use strict';

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');
const { classify } = require('./classifier');
const { compress } = require('./compressor');
const { mapToModel } = require('./model-mapper');
const { calculateCost, MODELS } = require('./pricing');
const tracker = require('./savings-tracker');
const { writeStats } = require('./stats-writer');
const { load: loadConfig } = require('./config');

// Pro classify cache: prompt hash → { tier, model, score, ts }
const _proCache = new Map();
const PRO_CACHE_TTL_MS = 60_000;
const PRO_CLASSIFY_TIMEOUT_MS = 2000;

function extractUserContent(messages) {
  if (!Array.isArray(messages)) return '';
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUser) return '';
  if (typeof lastUser.content === 'string') return lastUser.content;
  if (Array.isArray(lastUser.content)) {
    return lastUser.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  }
  return '';
}

function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function _proClassify(prompt, proKey, proUpstream) {
  return new Promise((resolve) => {
    // Check cache
    const cacheKey = _simpleHash(prompt);
    const cached = _proCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PRO_CACHE_TTL_MS) {
      resolve(cached.result);
      return;
    }

    const url = new URL(proUpstream);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const data = JSON.stringify({
      prompt: prompt.slice(0, 4000), // limit prompt size sent to classify
      context_length: 0,
      provider: 'anthropic',
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/v1/classify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proKey}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: PRO_CLASSIFY_TIMEOUT_MS,
    };

    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const result = {
            score: parsed.score || 0.5,
            tier: parsed.tier || 'mid',
            model: parsed.model || MODELS.mid.id,
            signals: ['pro_classify'],
            proClassified: true,
          };
          // Cache result
          _proCache.set(cacheKey, { result, ts: Date.now() });
          // Cleanup old entries periodically
          if (_proCache.size > 1000) {
            const now = Date.now();
            for (const [k, v] of _proCache) {
              if (now - v.ts > PRO_CACHE_TTL_MS) _proCache.delete(k);
            }
          }
          resolve(result);
        } catch {
          resolve(null); // fallback to local
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(data);
    req.end();
  });
}

function startProxy(options = {}) {
  const config = loadConfig();
  const port = options.port ?? config.port;
  const upstream = options.upstream ?? config.upstream; // Always forward to Anthropic directly
  const sessionId = options.sessionId ?? `session-${Date.now()}`;

  tracker.init(sessionId);

  const server = http.createServer((req, res) => {
    // Health endpoint
    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'optym-lite',
        mode: config.proMode ? 'pro' : 'free',
        session: sessionId,
      }));
      return;
    }

    // Only intercept POST /v1/messages
    const isMessagesEndpoint = req.method === 'POST' && req.url === '/v1/messages';

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      if (!isMessagesEndpoint) {
        forwardRequest(req, res, body, upstream, null);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const originalModel = parsed.model;
      const userContent = extractUserContent(parsed.messages);

      // Check force-tier header
      const forceTier = req.headers['x-optym-force-tier'];

      // Classify — Pro (ML cloud) or Free (local regex)
      let classification;

      if (forceTier) {
        // Force tier overrides everything
        classification = { score: 0.5, tier: 'mid', signals: ['forced'] };
      } else if (config.proMode && config.proKey) {
        // Pro mode: ask api.optym.pro for ML classification
        const proResult = await _proClassify(userContent, config.proKey, config.proUpstream);
        if (proResult) {
          classification = proResult;
        } else {
          // Fallback to local on Pro failure
          classification = classify(userContent);
          classification.signals.push('pro_fallback');
        }
      } else {
        // Free mode: local static rules
        classification = classify(userContent);
      }

      // Select model
      let selectedModel;
      if (forceTier) {
        const tierMap = { cheap: 'cheap', haiku: 'cheap', mid: 'mid', sonnet: 'mid', premium: 'premium', opus: 'premium' };
        const tier = tierMap[forceTier.toLowerCase()];
        selectedModel = tier ? MODELS[tier] : mapToModel(classification.score);
      } else if (classification.proClassified && classification.model) {
        // Pro mode: use model from cloud classifier
        const modelEntry = Object.values(MODELS).find(m => m.id === classification.model);
        selectedModel = modelEntry || mapToModel(classification.score);
      } else {
        selectedModel = mapToModel(classification.score);
      }

      // Compress input for non-premium tiers
      const tier = selectedModel.tier;
      if (tier !== 'premium' && parsed.system) {
        const compressed = compress(parsed.system, tier);
        parsed.system = compressed.text;
      }

      // Output compression: inject terse instruction for cheaper tiers
      if (tier === 'cheap') {
        const terseInstruction = '\n\n[EFFICIENCY] Respond concisely. Use fragments, drop filler words, skip pleasantries. Lead with the answer. Technical terms exact, code blocks unchanged.';
        parsed.system = (parsed.system || '') + terseInstruction;
      } else if (tier === 'mid') {
        const terseInstruction = '\n\n[EFFICIENCY] Be concise. Skip unnecessary preamble. Lead with the answer.';
        parsed.system = (parsed.system || '') + terseInstruction;
      }

      // Rewrite model
      parsed.model = selectedModel.id;
      const newBody = JSON.stringify(parsed);

      // Forward to Anthropic (always direct, never through Optym for LLM calls)
      forwardRequest(req, res, newBody, upstream, (responseBody) => {
        try {
          const respParsed = JSON.parse(responseBody);
          const usage = respParsed.usage || {};
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;

          const costActual = calculateCost(selectedModel.id, inputTokens, outputTokens) || 0;
          const costOriginal = calculateCost(originalModel, inputTokens, outputTokens) || costActual;

          tracker.record({
            sessionId,
            originalModel,
            routedModel: selectedModel.id,
            inputTokens,
            inputCompressed: inputTokens,
            outputTokens,
            costActual,
            costOriginal,
            classifierScore: classification.score,
          });

          const sessionStats = tracker.getSessionStats(sessionId);
          const allTimeStats = tracker.getAllTimeStats();
          writeStats(sessionStats, allTimeStats);
        } catch {
          // Don't crash proxy on tracking errors
        }
      });
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve(server);
    });
  });
}

function forwardRequest(clientReq, clientRes, body, upstream, onResponse) {
  const upstreamUrl = new URL(upstream);
  const isHttps = upstreamUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers = { ...clientReq.headers };
  delete headers['host'];
  delete headers['x-optym-force-tier'];
  headers['content-length'] = Buffer.byteLength(body);

  const options = {
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (isHttps ? 443 : 80),
    path: clientReq.url,
    method: clientReq.method,
    headers,
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    let responseBody = '';
    proxyRes.on('data', chunk => { responseBody += chunk; });
    proxyRes.on('end', () => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      clientRes.end(responseBody);
      if (onResponse) onResponse(responseBody);
    });
  });

  proxyReq.on('error', (err) => {
    clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'Upstream error', message: err.message }));
  });

  proxyReq.write(body);
  proxyReq.end();
}

module.exports = { startProxy };
