# Kapso-hosted WhatsApp numbers

Some numbers are connected through [Kapso](https://kapso.ai) (ownership
`CLIENT_OWNED`) and registered on Kapso's Meta app. A System User token
from a different Meta app can still read that WABA on
`graph.facebook.com`, and Meta then rejects **sends** with
`OAuthException` code 10, subcode 2593181.

Sending works through Kapso's Meta-compatible proxy. The body is a
normal Cloud API message. The differences are the base URL and the
header: `X-API-Key`, not `Authorization: Bearer`. Bearer auth with the
Kapso project API key against this proxy does not work, and direct
`graph.facebook.com` with the other app's System User token does not
send for this number.

```http
POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages
X-API-Key: <Kapso project API key>
Content-Type: application/json
```

Unset, wacrm keeps calling `https://graph.facebook.com/v21.0` with
`Authorization: Bearer` and the token saved under Settings → WhatsApp.
Setting `KAPSO_API_KEY` alone does not change that.

The webhook URL is unchanged. Leave the callback on
`/api/whatsapp/webhook`. Signature checks still use `META_APP_SECRET`.

## Environment variables

Set these on the running app (Coolify → the service → Environment
Variables). They are read at request time, not inlined at build time,
so a restart is enough — no image rebuild. Do not commit the API key.

`META_API_BASE` (required for Kapso). Full Graph base, version
included, no trailing slash:

```
https://api.kapso.ai/meta/whatsapp/v24.0
```

`v21.0` on the same host also works. Unset means
`https://graph.facebook.com/v21.0`.

`KAPSO_API_KEY` (recommended). Kapso project API key (Kapso →
Integrations → API keys). Sent as `X-API-Key` when auth mode is
api-key. When unset, the decrypted WhatsApp access token is the key.
Ignored while auth mode is bearer, so this variable alone does not
change a direct Meta deployment.

`META_AUTH_MODE` (omit unless you need to force a header). `bearer` or
`api-key`. Unset follows the base host: `kapso.ai` / `*.kapso.ai`
selects api-key; every other host stays bearer. `x-api-key` and
`kapso` are aliases of `api-key`.

Api-key mode sends **only** `X-API-Key`. It does not also send
`Authorization`.

Every helper in `src/lib/whatsapp/meta-api.ts` (inbox sends, templates,
broadcasts, automations, flows, reactions, typing indicators, media,
phone health, registration) and **Sync from Meta** use this base and
header. Direct Meta resumable uploads (image-header templates) keep
Meta's `Authorization: OAuth` scheme and the `access_token` query
parameter. In api-key mode those uploads send `X-API-Key` and do not
put the key in the URL.

## Coolify + whatsapp_config for +1 201-907-3029

This number is on Kapso (Kapso Meta app `1087358919742996`).

1. Set `META_API_BASE=https://api.kapso.ai/meta/whatsapp/v24.0`.
2. Set `KAPSO_API_KEY` to the Kapso project API key. Leave
   `META_AUTH_MODE` unset.
3. Restart the app.
4. In Settings → WhatsApp, save:
   - Phone Number ID: `1263059290228778`
   - WhatsApp Business Account ID: `1020814503910408`
   - Permanent access token: the Kapso project API key **if
     `KAPSO_API_KEY` is not set**. If the env key is set, Graph calls
     use that key and the saved token is not sent — the existing
     System User token can stay so the row remains valid. The token is
     encrypted with `ENCRYPTION_KEY`.

Do not put the Kapso key or the System User token in the repo or in
this file.

Save Configuration and Test API Connection call the same base. Kapso
proxies phone numbers, templates, messages, and media. A management
route Kapso does not proxy fails with Kapso's error; sends still use
this credential so inbox, broadcasts, and automations stay on the path
that can actually deliver.
