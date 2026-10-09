import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = ['g05-reload-smoke', 'g05-review-browser', 'ui-contracts-browser', 'b04-traceability-browser', 'b06-floor-study-browser', 'b06-coordination-browser', 'b06-frame-browser'];
const selection = process.argv.find(arg => arg.startsWith('--suite='))?.slice('--suite='.length);
if (selection && !suites.includes(selection)) throw new Error('Unknown G05 browser suite');
const port = Number(process.env.ARKEMX_E2E_PORT ?? 5187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid G05 test port');
const baseUrl = `http://127.0.0.1:${port}`;
const output = path.resolve(root, process.env.ARKEMX_G05_EVIDENCE_DIR ?? 'test-artifacts/g05');
fs.mkdirSync(output, { recursive: true });
const log = fs.createWriteStream(path.join(output, 'server.log'));
const env = { ...process.env, ARKEMX_E2E_BASE_URL: baseUrl, ARKEMX_G05_EVIDENCE_DIR: output,
  ARKEMX_PROTOTYPE_DEMO_AUTH: '1', ARKEMX_LOCAL_DEMO: '1', ARKEMX_REMOTE_D1_DATABASE_ID: '',
  ARKEMX_LOCAL_LAND_BROWSER: '0', WRANGLER_WRITE_LOGS: 'false' };
// Own a strict localhost server: never reuse or stop another running demo.
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'vite.local.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
let startupOutput = '';
server.stdout.on('data', chunk => { startupOutput = (startupOutput + chunk.toString()).slice(-8192); });
let serverError;
server.on('error', error => { serverError = error; });
function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', file], { cwd: root, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${file}: exit ${code}, signal ${signal}`)));
  });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error(`G05 server exited (${server.exitCode}); see ${output}/server.log`);
    if (!stripVTControlCharacters(startupOutput).includes(baseUrl)) { await delay(500); continue; }
    try {
      const response = await fetch(`${baseUrl}/tasiyici-on-tasarim`, { signal: AbortSignal.timeout(2000) });
      await response.body?.cancel();
      if (response.ok) { ready = true; break; }
    } catch { /* Wait for the owned server to compile its first route. */ }
    await delay(500);
  }
  if (!ready) throw new Error(`G05 server readiness timeout; see ${output}/server.log`);
  for (const suite of suites.filter(suite => !selection || suite === selection)) await run(`tests/${suite}.mjs`);
} catch (error) {
  console.error(fs.readFileSync(path.join(output, 'server.log'), 'utf8').slice(-12000));
  throw error;
} finally {
  if (server.exitCode === null) {
    const stopped = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([stopped, delay(5000)]);
    if (server.exitCode === null) { server.kill('SIGKILL'); await stopped; }
  }
  log.end();
}
