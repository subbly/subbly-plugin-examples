# Config Fields and Environment Variables

## Declaration in plugin.json

`extensions["co.subbly.builder"].fields` is an array. Each field needs `key`, `label` and `type`. The key is uppercase letters, digits and `_`, and never starts with `PLUGIN_`.

```json
"fields": [
  { "key": "API_KEY", "label": "API key", "type": "text", "required": true, "secret": true },
  { "key": "TONE", "label": "Tone", "type": "select", "options": ["friendly", "formal"] }
]
```

The namespace object around `fields` is strict, but a field object is loose: the builder strips an unknown or misspelled key silently, and the linter allows it. `requred` does nothing and reports nothing.

## The variable name

The project never sees a field under its own name. `SLUG` is the plugin slug in uppercase with `-` replaced by `_`. `KEY` is unchanged:

```
PLUGIN_<SLUG>__<KEY>              default
NEXT_PUBLIC_PLUGIN_<SLUG>__<KEY>  when public: true
```

Two rules point in opposite directions. A script reads the full prefixed name from `process.env`. An `mcp.json` header uses the bare `${KEY}`, because the builder resolves it. A prefixed name in a header fails the release.

Each variable name lands in the project's git-committed `example.env`. The name is public. The value is not.

- `public: true` puts `NEXT_PUBLIC_` in front of the full name. `PLUGIN_` stays.
- The builder copies `KEY` unchanged. It does not upper-case it. A lowercase key fails the release.
- `PLUGIN_` and `NEXT_PUBLIC_PLUGIN_` are reserved. A user cannot create, rename or delete a project variable with either prefix.

## Interpolation

Only uppercase `${NAME}` expands. It expands in `mcp.json` header values only, never in the URL. `NAME` must be a declared field key, or the release fails.

```json
{ "headers": { "X-API-KEY": "${API_KEY}" } }
```

A user can clear a field at any time. Handle an empty value. A saved change reaches a running sandbox at the next sync.

## Field shape

- `type`: `text` or `select`.
- `options`: `select` only, and required there. The strings are the labels the user sees.
- `required`: blocks the install dialog and holds the installation on its current version until filled. Not allowed with `default: true`, because no user is present to fill it.
- `secret`: masks the input. The API returns `{set: true}` in place of the value.
- `public`: exposes the value to the browser under `NEXT_PUBLIC_`. Never with `secret`.
- `pattern`: compiled as `^(?:<pattern>)$` with no flags. Write case-insensitivity as `[Aa]`, never `/i`. It applies to select values too.

A value is 4096 characters maximum and rejects newlines. A PEM certificate cannot be a field value.

The builder strips an unknown key inside a field object silently. `requred` or an invented `placeholder` does nothing and reports nothing. The linter allows it too. Only the namespace object around the field rejects typos.
