# Changesets

Every change to a package in `packages/` needs a changeset. It is a small
markdown file saying which package changed, how big the bump is, and what to
tell users. The files pile up until release, then become the CHANGELOG.

```bash
pnpm changelog   # add a changeset
pnpm release     # consume them, bump versions, write CHANGELOG.md
```

Write the summary for the person installing the package, not for the person who
wrote the code: what changed for them, in one dense paragraph.

Plugins in `plugins/` are not npm packages. They release by a `version` bump in
`marketplace.json`, so they need no changeset.

[PUBLISH.md](../PUBLISH.md) has the full release flow. Full changesets docs are
[in their repository](https://github.com/changesets/changesets).
