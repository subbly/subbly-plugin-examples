---
name: plugin-creator
description: Create and update Subbly marketplace plugins. Use when you create a new plugin; when you add or edit plugin.json, mcp.json or marketplace.json; when you add a skill, agent, automation, connector, script, setup step or config field; when you release a change; or when a merged change did not reach the builder.
---

# Plugin Creator

A plugin is a directory in `plugins/<slug>/`. It gives the builder skills, agents, tools, scripts, schedules and config fields.

The builder reads all plugins in one refresh. The refresh is all-or-nothing. One error in one plugin stops the release of all plugins. Run `pnpm lint` before each commit. It finds these errors offline.

## Create a plugin

**1. Choose a slug.** Lowercase letters, digits and `-`. The platform claims a slug once, so add a vendor prefix to a generic name. The slug must be the same in three places: the directory name, `name` in `plugin.json`, and `slug` in `marketplace.json`.

**2. Create `plugins/<slug>/plugin.json`.**

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "<slug>",
  "description": "One or two sentences. Say what the plugin does for the user.",
  "author": { "name": "Subbly", "url": "https://www.subbly.co" },
  "extensions": { "co.subbly.builder": { "displayName": "<Name shown in the UI>" } }
}
```

The UI shows `displayName`, not `name`. All Subbly-only keys go under `extensions["co.subbly.builder"]`. `references/manifests.md` lists each key.

**3. Add an entry to `marketplace.json`.**

```json
{ "slug": "<slug>", "source": { "type": "local", "path": "plugins/<slug>" } }
```

Each directory under `plugins/` must be listed. An unlisted plugin never ships.

**4. Add content.** Use this layout. The paths are exact.

```
plugins/<slug>/
  plugin.json                    manifest
  mcp.json                       optional, remote MCP servers over https only
  skills/<name>/SKILL.md         skills, at the plugin root
  skills/install/SKILL.md        required when the manifest sets setup: true
  co.subbly.builder/             builder-only content
    agents/<name>/AGENT.md
    automations/<slug>.md
    scripts/
    instructions.md
