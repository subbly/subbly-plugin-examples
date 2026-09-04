# Setup

Two parts, and both or neither:

- `"setup": true` under `extensions["co.subbly.builder"]` in `plugin.json`.
- A skill at `skills/install/SKILL.md`.

The flag adds a Finish setup button to the post-install panel. The button opens a chat that loads `<slug>:install`. Without that exact skill the button leads nowhere, and the linter rejects the pair (`setup/missing-install-skill`).

Write the skill body as instructions to the agent, not to the user: steps the agent leads the user through, ending when the plugin is usable. Limit its `description` to the setup of this plugin, so it never fires on unrelated tasks. Body rules: `references/writing-for-the-agent.md`.
