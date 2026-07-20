import { describe, test, expect, vi, afterEach } from 'vitest';
import { api } from '../public/js/api.js';

function stubFetch(impl) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('frontend api client envelope handling', () => {
  test('unwraps data from a success envelope', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { today: '2026-07-19' }, error: null })
    }));
    await expect(api.overview()).resolves.toEqual({ today: '2026-07-19' });
  });

  test('throws the server error message on failure envelopes', async () => {
    stubFetch(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ success: false, data: null, error: 'day must be an integer 1-90' })
    }));
    await expect(api.lesson(999)).rejects.toThrow('day must be an integer 1-90');
  });

  test('throws a friendly message when the server is unreachable', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(api.overview()).rejects.toThrow(/Cannot reach the server/);
  });

  test('falls back to status code when the body is not json', async () => {
    stubFetch(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('bad json');
      }
    }));
    await expect(api.overview()).rejects.toThrow('Request failed (500)');
  });

  test('sends recordings with the blob content type', async () => {
    const calls = [];
    stubFetch(async (url, opts) => {
      calls.push({ url, opts });
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { filename: 'x' }, error: null })
      };
    });
    const blob = { type: 'audio/webm' };
    await api.uploadRecording(3, blob);
    expect(calls[0].url).toBe('/api/lessons/3/recordings');
    expect(calls[0].opts.headers['Content-Type']).toBe('audio/webm');
    expect(calls[0].opts.body).toBe(blob);
  });
});
