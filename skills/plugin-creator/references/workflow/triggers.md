# Triggers

`trigger` in `workflow.json` is one entry with no `id`, and its output is `results.trigger`. The three core triggers are below. A package trigger comes from a package, such as `subbly`.

## core.manual

`{ "type": "core.manual", "shape": { "type": "object", "properties": { "code": { "type": "string" } }, "required": ["code"] } }`

- `shape` (required): a JSON Schema of the payload. `results.trigger` is the payload.
- Only the agent starts one; the user has no Run button.

## core.schedule

`{ "type": "core.schedule", "input": { "cron": "0 9 * * 1", "timezone": "Europe/London" } }`

- `input.cron`: a 5-field cron, or a list of them, with ticks at least 5 minutes apart. The extensions `L`, `W`, `#`, and `?` fail the release check.
- `input.timezone`: an IANA timezone, the shop's timezone by default.
- Payload: `{ scheduled_at, fired_at, timezone, missed }`.
- The first tick is the next occurrence after publish. A tick during a live run is skipped. Missed ticks collapse into one late tick, with `missed` counting them.

## core.webhook

`{ "type": "core.webhook", "input": { "verification": { "strategy": "standard_webhooks", "key": { "credential": "orders_hook" } } }, "shape": { "type": "object" } }`

- Payload: `{ body, headers, query }`. `shape`, a JSON Schema of the request body, types `body`; without it, `body` is `unknown`.
- Each project gets its own capability URL at install, shown on the workflow page. A delivery to a disabled or unpublished workflow starts nothing and is counted as skipped.
- `input.bodyLimit`: the body cap in bytes, 1 MB by default, up to 10 MB.
- `input.verification.strategy`:
  - `url`: the capability URL is the only check.
  - `standard_webhooks`: the Standard Webhooks headers. When the user's own developer writes the sender, use this one.
  - `hmac` or `ecdsa`: a signature in the header that `header` names. Optional: `algorithm` (`sha256` by default; `hmac` also takes `sha1` and `sha512`, `ecdsa` `sha384` and `sha512`), `encoding` (`hex` or `base64`; `hex` by default for `hmac`, `base64` for `ecdsa`), `prefix` (the text before the signature, such as `sha256=`), `payload` (the signed text, `{body}` by default, with `{timestamp}` for the timestamp), and `timestamp: { header, tolerance }` (the timestamp's header, and how many seconds off it can be, 300 by default).
- `input.verification.key`, on every strategy except `url`, says where the key is, never the value. In a plugin workflow it names a field of the plugin's own connector: `{ "credential": "<plugin-slug>__<server>", "field": "WEBHOOK_SECRET" }`.

## Package triggers

A package trigger, such as `subbly.subscription.paused`, takes the input and gives the payload that the package declares. Enabling the workflow subscribes it at the app, so there is no URL to paste. A field the API returns only with `expand` arrives as `null`; fetch it with the subject's `get` node and `expand`.