```

Spec-owned content (`plugin.json`, `mcp.json`, `skills/`) is at the plugin root. All Agent Plugins clients can read it. Subbly-only content is in `co.subbly.builder/`.

**Builder content at the plugin root does nothing.** The builder does not reject it. It ignores it. An `agents/` directory at the root looks correct and never loads.

**5. Run `pnpm lint`.** Continue only at 0 errors. The linter checks both manifest schemas, `mcp.json`, skill and agent frontmatter, the automation declaration and file match, cron floors, script lockfiles and sandbox paths in prose.

Warnings are not safe to ignore. The builder accepts them, but the content is wrong, dead or broken at runtime. Remove the cause, or write down why you keep it.

`pnpm lint` runs through ESLint. An editor with the ESLint extension shows the same findings inline with a rule id (set it to validate `json` and `markdown`). The rules come from the `@subbly/plugin-lint` package; its `subbly-plugin-lint` command runs them without dependencies, with `--strict`, `--format github` and `--rules`. `pnpm test` runs the linter fixtures.

**6. Release.** Bump `version` in `marketplace.json` and merge to `main`. See below.

## Content types

Choose the type by the job.

- Teach a procedure, API or convention: **Skill**
- Run noisy, self-contained work in a fresh context: **Agent**
- Hold a rule on each turn of each chat: **Instructions**
- Finish the install in a chat with the user: **Setup**
- Run fixed code in the sandbox: **Script**
- Run a prompt on a schedule with no user: **Automation**
- Call an external API as tools: **Connector**
- Collect a per-shop value at install: **Config field**

### Skill

Instructions the main agent loads by itself when a task matches the description. It stays out of context until then.

Path: `plugins/<slug>/skills/<name>/SKILL.md`. The directory name is the skill name. Frontmatter has `name` (same as the directory) and `description`, nothing else. Each directory under `skills/` must have a `SKILL.md`. Put long detail in `skills/<name>/references/` and address it relative to the skill directory.

### Agent

A subagent with its own system prompt, tool list and fresh context. The main agent starts it, waits, and gets back only the final message. Use it for work that is self-contained and noisy. Knowledge the main agent can read is a skill, not an agent.

Path: `plugins/<slug>/co.subbly.builder/agents/<name>/AGENT.md`. Same shape as a skill, plus optional `tools`. The body is required. It becomes the system message. **The agent knows nothing about the project**, not the shop, the stack or the conventions. Put all it needs in its body or in a skill it loads.

Reference: `references/agent-tools.md`

### Instructions

One always-on file. The builder puts it verbatim into each prompt of each project that installs the plugin. Use it only for rules that must hold on each turn. **Keep it to a few lines.** All conditional content goes in a skill.

Path: `plugins/<slug>/co.subbly.builder/instructions.md`. **The release does not validate this file**, and it costs context on each turn, forever.

### Setup

The last step of the install, done as a chat with the user present. Use it for work only a chat can finish: wire an SDK, verify a connection, collect choices.

Two parts must agree: `"setup": true` in `plugin.json` under `extensions["co.subbly.builder"]`, and a skill at `plugins/<slug>/skills/install/SKILL.md`. The post-install panel shows a Finish setup button. It opens a chat that loads `<slug>:install`. **The flag works only with that exact skill.** Without it the button leads nowhere. The linter rejects the pair (`setup/missing-install-skill`).

Write the body as instructions to the agent, not to the user. Limit its `description` to the setup of this plugin.

### Script

Code the plugin ships. It runs in the project sandbox with `execute_command`. Use it when fixed code is better than the model: a health check, a data pull, a fixed transform.

Path: `plugins/<slug>/co.subbly.builder/scripts/`. Declare dependencies in `scripts/package.json` and commit `pnpm-lock.yaml`, or the install step runs again on each sync. Write `scripts/<file>` in prose, for example `node scripts/hello.js`. **The builder owns the location.** It tells the agent where each plugin's scripts directory is, and the linter checks that prose uses this form.

Reference: `references/scripts.md`

### Automation

A prompt the builder runs on a schedule with no user present. Write it to be safe unattended.

Two parts must agree: a declaration in `plugin.json` under `extensions["co.subbly.builder"].automations`, and `plugins/<slug>/co.subbly.builder/automations/<slug>.md` with the prompt text and no frontmatter.

**The schedule floor is 15 minutes.** `*/5 * * * *` parses, but the release rejects it.

Reference: `references/automations.md`

### Connector

A remote MCP server the plugin brings. The agent sees it as tools.

Path: `plugins/<slug>/mcp.json`, streamable-http over https only. Add it to `plugin.json` under `connectors` only when it needs OAuth. Use the natural vendor name (`stripe`). The builder adds the plugin prefix. **Do not rename a released connector**: users lose their OAuth credentials.

Reference: `references/names-and-collisions.md`

### Config field

A value the user fills in at install. The project gets it as an environment variable. Use it for per-shop values: keys, URLs, toggles.

Path: `plugin.json`, under `extensions["co.subbly.builder"].fields`. The project never sees the field under its own name. `SLUG` is the slug in uppercase with `-` replaced by `_`. `KEY` is unchanged:

```
PLUGIN_<SLUG>__<KEY>              default
NEXT_PUBLIC_PLUGIN_<SLUG>__<KEY>  when public: true
```

Two rules point in opposite directions. A script reads the full prefixed name from `process.env`. An `mcp.json` header uses the bare key, `${API_KEY}`, because the builder resolves it. A prefixed name in a header fails the release.

**Each config variable name lands in the project's git-committed `example.env`.** The name is public. The value is not.

Reference: `references/config-fields.md`

## Update a plugin

Change the files. Keep the layout and rules above. Then run `pnpm lint`, bump `version` in `marketplace.json`, and merge to `main`.

- **Do not rename a released plugin.** The builder has no rename. It archives the old slug and creates a new plugin. Each installation stays on its last version, keeps no config values and no connector credentials, and the user must install the new plugin. See `references/names-and-collisions.md`.
- Before you remove a config field, check scripts and `mcp.json` for the variable.
- Do not rename a connector. See above.

## Release

Bump `version` in `marketplace.json` and merge to `main`.

**The version bump is the only release trigger.** Content merged without a bump changes nothing. Sandboxes already on that version never fetch again. `main` is append-only. Released commits are pinned by sha forever.

## A merged change did not arrive

1. Did you bump `version` in `marketplace.json`?
2. Did the refresh fail? One bad plugin blocks all. The call that starts the refresh still reports success, so read the marketplace's recorded refresh error.
3. Is the content in `co.subbly.builder/`, not at the plugin root?
4. Does a required config field with no value hold the installation on an old version?

## What the linter cannot check

PR review is the security gate. Prompt-injection surface in instructions and skills, agent tool lists, whether a field must be `secret`, and the size of `instructions.md` have no mechanical check.

The linter owns the mechanical rules. When the builder schemas change, update `packages/plugin-lint/src/rules.mjs` and the fixtures in `packages/plugin-lint/test/lint.test.mjs`.
