# Config Fields and Environment Variables

The skill body gives the `PLUGIN_<SLUG>__<KEY>` rule. This is all that follows it.

## The environment variable name

- **`NEXT_PUBLIC_` prefix.** A field with `public: true` gets it. It goes in front of the whole name. It does not replace `PLUGIN_`.
- **`KEY` case.** The builder copies `KEY` unchanged. A lowercase key fails at release. The builder does not upper-case it for you.
- **Reserved prefixes.** `PLUGIN_` and `NEXT_PUBLIC_PLUGIN_` are reserved. A user cannot create, rename or delete a project variable with either prefix.

## Interpolation

Only uppercase `${NAME}` expands. It expands only in `mcp.json` header values, never in the URL. The builder matches it against declared field keys. An undeclared name fails the release.

```json
{ "headers": { "X-API-KEY": "${API_KEY}" } }
```

Handle a missing value. A user can clear a field. A saved change reaches a running sandbox only at the next sync.

## Field shape

- `type`: `text` or `select`.
- `options`: a `select` needs a non-empty `options` array. The strings are the labels the user sees.
- `required`: blocks the install dialog. It holds the installation on its current version until filled. A plugin with `default: true` cannot declare a required field. It auto-installs with no user present.
- `secret`: masks the input. The API returns a `{set: true}` sentinel instead of the value.
- `public`: exposes the variable to the browser with the `NEXT_PUBLIC_` prefix. `public` and `secret` are mutually exclusive.
- `pattern`: compiled as `^(?:<pattern>)$` with no flags. Write case-insensitivity as a character class (`[Aa]`), never `/i`. It applies to select values too.

Values are 4096 characters maximum and reject newlines. A PEM certificate cannot be a field value.

**Unknown keys inside a field object are silently stripped.** A typo like `requred`, or an invented `placeholder`, does nothing and reports nothing. The namespace object around it is strict and rejects typos.
