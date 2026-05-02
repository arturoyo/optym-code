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

function startProxy(options = {}) {
  const config = loadConfig();
  const port = options.port ?? config.port;
  const upstream = options.upstream ?? (config.proMode ? config.proUpstream : config.upstream);
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
    req.on('end', () => {
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

      // Classify
      const classification = classify(userContent);
      let selectedModel;

      if (forceTier) {
        const tierMap = { cheap: 'cheap', haiku: 'cheap', mid: 'mid', sonnet: 'mid', premium: 'premium', opus: 'premium' };
        const tier = tierMap[forceTier.toLowerCase()];
        if (tier) {
          selectedModel = MODELS[tier];
        } else {
          selectedModel = mapToModel(classification.score);
        }
      } else {
        selectedModel = mapToModel(classification.score);
      }

      // Compress input for non-premium tiers
      const tier = selectedModel.tier;
      if (tier !== 'premium' && parsed.system) {
        const compressed = compress(parsed.system, tier);
        parsed.system = compressed.text;
      }

      // Rewrite model
      parsed.model = selectedModel.id;
      const newBody = JSON.stringify(parsed);

      // Forward
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
