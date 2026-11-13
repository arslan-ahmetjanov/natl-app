'use strict';

/**
 * Smoke test for the app's engine integration, without the GUI.
 *
 *   node apps/desktop/scripts/smoke-natl-run.js
 *
 * Serves the offline NATL fixture, writes a scenario into a temporary
 * workspace and runs it through the same code path the desktop app uses.
 * Fails the process if the scenario does not pass.
 */

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runScenario } = require('../electron/natl/run');

const FIXTURES = path.join(__dirname, '..', '..', '..', 'examples', 'fixtures');

function serveFixtures() {
  const server = http.createServer((req, res) => {
    const name = (req.url || '/').split('?')[0].replace(/^\//, '') || 'sandbox.html';
    try {
      const body = fs.readFileSync(path.join(FIXTURES, name));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function scenarioFor(port) {
  return [
    'name: Sandbox login',
    'engine: playwright',
    'vars:',
    `  base_url: http://127.0.0.1:${port}/sandbox.html`,
    'steps:',
    '  - goto: $base_url',
    '  - fill: "#email"',
    '    with: demo@natl.dev',
    '  - fill: "#password"',
    '    with: secret',
    '  - click: "#login-btn"',
    '  - assert: .welcome',
    '    visible: true',
    '',
  ].join('\n');
}

(async () => {
  const { server, port } = await serveFixtures();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-smoke-'));
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });

  const file = path.join(root, 'tests', 'login.yaml');
  fs.writeFileSync(file, scenarioFor(port));

  const events = [];
  const result = await runScenario({
    root,
    file,
    headless: true,
    onProgress: (event) => events.push(event.type),
  });

  server.close();

  console.log(`scenario: ${result.ok ? 'passed' : 'failed'} in ${result.durationMs} ms`);
  for (const step of result.steps || []) {
    console.log(`  ${step.ok ? 'PASS' : 'FAIL'} ${step.name}${step.error ? ` — ${step.error}` : ''}`);
  }
  console.log(`progress events: ${events.length}`);
  console.log(`screenshots: ${result.screenshots.length} (${result.artifactsDir})`);

  const missingFrames = result.screenshots.filter(
    (shot) => !fs.existsSync(shot.before) || !fs.existsSync(shot.after),
  );
  if (missingFrames.length > 0) {
    console.error(`missing frames: ${missingFrames.length}`);
    process.exit(1);
  }
  process.exit(result.ok ? 0 : 1);
})().catch((err) => {
  console.error('smoke failed:', err);
  process.exit(1);
});
