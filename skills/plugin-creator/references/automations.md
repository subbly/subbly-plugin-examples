# Automations

## Declaration in plugin.json

`extensions["co.subbly.builder"].automations` is an object keyed by slug. The slug is 1-64 lowercase alphanumerics with single `-` separators. It starts and ends with an alphanumeric.

Each declaration has exactly three keys. All are required. Unknown keys fail.

- `name`: display name, 1-100 characters.
- `schedule`: a cron expression (see below).
- `model`: `normal` or `intelligent-high`.

```json
"automations": {
  "daily-report": { "name": "Daily report", "schedule": "0 9 * * *", "model": "normal" }
}
```

## Schedule

- 5 or 6 fields (6 adds seconds). The aliases `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly` work. Names like `mon` and `jan` work.
- The 15-minute floor is checked by sample firings, not by pattern. Two firings less than 15 minutes apart fail the release. `0,10,30 * * * *` fails, although most gaps are fine.
- The linter cannot verify `L`, `W` and `#` offline. It only warns (`automation/schedule-unverified`). The builder decides at release.

## The markdown file

`co.subbly.builder/automations/<slug>.md`, one per declared slug.

- Each declared slug needs its file. Each file needs its declaration. A file without one fails the release.
- The body must not be empty. It is the whole prompt. The run has no user and no other context.
- How to write a prompt that runs unattended and ends on a named final message: `references/writing-for-the-agent.md`.
- **No frontmatter**: the builder does not parse or strip it. It lands verbatim in the agent instruction. `name`, `schedule` and `model` go in `plugin.json` only.

## Run state

Each automation has a state directory. It survives sandbox rebuilds. The builder creates it before the run and names it in the run prompt as "your state directory", with a `MAP.md` / `CONTEXT.md` layout the agent follows. Instruction text says "your state directory". It never spells a path.

## Keep a run short

The builder's run preamble makes the agent read `MAP.md` first and rewrite it at the end. Your text sits on top of that. Leave nothing to discover: name the script as `scripts/<file>`, name the state files you want, and say what to do on failure (report and stop). `plugins/example-automations` in this repo is the reference shape.
