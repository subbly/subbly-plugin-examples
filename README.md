# subbly-plugin-examples

Subbly Builder is the AI agent that works inside a Subbly shop's project. A plugin is a package a shop installs into that project to extend the agent: knowledge, tools, scheduled work, a setup chat and per-shop settings. Plugins ship through a marketplace, a git repo with a `marketplace.json` that lists them.

This repo is a working marketplace of examples. Each plugin is a complete, lint-clean [Agent Plugins v1.0.0](https://agent-plugins.org) package you can copy to start your own. The standard covers the manifest and the skills, so other agent clients can read those parts. Everything Subbly-specific sits in one namespace and other clients ignore it.

## What a plugin can contain

- **Skill**: a procedure or reference the agent loads by itself when a task matches the skill's description.
- **Agent**: a subagent that runs a self-contained job in a fresh context and returns only its result.
- **Instructions**: a few lines the agent sees on every turn of every chat.
- **Setup**: a guided chat that runs once, right after the shop installs the plugin.
- **Script**: fixed code the plugin ships, run in the project sandbox.
- **Automation**: work the builder runs on a schedule, with no user present.
- **Connector**: a remote MCP server the agent sees as tools, with an API key or OAuth.
- **Config field**: a per-shop value asked at install and handed to the project as an environment variable.

## Examples

| Plugin | Shows |
| --- | --- |
| `plugins/example-notes` | The smallest valid plugin: one skill, nothing else. |
| `plugins/example-automations` | A script with dependencies and a committed lockfile, config fields (text, secret, select), a scheduled automation with run state, always-on instructions, and a skill that calls the script. |
| `plugins/example-agent` | A subagent with a narrow tool allowlist, and a skill that tells the main agent when to spawn it. |
| `plugins/example-sentry` | Setup: `"setup": true` plus an `install` skill that walks the user through wiring the Sentry SDK in the setup chat, with an OAuth connector and a cover image. |
| `plugins/example-contentful` | A connector: a remote MCP server with OAuth, a tool allowlist, plus instructions for its tools. |

## Layout

`marketplace.json` lists every plugin by slug; each plugin lives at `plugins/<slug>/`:

- `plugin.json`: the manifest. `name` must equal the marketplace slug. Subbly's data (display name, config fields, automations, connector auth and tool allowlists) sits under `extensions["co.subbly.builder"]`.
- `skills/<name>/SKILL.md` and optional `mcp.json`: defined by the Agent Plugins standard, at the plugin root.
- `co.subbly.builder/`: builder-only content, ignored by other clients: `agents/<name>/AGENT.md`, `automations/<slug>.md`, `scripts/`, `instructions.md`.

## Start your own marketplace

1. **Fork this repo.** It is already a working marketplace: `marketplace.json`, the lint setup and the example plugins come with it. Point Subbly at your fork.
2. **Install and lint.** `pnpm install`, then `pnpm lint`. Zero errors is the release gate.
3. **Install the guide.** The `plugin-creator` skill tells your agent how to write a plugin. See below.
4. **Copy the closest example** to `plugins/<your-slug>/` and set `name` in its `plugin.json` to the same slug. Slugs are claimed once for the whole platform, so never ship `example-*`, and vendor-prefix a generic name.
5. **List it in `marketplace.json`** and drop the example entries and directories you do not need. An unlisted plugin never ships.
6. **Release.** Bump `version` in `marketplace.json` and merge to `main`. The bump is the only release trigger. That one version covers every plugin in the repo; a `version` inside `plugin.json` is ignored.

### The plugin-creator skill

The skill in `skills/plugin-creator/` is the full guide: every entity, every manifest key, the naming rules and the traps the linter cannot catch. Install it into your agent with the [skills](https://skills.sh) CLI:

```bash
npx skills add subbly/subbly-plugin-examples --skill plugin-creator
```

Add `-a claude-code -a cursor -a codex` to pick agents, or `-g` to install it globally. A plain git URL works too, so a self-hosted remote is fine.

## Update the linter

This repo only consumes `@subbly/plugin-lint`. Bump its version in `package.json` and run `pnpm install` to pick up a new release.
