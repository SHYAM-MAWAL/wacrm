import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTextMessage, uploadResumableMedia } from './meta-api';

const KAPSO_BASE = 'https://api.kapso.ai/meta/whatsapp/v24.0';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('sendTextMessage transport', () => {
  it('posts to Kapso with X-API-Key and the same message body', async () => {
    vi.stubEnv('META_API_BASE', `${KAPSO_BASE}/`);
    vi.stubEnv('KAPSO_API_KEY', 'kapso-secret');

    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(
          JSON.stringify({ messages: [{ id: 'wamid.KAPSO' }] }),
          {
            status: 200,
          }
        );
      })
    );

    const result = await sendTextMessage({
      phoneNumberId: '1263059290228778',
      accessToken: 'stored-system-user-token',
      to: '15551234567',
      text: 'Hello from Kapso',
    });

    expect(result).toEqual({ messageId: 'wamid.KAPSO' });
    expect(capturedUrl).toBe(`${KAPSO_BASE}/1263059290228778/messages`);
    expect(capturedInit?.method).toBe('POST');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('kapso-secret');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '15551234567',
      type: 'text',
      text: { body: 'Hello from Kapso' },
    });
  });
});

describe('Kapso error envelope', () => {
  it('surfaces the Kapso string error and next_steps instead of a bare status', async () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    vi.stubEnv('KAPSO_API_KEY', 'kapso-secret');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: 'Cannot send non-template messages outside the 24-hour window.',
            next_steps: 'Send a WhatsApp template message to reopen the session.',
          }),
          { status: 422 }
        )
      )
    );

    await expect(
      sendTextMessage({
        phoneNumberId: '1263059290228778',
        accessToken: 'stored',
        to: '15551234567',
        text: 'hi',
      })
    ).rejects.toMatchObject({
      message:
        'Cannot send non-template messages outside the 24-hour window. Send a WhatsApp template message to reopen the session.',
      httpStatus: 422,
    });
  });
});

describe('uploadResumableMedia transport', () => {
  it('does not put the Kapso key in the upload URL', async () => {
    vi.stubEnv('META_API_BASE', KAPSO_BASE);
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes('/uploads?')) {
          return new Response(JSON.stringify({ id: 'upload:SESSION' }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ h: '2:HANDLE' }), { status: 200 });
      })
    );

    const { handle } = await uploadResumableMedia({
      appId: 'app-1',
      accessToken: 'kapso-secret',
      fileName: 'header.jpg',
      mimeType: 'image/jpeg',
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    expect(handle).toBe('2:HANDLE');
    expect(calls[0].url.startsWith(`${KAPSO_BASE}/app-1/uploads?`)).toBe(true);
    expect(calls[0].url).not.toContain('access_token');
    expect(calls[0].url).not.toContain('kapso-secret');
    const startHeaders = calls[0].init?.headers as Record<string, string>;
    expect(startHeaders['X-API-Key']).toBe('kapso-secret');
    expect(startHeaders.Authorization).toBeUndefined();

    expect(calls[1].url).toBe(`${KAPSO_BASE}/upload:SESSION`);
    const uploadHeaders = calls[1].init?.headers as Record<string, string>;
    expect(uploadHeaders['X-API-Key']).toBe('kapso-secret');
    expect(uploadHeaders.Authorization).toBeUndefined();
    expect(uploadHeaders.file_offset).toBe('0');
  });
});
