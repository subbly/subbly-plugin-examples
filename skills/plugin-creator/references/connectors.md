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

**OAuth**: no header. Declare the server in `plugin.json` under `extensions["co.subbly.builder"].connectors`, keyed by the same server name, with `"auth": "oauth"`. The user signs in through the vendor after install.

```json
"connectors": { "stripe": { "auth": "oauth" } }
```

## Tools

By default the agent sees every tool the server serves. To narrow it, add `tools` to the same `connectors.<server>` object: an array of exact tool names, at least one, no duplicates. The agent then sees and can call only those. Everything else is hidden from the system prompt, `tool_search` and `tool_describe`, and a connector script calling a hidden tool gets the unknown-tool error.

```json
"connectors": {
  "stripe": { "auth": "oauth", "tools": ["list_customers", "create_payment_link"] }
}
```

- Exact names only. No globs, no denylist: either would silently widen when the vendor adds a tool.
- List only what the plugin's skills need. A shorter list means a shorter prompt and fewer wrong picks.
- `auth` is optional once `tools` is present, so an API-key server can carry a list too. A `connectors.<server>` object with neither field fails the release.
- The release check reads only the shape. It never contacts the server, so a name the server does not serve passes the release and is dropped at runtime with a logged warning. Check the names against the vendor's tool list.

A name under `connectors` that `mcp.json` does not define fails the release.

## Renames

Never rename a released connector. The builder removes the old connector and its stored OAuth credentials, and every user must connect again. The prefix rule and the other silent traps: `references/names-and-collisions.md`.
