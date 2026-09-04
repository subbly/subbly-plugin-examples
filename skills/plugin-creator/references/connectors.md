# Connectors

A connector is a remote MCP server in `mcp.json`, at the plugin root. The agent sees its tools under the name you give the server.

## mcp.json

Follows [mcp.schema.json](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json), with `$schema` fixed to that URL. The standard allows `stdio`, `sse` and `streamable-http`. The builder ships only `streamable-http` over `https://`. A server takes `type`, `url` and optional `headers`. Nothing else.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "stripe": { "type": "streamable-http", "url": "https://mcp.stripe.com" }
  }
}
```

Name the server after the vendor, lowercase, starting with a letter. Never add the plugin slug: the builder prefixes `<slug>__` itself, and the linter warns if you do.

## Authentication

Two ways.

**API key**: put it in a header as `${KEY}`, where `KEY` is a config field the user fills at install, usually `secret: true`. `${KEY}` expands in header values only, never in the URL. `KEY` must be a declared field or a builder default, or the release fails. Field rules: `references/config-fields.md`.

```json
"headers": { "Authorization": "Bearer ${API_KEY}" }
```

**OAuth**: no header. Declare the server in `plugin.json` under `extensions["co.subbly.builder"].connectors`, keyed by the same server name. The user signs in through the vendor after install.

```json
"connectors": { "stripe": { "auth": "oauth" } }
```

A name under `connectors` that `mcp.json` does not define fails the release.

## Renames

Never rename a released connector. The builder removes the old connector and its stored OAuth credentials, and every user must connect again. The prefix rule and the other silent traps: `references/names-and-collisions.md`.
