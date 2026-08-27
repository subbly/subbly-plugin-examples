# subbly-plugin-examples

Example plugins for the Subbly Builder marketplace. Each one is a complete, lint-clean [Agent Plugins v1.0.0](https://agent-plugins.org) package you can copy to start your own plugin.

## Examples

| Plugin | Shows |
| --- | --- |
| `plugins/example-notes` | The smallest valid plugin: one skill, nothing else. |
| `plugins/example-automations` | A script with dependencies and a committed lockfile, config fields (text, secret, select), a scheduled automation with run state, always-on instructions, and a skill that calls the script. |
| `plugins/example-agent` | A subagent with a narrow tool allowlist, and a skill that tells the main agent when to spawn it. |
| `plugins/example-sentry` | Setup: `"setup": true` plus an `install` skill that walks the user through wiring the Sentry SDK in the setup chat, with an OAuth connector and a cover image. |
| `plugins/example-contentful` | A connector: a remote MCP server with OAuth, plus instructions for its tools. |

## Layout

`packages/plugin-lint` holds `@subbly/plugin-lint`, the linter. `marketplace.json` lists every plugin by slug; each plugin lives at `plugins/<slug>/`:

- `plugin.json`: the manifest. `name` must equal the marketplace slug. Subbly's data (display name, config fields, automations, connector auth) sits under `extensions["co.subbly.builder"]`.
- `skills/<name>/SKILL.md` and optional `mcp.json`: spec-owned, at the plugin root.
- `co.subbly.builder/`: builder-only content, ignored by other clients: `agents/<name>/AGENT.md`, `automations/<slug>.md`, `scripts/`, `instructions.md`.

## Author a plugin

The `plugin-creator` skill in `skills/plugin-creator/` is the full guide: every entity, every manifest key, the naming rules and the traps the linter cannot catch. Open this repo in Claude Code and ask it to add a plugin; it loads the skill by itself (`.claude/skills/plugin-creator` links to it).

### Install the skill in your own repo

Bring the guide into any project with the [skills](https://skills.sh) CLI:

```bash
npx skills add subbly/subbly-plugin-examples --skill plugin-creator
```

Add `-g` to install it globally, or `-a claude-code -a cursor` to pick agents. It also installs from a plain git URL, so a self-hosted remote works too.

Every change ends with:

```bash
pnpm install
pnpm lint
```

Zero errors means the marketplace passes the builder's release gate.

The rules live in `@subbly/plugin-lint` (`packages/plugin-lint`), a standalone package you can install in your own marketplace repo. `pnpm exec subbly-plugin-lint --strict` runs the same rules without ESLint and fails on warnings too. See its [README](packages/plugin-lint/README.md).

## Release

### Plugins

Copy the plugin into your own marketplace repo, bump `version` in its `marketplace.json`, and merge to `main`. The bump is the only release trigger.

Slugs are claimed once for the whole platform, so rename `example-*` before you release, and vendor-prefix your own.

### The linter

`@subbly/plugin-lint` releases to npm through [Changesets](https://github.com/changesets/changesets), the same flow as the other Subbly monorepos. Anything you change under `packages/` needs one:

```bash
pnpm changelog   # pick the bump, write the user-facing line
pnpm release     # consume the changesets, bump, write CHANGELOG.md
```

Then `pnpm publish` from `packages/plugin-lint`. Use `pnpm`, not `npm`: it resolves the workspace links. [PUBLISH.md](PUBLISH.md) has the full flow.

Plugins in `plugins/` are not npm packages, so they never need a changeset.
