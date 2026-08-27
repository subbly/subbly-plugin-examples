---
name: greeting
description: Compose welcome copy for the shop from the greeting configured in the example-automations plugin. Use when the user asks for a welcome message, a hero headline or an opening line.
---

# Greeting

Run the plugin's hello script, `node scripts/hello.js`, and use its output verbatim as the opening line of any welcome copy you write.

The script reads `PLUGIN_EXAMPLE_AUTOMATIONS__GREETING` and `PLUGIN_EXAMPLE_AUTOMATIONS__TONE` from the environment. If it exits with an error, tell the user the greeting field is empty and stop; do not invent a greeting.
