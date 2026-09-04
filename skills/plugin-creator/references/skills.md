# Skills

Path: `skills/<name>/SKILL.md`, at the plugin root. The Agent Plugins standard owns this directory, so any standard client can read it. Nothing about a skill goes in `plugin.json`.

- The directory name is the skill name. Frontmatter has `name` (same as the directory) and `description`, nothing else.
- Each directory under `skills/` must have a `SKILL.md`. A loose file there warns and never loads.
- Long detail goes in `skills/<name>/references/`, addressed relative to the skill directory.
- The builder runs the skill as `<slug>:<name>`. Never write the prefix yourself.

How to write the description and the body: `references/writing-for-the-agent.md`.
