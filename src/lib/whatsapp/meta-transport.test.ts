import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_META_API_BASE,
  getMetaApiBase,
  metaAuthHeaders,
  resolveMetaAuthMode,
} from './meta-transport';

const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getMetaApiBase', () => {
  it('defaults to Graph v21.0', () => {
    expect(getMetaApiBase()).toBe(DEFAULT_META_API_BASE);
    expect(getMetaApiBase()).toBe('https://graph.facebook.com/v21.0');
  });

  it('uses META_API_BASE and strips a trailing slash', () => {
    vi.stubEnv('META_API_BASE', `${KAPSO_BASE}/`);
    expect(getMetaApiBase()).toBe(KAPSO_BASE);
  });

  it('treats a blank override as unset', () => {
    vi.stubEnv('META_API_BASE', '   ');
    expect(getMetaApiBase()).toBe(DEFAULT_META_API_BASE);
  });
});

describe('resolveMetaAuthMode', () => {
  it('stays bearer for direct Meta', () => {
    expect(resolveMetaAuthMode()).toBe('bearer');
  });

  it('selects api-key when the base host is kapso.ai', () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    expect(resolveMetaAuthMode()).toBe('api-key');
  });

  it('lets META_AUTH_MODE=bearer force Bearer even on a Kapso base', () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    vi.stubEnv('META_AUTH_MODE', 'bearer');
    expect(resolveMetaAuthMode()).toBe('bearer');
  });

  it('lets META_AUTH_MODE=api-key force X-API-Key on graph.facebook.com', () => {
    vi.stubEnv('META_AUTH_MODE', 'API-KEY');
    expect(resolveMetaAuthMode()).toBe('api-key');
  });

  it('treats an unknown mode as unset and follows the host', () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    vi.stubEnv('META_AUTH_MODE', 'token');
    expect(resolveMetaAuthMode()).toBe('api-key');
  });
});

describe('metaAuthHeaders', () => {
  it('sends Authorization Bearer and not X-API-Key by default', () => {
    expect(metaAuthHeaders('stored-token')).toEqual({
      Authorization: 'Bearer stored-token',
    });
  });

  it('ignores KAPSO_API_KEY while talking to Graph with Bearer', () => {
    vi.stubEnv('KAPSO_API_KEY', 'kapso-secret');
    expect(metaAuthHeaders('stored-token')).toEqual({
      Authorization: 'Bearer stored-token',
    });
  });

  it('sends only X-API-Key from the stored token when the base is Kapso', () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    expect(metaAuthHeaders('stored-token')).toEqual({
      'X-API-Key': 'stored-token',
    });
  });

  it('prefers KAPSO_API_KEY over the stored token in api-key mode', () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    vi.stubEnv('KAPSO_API_KEY', '  kapso-secret  ');
    expect(metaAuthHeaders('stored-token')).toEqual({
      'X-API-Key': 'kapso-secret',
    });
  });

  it('keeps the OAuth scheme for direct Meta resumable upload', () => {
    expect(metaAuthHeaders('stored-token', 'oauth')).toEqual({
      Authorization: 'OAuth stored-token',
    });
  });

  it('uses X-API-Key instead of OAuth when the base is Kapso', () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    expect(metaAuthHeaders('stored-token', 'oauth')).toEqual({
      'X-API-Key': 'stored-token',
    });
  });
});
