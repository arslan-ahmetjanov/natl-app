'use strict';

/**
 * Smoke test for the click recorder, without the GUI.
 *
 *   node apps/desktop/scripts/smoke-natl-recorder.js
 *
 * Opens the offline fixture in a headless browser, drives it like a user would,
 * stops the recorder and checks that the produced YAML describes what happened.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { startRecording } = require('../electron/natl/recorder');

const FIXTURES = path.join(__dirname, '..', 'fixtures');

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

(async () => {
  const { server, port } = await serveFixtures();
  const url = `http://127.0.0.1:${port}/sandbox.html`;

  const recorded = [];
  const recorder = await startRecording({
    url,
    headless: true,
    onStep: (step) => recorded.push(step),
  });

  await recorder.page.fill('#email', 'demo@natl.dev');
  await recorder.page.fill('#password', 'secret');
  await recorder.page.click('#login-btn');
  await recorder.page.waitForSelector('.welcome', { state: 'visible' });

  const result = await recorder.stop({ name: 'Recorded login' });

  console.log(result.yaml);
  console.log(`steps: ${result.steps.length}, events: ${recorded.length}`);
  console.log(`warnings: ${result.warnings.length}`);

  // The loop that matters: what was recorded must run as-is.
  const os = require('node:os');
  const { runScenario } = require('../electron/natl/run');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'natl-record-'));
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  const file = path.join(root, 'tests', 'recorded.yaml');
  fs.writeFileSync(file, result.yaml);

  const run = await runScenario({ root, file, headless: true });
  server.close();

  console.log(`replay: ${run.ok ? 'passed' : 'failed'} in ${run.durationMs} ms`);
  for (const step of run.steps || []) {
    console.log(`  ${step.ok ? 'PASS' : 'FAIL'} ${step.name}${step.error ? ` — ${step.error}` : ''}`);
  }

  const hasGoto = result.steps.some((step) => step.goto === '$base_url');
  const fills = result.steps.filter((step) => 'fill' in step);
  const clicks = result.steps.filter((step) => 'click' in step);

  if (!hasGoto || fills.length !== 2 || clicks.length !== 1) {
    console.error('recorder produced an unexpected scenario');
    process.exit(1);
  }
  if (result.warnings.length !== 1) {
    console.error('password warning was not reported');
    process.exit(1);
  }
  if (!run.ok) {
    console.error('recorded scenario does not replay');
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  console.error('smoke failed:', err);
  process.exit(1);
});
