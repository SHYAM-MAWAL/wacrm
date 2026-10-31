/**
 * Where WhatsApp Cloud API calls go, and how they authenticate.
 *
 * Direct Meta (the default) is `https://graph.facebook.com/v21.0` with
 * `Authorization: Bearer <whatsapp_config access token>`.
 *
 * A Kapso-hosted number is registered on Kapso's Meta app, so that same
 * System User token can read the WABA on graph.facebook.com and still be
 * rejected on send (OAuthException 10 / 2593181). Kapso's Meta-compatible
 * proxy accepts the normal Cloud API body at
 * `https://api.kapso.ai/meta/whatsapp/v24.0` but requires `X-API-Key`.
 * Bearer auth against the proxy does not work.
 *
 * Both are deployment-wide and read on each request so Coolify can set
 * them without a rebuild:
 *
 *   META_API_BASE   full base, including the version segment. Unset keeps
 *                   graph.facebook.com/v21.0. No trailing slash.
 *   META_AUTH_MODE  `bearer` or `api-key`. Unset follows the base host:
 *                   `*.kapso.ai` → api-key, anything else → bearer.
 *   KAPSO_API_KEY   sent as X-API-Key when auth mode is api-key. When
 *                   unset, the per-call access token (the decrypted
 *                   whatsapp_config value) is the key. Ignored in bearer
 *                   mode, so a leftover key cannot replace a Meta token.
 */

const DEFAULT_META_API_VERSION = 'v21.0';

export const DEFAULT_META_API_BASE = `https://graph.facebook.com/${DEFAULT_META_API_VERSION}`;

export type MetaAuthMode = 'bearer' | 'api-key';

/** Graph auth scheme used by direct Meta. Resumable upload step 2 is `oauth`. */
export type MetaGraphAuthScheme = 'bearer' | 'oauth';

export function getMetaApiBase(): string {
  const raw = process.env.META_API_BASE?.trim();
  if (!raw) return DEFAULT_META_API_BASE;
  return raw.replace(/\/+$/, '');
}

export function isKapsoBase(base: string): boolean {
  try {
    const host = new URL(base).hostname.toLowerCase();
    return host === 'kapso.ai' || host.endsWith('.kapso.ai');
  } catch {
    return false;
  }
}

/**
 * Explicit META_AUTH_MODE wins. Unknown values fall through to the host
 * check so a typo against a Kapso base still sends X-API-Key.
 */
export function resolveMetaAuthMode(
  base: string = getMetaApiBase()
): MetaAuthMode {
  const explicit = process.env.META_AUTH_MODE?.trim().toLowerCase();
  if (explicit === 'bearer') return 'bearer';
  if (
    explicit === 'api-key' ||
    explicit === 'x-api-key' ||
    explicit === 'kapso'
  ) {
    return 'api-key';
  }
  return isKapsoBase(base) ? 'api-key' : 'bearer';
}

function apiKeyCredential(accessToken: string): string {
  const fromEnv = process.env.KAPSO_API_KEY?.trim();
  return fromEnv ? fromEnv : accessToken;
}

/**
 * Auth headers for one Graph call. Api-key mode sends only `X-API-Key`
 * — Kapso rejects `Authorization: Bearer` for the project key, and
 * sending both lets a proxy prefer the header that fails.
 */
export function metaAuthHeaders(
  accessToken: string,
  scheme: MetaGraphAuthScheme = 'bearer'
): Record<string, string> {
  if (resolveMetaAuthMode() === 'api-key') {
    return { 'X-API-Key': apiKeyCredential(accessToken) };
  }
  const value =
    scheme === 'oauth' ? `OAuth ${accessToken}` : `Bearer ${accessToken}`;
  return { Authorization: value };
}
