import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = resolve(project, '.sites-runtime');
for (const folder of ['tmp', 'npm-cache', 'xdg-config', 'wrangler/logs']) mkdirSync(resolve(runtime, folder), { recursive: true });
const mode = process.argv[2];
if (!['dev', 'build', 'start'].includes(mode)) throw new Error('Expected dev, build or start');
const env = { ...process.env, SITES_ENV_READY: '1', SITES_PROJECT_ROOT: project,
  XDG_CONFIG_HOME: resolve(runtime, 'xdg-config'), TMPDIR: resolve(runtime, 'tmp'),
  WRANGLER_WRITE_LOGS: 'false', WRANGLER_LOG_PATH: resolve(runtime, 'wrangler/logs'),
  MINIFLARE_REGISTRY_PATH: resolve(runtime, 'wrangler/registry') };
const cli = mode === 'dev' ? 'node_modules/vite/bin/vite.js' : 'node_modules/vinext/dist/cli.js';
const args = mode === 'dev' ? process.argv.slice(3) : [mode, ...process.argv.slice(3)];
console.log(`ARKEM ${mode}: starting Node ${process.version} (supervisor PID ${process.pid})`);
const child = spawn(process.execPath, [resolve(project, cli), ...args], { cwd: project, env, stdio: 'inherit', windowsHide: true });
child.on('spawn', () => console.log(`ARKEM ${mode}: CLI PID ${child.pid}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
const timeout = mode === 'build' ? setTimeout(() => { console.error('Site build exceeded 30 minutes'); child.kill(); }, 1_800_000) : undefined;
child.on('error', (error) => { if (timeout) clearTimeout(timeout); console.error(error); process.exitCode = 1; });
child.on('exit', async (code) => {
  if (timeout) clearTimeout(timeout);
  if (code !== 0) { process.exitCode = code || 1; return; }
  if (mode === 'build') {
    try { await import('./validate-artifact.mjs'); }
    catch (error) { console.error(error); process.exitCode = 1; }
  }
});
