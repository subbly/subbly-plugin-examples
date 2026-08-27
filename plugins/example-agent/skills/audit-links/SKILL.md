---
name: audit-links
description: Check the site for broken internal links. Use when the user asks to find dead links, verify navigation, or audit the site before launch.
---

# Audit links

Spawn the `example-agent:link-auditor` agent and wait for its report. Do not scan the files yourself; the agent's transcript would flood this conversation.

When the report comes back:

- No broken links: tell the user in one sentence.
- Broken links: show the list as-is, then offer to fix them. Fix only after the user agrees, one link at a time, and prefer correcting the href over creating a page.
