# subbly-plugin-examples

Example Subbly marketplace plugins. Each lives in `plugins/<slug>/` and is listed in `marketplace.json`.

Before you touch anything under `plugins/` or `marketplace.json`, install the `plugin-creator` skill, then invoke it:

```bash
npx skills add subbly/subbly-plugin-examples --skill plugin-creator
```

It owns every manifest key, content type, naming rule and release step. Run `pnpm lint` before each commit; zero errors is the gate.
