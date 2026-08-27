---
name: install
description: Finish setting up the Sentry plugin after install. Use in the setup chat, or whenever the Sentry SDK wiring this plugin expects is missing from the project.
---

# Sentry setup

Goal: the site reports client and server errors to Sentry with readable stack traces, and preview noise stays separate from production events. Rely on your general knowledge of `@sentry/nextjs` and the Next.js App Router; this skill records the project conventions.

## 1. Connect

The Sentry connector tools must be in your tool catalog. If they are, proceed. If not, ask the user to open project settings > Connectors, connect Sentry there, and then continue.

## 2. Find or create the project

If `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` are already set in the env, skip to step 4.

Ask the user one question first: do they already have a Sentry project for this site?

- **Yes.** Search for it with the connector tools (`find_organizations`, `find_projects`). One match: confirm it. Several: ask which one. Then read its DSN as described below.
- **No.** The connector session cannot create projects. Walk the user through it: sentry.io > Projects > Create Project, platform Next.js. When they say it exists, find it with the connector and read its DSN.

Reading the DSN: the `find_dsns` tool is not in the connector's direct catalog, so do not conclude it is unavailable. Run it through the meta-tools: `execute_sentry_tool` with `name: 'find_dsns'` and arguments `organizationSlug`, `regionUrl` (both from `find_organizations`), and `projectSlug`. Use `search_sentry_tools` first if you need its schema. Use the first client key's DSN. Only if this genuinely errors, tell the user it lives at Settings > Projects > their project > Client Keys (DSN).

Always resolve the DSN before presenting the form in step 4; never show the form with an empty DSN without having tried the lookup.

Note the org slug and project slug; step 5 writes them as literals.

## 3. Explain the auth token

Before the form, tell the user in one or two plain sentences why the auth token helps. Something like: when the site goes live, its code gets compressed and unreadable; this token lets Sentry translate error reports back into the original code, so problems point to the exact line, and the agent can read those errors and fix them much more easily. It is optional; without it errors still arrive, just harder to read and fix.

The connector cannot create tokens. The user creates one at Sentry > Settings > Developer Settings > Organization Tokens > Create New Token. The scopes are fixed and already include Source Map Upload; only a name is needed.

## 4. Collect the config

Call `request_info` with `type: 'env-vars'`, requesting the standard Sentry env var names, no plugin prefix. Request:

- `NEXT_PUBLIC_SENTRY_DSN`: the project's public client key; safe to expose in the browser. In the description, say where it lives: Sentry > Settings > Projects > their project > Client Keys (DSN). Pre-fill it as `default` when you resolved it in step 2, so the user only confirms.
- `SENTRY_AUTH_TOKEN`: the token from step 3. Mark it optional and say where to create it: Sentry > Settings > Developer Settings > Organization Tokens > Create New Token.

After the submission the values are saved and synced into the sandbox; reference them by name, no need to read .env.

## 5. Wire the SDK

Install the latest SDK with `pnpm add @sentry/nextjs@latest`. Never pin a version from memory: the project runs a current Next.js with Turbopack, and only recent SDK majors (v10+) support it. If the install reports a peer dependency conflict or the build cannot find a Sentry export used below, the installed SDK is outdated; reinstall `@latest`.

Follow the official Next.js manual-setup layout: one init per runtime, a router instrumentation hook, a server error hook, and a global error boundary.

```ts
// instrumentation-client.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
```

```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
})
```

```ts
// sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
})
```

```ts
// instrumentation.ts
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// The site deploys to Netlify serverless functions, which can freeze the
// process right after the response. Without the flush, server events are
// captured but never delivered.
export async function onRequestError(...args: Parameters<typeof Sentry.captureRequestError>) {
  Sentry.captureRequestError(...args)
  await Sentry.flush(2000)
}
```

```tsx
// app/global-error.tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>Something went wrong.</body>
    </html>
  )
}
```

## 6. Source maps

Wrap the Next.js config so every deploy uploads client and server source maps:

```ts
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig = {
  // existing config stays as is
}

export default withSentryConfig(nextConfig, {
  org: '<org-slug>',
  project: '<project-slug>',
  silent: true,
  widenClientFileUpload: true,
})
```

- No `authToken` option needed; Sentry auto-reads `SENTRY_AUTH_TOKEN` from the env.
- Release tracking is automatic: the build runs in a git worktree, so Sentry names each release after the current commit and tags every error with it. Never set `release.name` manually.
- Write the org and project slugs from step 2 as literals; they are stable.
- A missing token does not break the build; the wrapper logs a warning and skips the upload. Never hardcode the token in the project.

## 7. Verify

Trigger one test error, from a server action or a temporary route, confirm with the user that it appears in Sentry, then remove the test code.

Keep it minimal: no performance tracing, no replays, unless the user asks.

## Gotchas

- `environment: process.env.NODE_ENV` keeps preview noise out of production triage: the builder preview reports as `development`, the deployed site as `production`. Never hardcode the environment.
- Source maps only apply to production events. Development preview events always show dev-server or minified frames; that is by design, not a broken upload. Tell the user this upfront, and verify mapping only on an event from the published site.
- When the user says an event is missing or unmapped, first check which environment they are filtering in Sentry; the event is often sitting under the other one.
- Server events that never arrive from the published site usually mean the serverless function ended before delivery; the `flush` in `onRequestError` above is the fix, keep it.
- The DSN is a public identifier, safe in the browser. The auth token is a secret; it lives only in the env, never in code and never pasted into the chat.
- Never collect the DSN or token conversationally; the `request_info` form is the only path, and it saves straight into the env.
