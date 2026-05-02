#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const path = require('node:path');
const fs = require('node:fs');
const { version } = require('../package.json');

program
  .name('optym-code')
  .description('Save 20-55% on Claude Code costs. Routes + compresses automatically.')
  .version(version);

program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Port to listen on', parseInt)
  .option('--pro', 'Force Pro mode (requires OPTYM_PRO_KEY env var)')
  .action(async (opts) => {
    const config = require('../src/config');
    const cfg = config.load();
    const port = opts.port || cfg.port;

    if (opts.pro && !cfg.proKey) {
      console.error('Error: --pro requires OPTYM_PRO_KEY environment variable');
      process.exit(1);
    }

    const mode = cfg.proMode ? 'PRO' : 'free';
    const upstream = cfg.proMode ? cfg.proUpstream : cfg.upstream;

    console.log(`optym-lite v${version}`);
    console.log(`Mode: ${mode}`);
    console.log(`Upstream: ${upstream}`);
    console.log(`Starting on port ${port}...`);

    const { startProxy } = require('../src/proxy');
    const server = await startProxy({ port });

    console.log(`\noptym-lite running on http://localhost:${port}`);
    console.log(`\nSetup: export ANTHROPIC_BASE_URL=http://localhost:${port}`);
    console.log('\nPress Ctrl+C to stop');

    const pidFile = path.join(config.getDataDir(), 'proxy.pid');
    fs.writeFileSync(pidFile, process.pid.toString());

    process.on('SIGINT', () => {
      console.log('\nStopping optym-lite...');
      server.close();
      const tracker = require('../src/savings-tracker');
      tracker.close();
      try { fs.unlinkSync(pidFile); } catch {}
      process.exit(0);
    });
  });

program
  .command('stop')
  .description('Stop the proxy server')
  .action(() => {
    const config = require('../src/config');
    const pidFile = path.join(config.getDataDir(), 'proxy.pid');
    if (!fs.existsSync(pidFile)) {
      console.log('optym-lite is not running');
      return;
    }
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    try {
      process.kill(pid, 'SIGINT');
      console.log('optym-lite stopped');
    } catch {
      console.log('optym-lite was not running (stale PID)');
      fs.unlinkSync(pidFile);
    }
  });

program
  .command('status')
  .description('Show proxy status')
  .action(() => {
    const config = require('../src/config');
    const { readStats } = require('../src/stats-writer');
    const pidFile = path.join(config.getDataDir(), 'proxy.pid');
    const running = fs.existsSync(pidFile);
    const cfg = config.load();
    const stats = readStats();

    console.log(`optym-lite ${running ? 'RUNNING' : 'STOPPED'}`);
    console.log(`Mode: ${cfg.proMode ? 'PRO' : 'free'}`);
    console.log(`Port: ${cfg.port}`);
    if (stats?.session) {
      console.log(`Session: ${stats.session.requests} requests | ${stats.session.savings_pct}% savings ($${stats.session.savings_usd.toFixed(2)} saved)`);
    }
  });

program
  .command('stats')
  .description('Show savings statistics')
  .option('-a, --all', 'Show all-time stats')
  .action((opts) => {
    const { readStats } = require('../src/stats-writer');
    const stats = readStats();
    if (!stats) {
      console.log('No stats yet. Start the proxy and make some requests.');
      return;
    }

    const s = stats.session;
    console.log('╭─────────────── optym-lite ───────────────╮');
    console.log(`│ Session:  ${s.requests} requests`);
    console.log(`│ Routing:  Haiku ${s.tier_distribution.haiku} | Sonnet ${s.tier_distribution.sonnet} | Opus ${s.tier_distribution.opus}`);
    console.log(`│ Saved:    $${s.savings_usd.toFixed(2)} (${s.savings_pct}%)`);
    if (opts.all) {
      const a = stats.alltime;
      console.log('│───────────────────────────────────────────│');
      console.log(`│ All time: $${a.savings_usd.toFixed(2)} saved (${a.savings_pct}%)`);
    }
    console.log('╰───────────────────────────────────────────╯');
  });

program
  .command('config')
  .description('Configure optym-lite')
  .option('--show', 'Show current config')
  .option('--port <port>', 'Set proxy port', parseInt)
  .option('--nudge-interval <n>', 'Set nudge interval (requests)', parseInt)
  .option('--no-nudge', 'Disable upgrade nudges')
  .option('--default-tier <tier>', 'Set default tier (cheap/mid/premium)')
  .option('--silent', 'Disable all output')
  .action((opts) => {
    const config = require('../src/config');
    if (opts.show) {
      const cfg = config.load();
      console.log(JSON.stringify(cfg, null, 2));
      return;
    }
    const updates = {};
    if (opts.port) updates.port = opts.port;
    if (opts.nudgeInterval) updates.nudgeInterval = opts.nudgeInterval;
    if (opts.nudge === false) updates.nudgeEnabled = false;
    if (opts.defaultTier) updates.defaultTier = opts.defaultTier;
    if (opts.silent) updates.silent = true;

    if (Object.keys(updates).length > 0) {
      config.save(updates);
      console.log('Config updated:', updates);
    } else {
      console.log('No changes. Use --show to see current config.');
    }
  });

program
  .command('upgrade')
  .description('Open Optym Pro upgrade page')
  .action(() => {
    const { exec } = require('node:child_process');
    const url = 'https://optym.pro/upgrade';
    console.log(`Opening ${url}...`);
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} ${url}`);
  });

program.parse();
