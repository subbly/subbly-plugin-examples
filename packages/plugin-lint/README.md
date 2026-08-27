# @subbly/plugin-lint

The Subbly marketplace release gate, offline.

The builder reads every plugin in one refresh, and the refresh is all-or-nothing: one error in one plugin blocks the release of all of them. This package runs the same checks on your machine before you commit.

## Install

```bash
pnpm add -D @subbly/plugin-lint
```

## Command line

Run it from the marketplace root, the directory holding `marketplace.json`.

```bash
subbly-plugin-lint                 # human output
subbly-plugin-lint --strict        # warnings fail too
subbly-plugin-lint --format unix   # file:line:col, for editors
subbly-plugin-lint --format json
subbly-plugin-lint --format github # GitHub Actions annotations
subbly-plugin-lint --root ../shop  # lint another checkout
subbly-plugin-lint --no-git        # skip the version-bump check
subbly-plugin-lint --rules         # list every rule
```

Exit code is 0 when there are no errors, 1 otherwise. It has no runtime dependencies, so it works in a bare CI job.

`--root` also turns the git checks off, since comparing against `origin/main` only makes sense in the checkout you are standing in.

## ESLint

The plugin surfaces the same findings inline as you type. Set your editor's ESLint extension to validate `json` and `markdown`.

```js
// eslint.config.mjs
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import subbly from '@subbly/plugin-lint/eslint'

const gate = { 'subbly/errors': 'error', 'subbly/warnings': 'warn' }

export default [
  {
    files: ['marketplace.json', 'plugins/**/*.json'],
    language: 'json/json',
    plugins: { json, subbly },
    rules: gate,
  },
  {
    files: ['plugins/**/*.md'],
    language: 'markdown/gfm',
    languageOptions: { frontmatter: 'yaml' },
    plugins: { markdown, subbly },
    rules: gate,
  },
]
```

The gate is cross-file: whether a `plugin.json` is valid depends on `marketplace.json`, and a missing `automations/<slug>.md` is a defect in a file that does not exist. ESLint visits one existing file at a time, so the engine runs once per invocation and hands each file the findings that belong to it. Every rule reaches the editor, absence checks included.

## Library

```js
import { lint, FORMATTERS, RULES } from '@subbly/plugin-lint'

const report = lint(process.cwd(), { git: false })
console.log(FORMATTERS.stylish(report))
console.log(report.errors.length)
```

`lint(root, { git })` returns a report with `findings`, `errors` and `warnings`. Each finding carries `level`, `ruleId`, `file`, `message`, `line`, `col` and an optional `hint`. `RULES` maps every rule id to a one-line description.

## What it checks

`marketplace.json` and every plugin manifest, `mcp.json` servers, skill and agent frontmatter, automation declarations against their files, cron floors, script lockfiles, plugin layout, and sandbox paths written in prose. Run `subbly-plugin-lint --rules` for the full list.

## Two severities

**error** means the refresh throws, so no plugin in the marketplace releases.

**warn** means the builder accepts it, but it is wrong, dead, or broken at runtime.

## Tests

```bash
pnpm test
```

Each case builds a throwaway marketplace in a temp directory, lints it, and asserts on the rule id that fired. Asserting on ids rather than message text means wording can change without breaking the suite.
