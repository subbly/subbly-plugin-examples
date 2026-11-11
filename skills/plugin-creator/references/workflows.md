# Workflows

A workflow is a graph the builder runs with no user present: one trigger, then nodes joined by edges. A plugin ships each workflow as a folder. The agent in the builder writes the same folder format for a merchant, so a workflow you built and tested there can move into a plugin as it is.

## The folder

`co.subbly.builder/workflows/<slug>/`, one folder per workflow.

```
workflows/<slug>/
   workflow.json           the graph
   nodes/<id>.js           one file per code node
   fixtures/<name>.json    optional, sample trigger payloads
```

- The folder is the declaration. `plugin.json` lists nothing about workflows, and a `workflows` key there fails the release.
- The folder name is the slug: 1-64 lowercase alphanumerics with single `-` separators.
- The builder stores the workflow as `<plugin-slug>__<slug>`. That full slug is at most 64 characters. A shop marketplace adds `shop-` to the plugin slug, so count it.
- A file directly inside `workflows/` fails the release. So does a `package.json` in a workflow folder: code nodes use `fetch` and the platform libraries only.

## workflow.json

```json
{
  "name": "Hourly greeting",
  "trigger": { "type": "core.schedule", "input": { "cron": "0 * * * *" } },
  "nodes": [{ "id": "greeting", "type": "code", "env": ["PLUGIN_EXAMPLE__GREETING"] }],
  "edges": [{ "from": "trigger", "to": "greeting" }]
}
```

- `name` is the display name the merchant sees.
- `trigger` is one of:
  - `core.schedule`: `input.cron` is a 5-field cron, at most every 5 minutes. `input.timezone` is optional; the default is the merchant's timezone.
  - `core.webhook`: the builder gives each project its own address. `shape` beside `input` is an optional JSON Schema of the body.
  - `core.manual`: started by the agent. `shape` is a JSON Schema of the run payload, and it is required.
- `nodes` each have an `id` and a `type`. A `core.chat.create` node starts an agent chat with no user; its `input.instruction` holds the whole prompt as text, and the run waits for the chat to end and reads its result as `results.<id>.data`. A node reads the output of each earlier node as `results.<id>`, and the trigger as `results.trigger`.
- `edges` join `trigger` and the node ids.

## Code nodes

A node of type `code` runs `nodes/<id>.js`. The file exports `run`:

```js
export const run = async (results, ctx) => {
  return { text: `${ctx.env.PLUGIN_EXAMPLE__GREETING} at ${results.trigger.scheduled_at}` }
}
```

- The node id starts with a lowercase letter and has only lowercase letters, digits and `_`.
- `hosts` lists each host name its `fetch` calls, like `api.example.com`.
- `env` lists each variable `ctx.env` holds.

## Keys

A plugin workflow uses only what the plugin itself ships.

- `env` holds only the plugin's own config fields, by their variable name `PLUGIN_<SLUG>__<KEY>` (see `references/config-fields.md`). A key with no field in `plugin.json` fails the release.
- A node's `credential` names only a connector of the plugin's own `mcp.json`, as `<plugin-slug>__<server>`.
- A `credentials` block in `workflow.json` fails the release. It declares a key the merchant brings, and a plugin workflow has none.
- In a shop marketplace the plugin slug is `shop-<slug>`, so the variable is `PLUGIN_SHOP_<SLUG>__<KEY>`. The linter accepts both forms. The builder accepts only the form of the marketplace that releases it.

## Fixtures

`fixtures/<name>.json` is an object `{ "trigger": <payload>, "pins": {} }`. The trigger payload must match the trigger's shape. `pins` maps a node id to a fixed output for test runs.

## Format references

Read the one your task needs. They are the builder's own workflow references, without the builder's tools.

| Topic | Reference |
| --- | --- |
| `workflow.json`, edges, `onFailure`, package pins | [workflow/workflow-json.md](workflow/workflow-json.md) |
| Triggers and webhook verification | [workflow/triggers.md](workflow/triggers.md) |
| Core nodes: switch, merge, loop, wait, HTTP, MCP, chat | [workflow/core-nodes.md](workflow/core-nodes.md) |
| A chat node's instruction and reply | [workflow/chat-nodes.md](workflow/chat-nodes.md) |
| Code nodes | [workflow/code-nodes.md](workflow/code-nodes.md) |
| CEL expressions | [workflow/cel.md](workflow/cel.md) |
| Reading every page of a list | [workflow/pages.md](workflow/pages.md) |
| Sending email | [workflow/emails.md](workflow/emails.md) |
| State between runs | [workflow/memory.md](workflow/memory.md) |

A package node or trigger, such as `subbly.order.get`, takes the input its package declares, and this skill does not list them. For a workflow that uses one, ask the agent in the builder to build and test it in a test project, then copy its folder here and apply the Keys rules.

## What the release checks

The builder runs the same check on each workflow as when its own agent saves one, then the plugin rules above. One error in one workflow fails the release of every plugin in the marketplace. The message names the file, line and column.

The linter checks the folder layout, the code node files and the keys. It does not run the full check, so a clean lint is not yet a release. To be sure, upload the plugin to a test shop.

## What a project gets

- At install, each project gets each workflow, switched off. The merchant turns it on in the install dialog or on the Workflows page.
- The agent can read and run a plugin workflow. It cannot edit one.
- A new release moves each project to the new version of each workflow. An unchanged workflow is not touched. A changed one keeps its switch, its runs and its webhook address. A new one arrives switched off.
- When a release drops a workflow, the project keeps the row and its runs, but nothing can start it.
- When the merchant removes the plugin, its workflows and their runs go with it.
