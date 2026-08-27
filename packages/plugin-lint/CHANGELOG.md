# @subbly/plugin-lint

## 0.0.1

### Patch Changes

- First release. The Subbly marketplace release gate, offline. The builder reads every plugin in one refresh and the refresh is all-or-nothing, so one error in one plugin blocks the release of all of them. This package runs the same 94 checks on your machine before you commit, over `marketplace.json`, every plugin manifest, `mcp.json` servers, skill and agent frontmatter, automation declarations against their files, cron floors, script lockfiles, plugin layout and sandbox paths written in prose. Three entry points share one engine: the `subbly-plugin-lint` command, which has no runtime dependencies so a bare CI job works, with `--strict`, `--format unix|json|github`, `--root`, `--no-git` and `--rules`; an ESLint plugin at `@subbly/plugin-lint/eslint` that shows the same findings inline as you type, absence checks included; and the package itself as a library exporting `lint()`, `RULES` and `FORMATTERS`.
