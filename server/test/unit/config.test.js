import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configUrl = new URL('../../src/config.js', import.meta.url).href;
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Loads config.js in a fresh process with the given environment (so module state never leaks between cases). */
const loadConfig = (env) =>
  spawnSync(process.execPath, ['--input-type=module', '-e', `import { config } from '${configUrl}'; console.log(JSON.stringify(config));`], {
    cwd: serverDir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
  });

describe('config', () => {
  test('production refuses to start without JWT_SECRET', () => {
    const r = loadConfig({ NODE_ENV: 'production' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /JWT_SECRET must be set in production/);
  });

  test('production starts when JWT_SECRET is set', () => {
    const r = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'a-real-secret' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).jwtSecret, 'a-real-secret');
  });

  test('development works with defaults', () => {
    const cfg = JSON.parse(loadConfig({}).stdout);
    assert.equal(cfg.port, 5000);
    assert.deepEqual(cfg.clientOrigin, ['http://localhost:5173']);
  });

  test('CLIENT_ORIGIN accepts several origins and ignores spaces and trailing slashes', () => {
    const cfg = JSON.parse(loadConfig({ CLIENT_ORIGIN: 'https://app.vercel.app/, https://preview.vercel.app ,' }).stdout);
    assert.deepEqual(cfg.clientOrigin, ['https://app.vercel.app', 'https://preview.vercel.app']);
  });
});
