---
name: plugin-creator
description: Create and update Subbly marketplace plugins. Use when you create a new plugin; when you add or edit plugin.json, mcp.json or marketplace.json; when you add a skill, agent, automation, connector, script, setup step or config field; when you release a change; or when a merged change did not reach the builder.
---

# Plugin Creator

A plugin is a directory in `plugins/<slug>/`. It gives the builder skills, agents, tools, scripts, schedules and config fields. Working examples of each content type are in `plugins/` of this repo. Copy the closest one.

The builder reads all plugins in one refresh, all-or-nothing. One error in one plugin stops the release of all plugins. `pnpm lint` finds these errors offline. Run it before each commit and continue only at 0 errors. A warning means the content is dead or broken at runtime; remove the cause or write down why you keep it.

## Create a plugin

1. **Choose a slug.** Lowercase letters, digits and `-`. The platform claims a slug once, so add a vendor prefix to a generic name. The slug is the same in three places: the directory name, `name` in `plugin.json`, `slug` in `marketplace.json`.

2. **Create `plugins/<slug>/plugin.json`.** It follows the [Agent Plugins](https://agent-plugins.org) standard 1.0.0. Every Subbly-only key sits under `extensions["co.subbly.builder"]`, so a client that knows nothing about Subbly skips it.

   ```json
   {
     "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
     "name": "<slug>",
     "description": "One or two sentences. Say what the plugin does for the user.",
     "extensions": { "co.subbly.builder": { "displayName": "<Name shown in the UI>" } }
   }
   ```

   - `$schema` is that URL exactly. `name` is the slug. `description` is required, up to 500 characters.
   - `displayName` is what the UI shows, never `name`. `image` adds a cover URL. `default: true` installs into every project with no user present.
   - Leave `version` out: the builder discards it. `author` (`name`, `email`, `url`), `homepage`, `repository`, `license` and up to 20 `keywords` are accepted.
   - An unknown key at the root or inside the namespace fails the release. Each content type below adds its own keys.

3. **Add an entry to `marketplace.json`.** An unlisted plugin never ships.

   ```json
   { "slug": "<slug>", "source": { "type": "local", "path": "plugins/<slug>" } }
   ```

4. **Add content.** The paths are exact. Standard content (`plugin.json`, `mcp.json`, `skills/`) is at the plugin root. Subbly-only content is in `co.subbly.builder/`. Builder content at the plugin root does nothing. The builder ignores it and the release succeeds.

```
plugins/<slug>/
  plugin.json                    manifest
  mcp.json                       optional, remote MCP servers
  skills/<name>/SKILL.md         skills
  skills/install/SKILL.md        required when the manifest sets setup: true
  co.subbly.builder/             builder-only content
    agents/<name>/AGENT.md
    automations/<slug>.md
    scripts/
    instructions.md
```

5. **Run `pnpm lint`.** Continue at 0 errors.

6. **Release.** Bump `version` in `marketplace.json` and merge to `main`.

## Content types

Pick the type by the job.

**Skill** teaches a procedure, an API or a convention. The main agent loads it by itself when a task matches its description, so the description decides whether it ever fires. It costs nothing until then.

**Agent** runs noisy, self-contained work in a fresh context and returns only its final message. It starts knowing nothing about the shop, the stack or the conventions. Knowledge the main agent can read is a skill, not an agent.

**Instructions** hold a rule on every turn of every chat. The file goes verbatim into each prompt of each project that installs the plugin, so keep it to a few lines and move all conditional content to a skill. The release never validates it, and it costs context on each turn, forever.

**Setup** is a guided chat that runs once, right after the user installs the plugin. Use it when the install is not complete until someone edits the project or answers a question.

**Script** is fixed code the plugin ships, run in the project sandbox. Use it when fixed code beats the model: a health check, a data pull, a fixed transform.

**Automation** is work the builder runs on its own: a trigger starts it, an agent carries it out with no user present. Today the trigger is a schedule and the work is a prompt.

**Connector** brings a remote MCP server the agent sees as tools, with an API key or OAuth. Never rename a released connector: users lose their credentials.

**Config field** collects a per-shop value at install, such as a key, a URL or a toggle, and hands it to the project as an environment variable. The variable name lands in the project's git-committed `example.env`.

## References

Each reference says where its content lives, what goes in `plugin.json` for it, and the rules the release enforces.

| Type | Reference |
| --- | --- |
| Skill | [skills.md](references/skills.md) |
| Agent | [agents.md](references/agents.md) |
| Instructions | [writing-for-the-agent.md](references/writing-for-the-agent.md) |
| Setup | [setup.md](references/setup.md) |
| Script | [scripts.md](references/scripts.md) |
| Automation | [automations.md](references/automations.md) |
| Connector | [connectors.md](references/connectors.md) |
| Config field | [config-fields.md](references/config-fields.md) |
| Any rename | [names-and-collisions.md](references/names-and-collisions.md) |

## Update a plugin

Change the files, keep the layout, run `pnpm lint`, bump `version` in `marketplace.json`, merge to `main`.

- Never rename a released plugin. The builder archives the old slug and creates a new plugin. Installations freeze and lose their config and credentials. Change `displayName` instead.
- Before you remove a config field, check scripts and `mcp.json` for the variable.

## Release

The version bump in `marketplace.json` is the only release trigger. Content merged without a bump changes nothing. `main` is append-only. Released commits are pinned by sha forever.

## A merged change did not arrive

1. Did you bump `version` in `marketplace.json`?
2. Did the refresh fail? One bad plugin blocks all. The call that starts the refresh still reports success, so read the marketplace's recorded refresh error.
3. Is the content in `co.subbly.builder/`, not at the plugin root?
4. Does a required config field with no value hold the installation on an old version?

## What the linter cannot check

PR review is the security gate. Prompt-injection surface in instructions and skills, agent tool lists, whether a field must be `secret`, and the size of `instructions.md` have no mechanical check.
