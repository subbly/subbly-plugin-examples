# Publishing changes to npm registry

This document provides instructions how to publish packages in [subbly-plugin-examples](https://github.com/subbly/subbly-plugin-examples)
monorepo to npm registry.

Publishable packages:
- `@subbly/plugin-lint` in `packages/plugin-lint`

Everything else in this repository is not an npm package. The plugins in `plugins/` release
through the Subbly builder, by a `version` bump in `marketplace.json`. They never need a changeset.

Brief overview of the publish flow:

1. Make changes to any package in the `packages` directory.
2. Run `pnpm changelog` in the project root that will prompt commands in the terminal.
   1. Select the packages you changed. Only the packages in `packages` are offered.
   2. Select which version to increment (hit enter twice without selection to skip to `patch`).
   3. Summarize the changes for all commits with a description.
3. Commit changes without auto-generated `.md` files.
4. Run `pnpm release` in the project root to auto-increment the version and update `CHANGELOG.md` for each package.
5. Run `pnpm test` and `pnpm lint` in the project root. Both must pass: the linter is the release gate for every plugin in the marketplace, so a broken linter is worse than no linter.
6. Commit the changes with `chore: release #.#.#` message.
7. Run `pnpm publish` in each package directory under `packages`. Make sure to use `pnpm` instead of `npm` for correct workspace package link resolution.

There is no build step. The package ships the `.mjs` sources it runs, so what you test is what publishes.

## Changelog

The project is using [changesets](https://github.com/changesets/changesets) to auto-generate consistent CHANGELOG.md for each package.

Write the summary for the person installing the package, not for the person who wrote the code:
what changed for them, in one dense paragraph. Match the entries already in
`packages/plugin-lint/CHANGELOG.md`.

## Workspace package linking

The project is using `pnpm` workspaces to link packages inside the monorepo using `workspaces:*` linking.  
When publishing a package to npm registry, it is mandatory to run `pnpm publish` as it will replace local dependencies in the `package.json` with up-to-date version.  
On the other hand, `npm publish` will publish the package.json as is, resulting in the broken package dependencies.
