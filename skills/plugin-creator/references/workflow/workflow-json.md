# workflow.json

## The folder

| File | Role |
| --- | --- |
| `workflow.json` | The definition: name, trigger, nodes, edges, package pins, and `onFailure`. |
| `nodes/<id>.js` | One code node each: [code-nodes.md](code-nodes.md). |
| `fixtures/<name>.json` | Test input: `{ "trigger": <payload>, "pins": { "<node id>": <fixed output> } }`. |

The release reads only these files.

## The definition

The smallest valid one:

```json
{ "name": "My workflow", "trigger": { "type": "core.manual", "shape": { "type": "object" } }, "nodes": [], "edges": [] }
```

Write a core entry as [core-nodes.md](core-nodes.md) or [triggers.md](triggers.md) gives it, and a package entry as its package declares it.

- Node ids are snake_case and unique. The trigger is node `trigger`, and its output is `results.trigger`.
- An edge is `{ "from", "to" }`, plus `"output"` naming the case it leaves a `core.switch` on. Several edges out of one node run in parallel.
- `shape` is a JSON Schema for what the engine cannot know, such as a webhook body.
- `"onFailure": "<node id>"` names a node with no edges that runs once when the run fails. It sees `results.error` (`{ reason, node_key, message }`) and `results.run_id`, and never retries.
- `packages` holds one caret range per package; `core` takes none. The release check adds a missing pin.

## Expressions

A field takes a literal or `{ "expression": "<CEL>" }`. How to write CEL: [cel.md](cel.md).
