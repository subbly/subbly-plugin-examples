# Scripts

What ships in `co.subbly.builder/scripts/` and how the sandbox runs it.

## Requirements

- Scripts sync into the project sandbox as plain files. They run with `execute_command`. There is no build step. Ship what runs.
- Put dependencies in `scripts/package.json`. Commit `scripts/pnpm-lock.yaml`. Install runs `pnpm install --frozen-lockfile`, so **dependencies without a lockfile fail the release** (`scripts/lockfile-missing`).
- A `package.json` with no dependencies and no lockfile only warns. But the install step then runs again on each sync. Commit a lockfile, or remove the `package.json`.
- **No symlinks under the plugin** (`layout/symlink`). They pass the release gate and fail at runtime. Commit real files.
- Do not commit `node_modules`. It ships into each sandbox. Add it to gitignore.

## How to address a script

Write the relative form in all prose (skills, agents, automations, instructions):

```
scripts/<file>
```

The builder owns the location. Its environment prompt lists the scripts directory of each installed plugin, and the agent resolves `scripts/<file>` against that list. The file must exist under `co.subbly.builder/scripts/`. The linter checks both: a full sandbox path fails (`sandbox/path-absolute`), and a missing file warns (`sandbox/script-missing`).

## Config in scripts

A script reads config fields from `process.env` under the full prefixed name, `PLUGIN_<SLUG>__<KEY>`. The bare `${KEY}` form belongs to `mcp.json` only. Details: `config-fields.md`.
