# The Manifest and Layout

`plugin.json` follows the [Agent Plugins](https://agent-plugins.org) specification 1.0.0, an open standard published by OpenAI. The standard owns `plugin.json`, `mcp.json` and `skills/`. Everything Subbly adds sits in one namespace, `extensions["co.subbly.builder"]`, and in one directory, `co.subbly.builder/`. A client that knows nothing about Subbly skips both.

## plugin.json

Keys in file order. An unknown key at the root or inside the namespace fails the release.

- **`$schema`**: `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, exactly. The standard fixes it, and the builder rejects any other value.
- **`name`**: the slug. Lowercase letters, digits and single `-`. It must equal the directory name and the `marketplace.json` entry. The UI never shows it.
- **`description`**: required, 1 to 500 characters. What the plugin does for the user.
- **`version`**: leave it out. The builder accepts it, warns, and discards it. `version` in `marketplace.json` is the only release trigger.
- **`author`**: `name` (required), `email`, `url`. Nothing else. `homepage`, `repository`, `license` and up to 20 `keywords` are also accepted.
- **`extensions["co.subbly.builder"]`**: required. Its keys:
  - **`displayName`**: required, up to 100 characters. What the UI shows.
  - **`image`**: icon or cover URL shown in the marketplace.
  - **`default: true`**: installs the plugin into every project with no user present. A `required` field is then an error, because nobody is there to fill it.
  - **`setup: true`**: adds a Finish setup button after install. It opens a chat that loads `<slug>:install`, so it works only with a skill at `skills/install/SKILL.md`. Both or neither: the button leads nowhere without the skill, and the linter rejects the pair. Write that skill's body as instructions to the agent, not to the user, and limit its `description` to the setup of this plugin.
  - **`fields`**: config the user fills in at install. Each becomes an environment variable in the project. Shape and naming: `config-fields.md`.
  - **`automations`**: scheduled prompts keyed by slug. Each needs a prompt file in `co.subbly.builder/automations/`. Shape and schedule: `automations.md`.
  - **`connectors`**: only the `mcp.json` servers that need OAuth, keyed by server name, each `{ "auth": "oauth" }`. Renaming a released connector drops every user's credentials: `names-and-collisions.md`.

The namespace object is strict, but a field object is loose: the builder strips an unknown key inside a field silently, and the linter allows it. `requred` on a field does nothing and reports nothing.

## mcp.json

Follows [mcp.schema.json](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json), with `$schema` fixed to that URL. The standard allows `stdio`, `sse` and `streamable-http`. **The builder ships only `streamable-http` over `https://`.** A server takes `type`, `url` and optional `headers`. Nothing else.

Server names are lowercase, start with a letter, and never carry the plugin slug. The builder adds `<slug>__` itself.

`${KEY}` expands in header values only, never in the URL. `KEY` must be a declared config field or a builder default, or the release fails: `config-fields.md`.

## skills/

At the plugin root, as the standard says: `skills/<name>/SKILL.md`.

- The directory name is the skill name. Frontmatter has `name` (same as the directory) and `description`, nothing else.
- Each directory under `skills/` must have a `SKILL.md`. A loose file there warns and never loads.
- Long detail goes in `skills/<name>/references/`, addressed relative to the skill directory.
- `skills/install/SKILL.md` is the setup skill, required when the manifest sets `setup: true`.

## co.subbly.builder/

Builder-only content. The paths are exact. **Builder content placed at the plugin root does nothing.** The builder ignores it and the release succeeds, so the mistake is silent. The linter warns (`layout/root-content`).

- `agents/<name>/AGENT.md`: `agents.md`.
- `automations/<slug>.md`: `automations.md`.
- `scripts/`: `scripts.md`.
- `instructions.md`: one always-on file. The builder puts it verbatim into every prompt of every project that installs the plugin. Keep it to a few lines of rules that must hold on each turn; all conditional content is a skill. **The release does not validate this file**, and it costs context on each turn, forever.
