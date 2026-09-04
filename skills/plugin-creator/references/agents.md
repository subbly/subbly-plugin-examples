# Agents

## Packaging

Path: `co.subbly.builder/agents/<name>/AGENT.md`. The directory name is the agent name. Frontmatter has `name` (same as the directory), `description`, and optional `tools`. The body is required: it becomes the system message. The main agent starts the subagent, waits, and gets back only the final message.

The agent knows nothing about the project, not the shop, the stack or the conventions. Put all it needs in its body or in a skill it loads. Knowledge the main agent can read is a skill, not an agent. How to write the description and the body, and how to prune them: `references/writing-for-the-agent.md`.

## Tools

The `tools` frontmatter key accepts only the names below. Any other name fails the whole marketplace release.

- `read_file` reads a file, an image or a PDF
- `edit_file` replaces exact strings in a file
- `write_file` writes a whole file
- `apply_patch` creates and edits files with one patch-format tool
- `execute_command` runs a shell command
- `get_stock_image` finds a stock photo
- `generate_image` generates an image asset
- `scrape_webpage` gets a public web page
- `skill` loads one of your skills
- `mcp_run_tool` calls a connector tool
- `apply_to_preview` pushes changes into the live preview
- `restart_preview` restarts the preview when it is stuck or stale

These names are grant keys, not the tools the model sees. For file editing, grant `apply_patch`, or grant the `edit_file` and `write_file` pair. `apply_patch` is the recommended form. The runtime maps each file editing grant to the editing tool of the active model. Because of this, never name a file editing tool in an agent's body. Write "edit the file" instead.

An agent cannot write into its own installed plugin directory. It can write to the turn worktree, to the plan and data directories the builder names in its prompts, and to `/tmp/`.

## How to write the `tools` key

- Omitted, or `tools:` with no value: every name below.
- `tools: '*'` or bare `tools: *`: every name below, never the builder's wider pool.
- `tools: read_file, execute_command`: comma string. Segments are trimmed.
- `tools:` then `  - read_file` lines: YAML array. Elements are not trimmed. A leading space fails.
- `tools: ''`: zero tools. The roster shows `none`.

The wildcard gives nothing more than the full list. A narrow agent must list its tools.

## Size the work

The main chat agent stops at 50 tool steps. Design an agent task to finish well under that. Each run spends the user's credits at the turn's model price.

Keep the description under 500 characters. It is the only signal the main agent has when it chooses between subagents.
