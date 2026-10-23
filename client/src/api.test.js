import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { api, errMsg } from './api.js';
import { setReporter } from './monitoring.js';

describe('errMsg', () => {
  test('prefers the message sent by the server', () => {
    expect(errMsg({ response: { data: { message: 'Invalid email or password' } }, message: 'Request failed with status code 401' })).toBe('Invalid email or password');
  });

  test('explains network failures in plain language', () => {
    expect(errMsg({ request: {}, message: 'Network Error' })).toMatch(/Cannot reach the server/);
  });

  test('falls back to the error message, then a generic one', () => {
    expect(errMsg(new Error('boom'))).toBe('boom');
    expect(errMsg({})).toBe('Something went wrong');
    expect(errMsg(undefined)).toBe('Something went wrong');
  });
});

describe('api client', () => {
  let reported;
  beforeEach(() => {
    reported = [];
    setReporter((err, ctx) => reported.push(ctx));
    localStorage.clear();
  });
  afterEach(() => setReporter(null));

  const respondWith = (status) => ({
    adapter: (config) =>
      status < 400
        ? Promise.resolve({ status, data: {}, config, headers: {}, statusText: 'ok' })
        : Promise.reject(Object.assign(new Error(`status ${status}`), { config, response: { status, data: {} } })),
  });

  test('sends the saved token as a Bearer header', async () => {
    localStorage.setItem('token', 'abc.def');
    let sent;
    await api.get('/x', { adapter: (config) => ((sent = config.headers.Authorization), Promise.resolve({ status: 200, data: {}, config, headers: {} })) });
    expect(sent).toBe('Bearer abc.def');
  });

  test('sends no Authorization header when logged out', async () => {
    let sent = 'unset';
    await api.get('/x', { adapter: (config) => ((sent = config.headers.Authorization), Promise.resolve({ status: 200, data: {}, config, headers: {} })) });
    expect(sent).toBeUndefined();
  });

  test('reports server errors (5xx) to monitoring', async () => {
    await expect(api.get('/boom', respondWith(500))).rejects.toThrow();
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({ url: '/boom', status: 500 });
  });

  test('reports an unreachable server', async () => {
    await expect(
      api.get('/down', { adapter: (config) => Promise.reject(Object.assign(new Error('Network Error'), { config, request: {} })) })
    ).rejects.toThrow('Network Error');
    expect(reported).toHaveLength(1);
  });

  test('does not report normal client errors (4xx)', async () => {
    await expect(api.get('/nope', respondWith(404))).rejects.toThrow();
    await expect(api.get('/forbidden', respondWith(403))).rejects.toThrow();
    expect(reported).toHaveLength(0);
  });
});
