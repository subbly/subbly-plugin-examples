---
name: plugin-creator
description: Create and update Subbly marketplace plugins. Use when you create a new plugin; when you add or edit plugin.json, mcp.json or marketplace.json; when you add a skill, agent, automation, connector, script, setup step or config field; when you release a change; or when a merged change did not reach the builder.
---

# Plugin Creator

A plugin is a directory in `plugins/<slug>/`. It gives the builder skills, agents, tools, scripts, schedules and config fields. Working examples of each content type are in `plugins/` of this repo. Copy the closest one.

The builder reads all plugins in one refresh, all-or-nothing. One error in one plugin stops the release of all plugins. `pnpm lint` finds these errors offline. Run it before each commit and continue only at 0 errors. A warning means the content is dead or broken at runtime; remove the cause or write down why you keep it.

## Create a plugin

**1. Choose a slug.** Lowercase letters, digits and `-`. The platform claims a slug once, so add a vendor prefix to a generic name. The slug is the same in three places: the directory name, `name` in `plugin.json`, `slug` in `marketplace.json`.

**2. Create `plugins/<slug>/plugin.json`.** It follows the Agent Plugins standard, with all Subbly-only keys under `extensions["co.subbly.builder"]`. The UI shows `displayName`, never `name`.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "<slug>",
  "description": "One or two sentences. Say what the plugin does for the user.",
  "extensions": { "co.subbly.builder": { "displayName": "<Name shown in the UI>" } }
}
```

Every key: `references/manifest.md`.

**3. Add an entry to `marketplace.json`.** An unlisted plugin never ships.

```json
{ "slug": "<slug>", "source": { "type": "local", "path": "plugins/<slug>" } }
```

**4. Add content.** The paths are exact.

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

Standard content (`plugin.json`, `mcp.json`, `skills/`) is at the plugin root. Subbly-only content is in `co.subbly.builder/`. **Builder content at the plugin root does nothing.** The builder ignores it and the release succeeds.

**5. Run `pnpm lint`.** Continue at 0 errors.

**6. Release.** Bump `version` in `marketplace.json` and merge to `main`.

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

**Skill.** Instructions the main agent loads by itself when a task matches the description. Path: `skills/<name>/SKILL.md`. Packaging: `references/manifest.md`. Write the description as the cases that must trigger it and the body as steps that end on checkable criteria: `references/writing-for-the-agent.md`.

**Agent.** A subagent with its own system prompt, tool list and fresh context. It knows nothing about the project. Path: `co.subbly.builder/agents/<name>/AGENT.md`. Packaging and tools: `references/agents.md`. Write the description to say what comes back, and the body to carry all project knowledge and name the final message: `references/writing-for-the-agent.md`.

**Instructions.** One always-on file, in every prompt of every project that installs the plugin. A few lines, every-turn rules only. Path: `co.subbly.builder/instructions.md`. Rules: `references/manifest.md`.

**Setup.** The last install step, done as a chat with the user. Two parts must agree: `setup: true` in the manifest and a skill at `skills/install/SKILL.md`. Rules: `references/manifest.md`.

**Script.** Code the plugin ships. It runs in the project sandbox. Path: `co.subbly.builder/scripts/`. Dependencies, lockfile and how prose names a script: `references/scripts.md`.

**Automation.** A prompt the builder runs on a schedule with no user present. Two parts must agree: a declaration in the manifest and `co.subbly.builder/automations/<slug>.md`. **The schedule floor is 15 minutes.** Shape and schedule: `references/automations.md`. Write the prompt to run with no user to ask, and end it by naming the final message: `references/writing-for-the-agent.md`.

**Connector.** A remote MCP server the plugin brings. The agent sees it as tools. Path: `mcp.json`, https only. OAuth servers are also declared in the manifest. **Never rename a released connector**: users lose their credentials. Rules: `references/manifest.md`.

**Config field.** A value the user fills in at install. The project gets it as an environment variable. Path: manifest, under `fields`. **The variable name lands in the project's git-committed `example.env`.** Naming and run-time rules: `references/config-fields.md`.

## Update a plugin

Change the files, keep the layout, run `pnpm lint`, bump `version` in `marketplace.json`, merge to `main`.

- **Never rename a released plugin.** The builder archives the old slug and creates a new plugin. Installations freeze and lose their config and credentials. Change `displayName` instead. See `references/names-and-collisions.md`.
- Before you remove a config field, check scripts and `mcp.json` for the variable.

## Release

**The version bump in `marketplace.json` is the only release trigger.** Content merged without a bump changes nothing. `main` is append-only. Released commits are pinned by sha forever.

## A merged change did not arrive

1. Did you bump `version` in `marketplace.json`?
2. Did the refresh fail? One bad plugin blocks all. The call that starts the refresh still reports success, so read the marketplace's recorded refresh error.
3. Is the content in `co.subbly.builder/`, not at the plugin root?
4. Does a required config field with no value hold the installation on an old version?

## What the linter cannot check

PR review is the security gate. Prompt-injection surface in instructions and skills, agent tool lists, whether a field must be `secret`, and the size of `instructions.md` have no mechanical check.
