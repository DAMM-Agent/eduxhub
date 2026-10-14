import { CLIENT_VERSION_HEADER, CURRENT_VERSION } from '@lobechat/const';
import { SUPPORTED_MODEL_PROVIDERS, UnsupportedModelProviderError } from 'model-bank';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHeaderWithAuth, getProviderAuthPayload } from '../_auth';

describe('createHeaderWithAuth', () => {
  it('should include the current web client version', async () => {
    const headers = await createHeaderWithAuth();

    expect(headers).toEqual({
      [CLIENT_VERSION_HEADER]: CURRENT_VERSION,
    });
  });

  it('should preserve request headers without allowing a client version override', async () => {
    const headers = await createHeaderWithAuth({
      headers: {
        'X-Lobe-Client-Version': 'spoofed',
        'Content-Type': 'application/json',
      },
    });
    const normalizedHeaders = new Headers(headers);

    expect(normalizedHeaders.get(CLIENT_VERSION_HEADER)).toBe(CURRENT_VERSION);
    expect(normalizedHeaders.get('content-type')).toBe('application/json');
  });
});

describe('provider auth payload', () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(SUPPORTED_MODEL_PROVIDERS)('keeps %s credentials and endpoint', (provider) => {
    expect(
      getProviderAuthPayload(provider, { apiKey: 'key', baseURL: 'https://api.example.test/v1' }),
    ).toEqual({ apiKey: 'key', baseURL: 'https://api.example.test/v1' });
  });
  it.each(['google', 'azure', 'lobehub', 'volcenginecodingplan', 'custom-provider'])(
    'refuses credential payloads for %s',
    (provider) => {
      expect(() => getProviderAuthPayload(provider, { apiKey: 'old-key' })).toThrow(
        UnsupportedModelProviderError,
      );
    },
  );
  it('selects a single client key from a comma-separated list', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((array: Uint32Array) => {
        array[0] = 1;
        return array;
      }),
    });
    expect(getProviderAuthPayload('openai', { apiKey: 'first,second' }).apiKey).toBe('second');
  });
});
