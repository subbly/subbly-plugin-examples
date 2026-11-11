# Core nodes

The engine ships these nodes. Write them from this page. Each node takes `id`, `type`, and the keys its section names; the release check refuses any other key. `core` takes no pin in `packages`. The core triggers are in [triggers.md](triggers.md), and code nodes in [code-nodes.md](code-nodes.md).

| Type | Use |
| --- | --- |
| `core.switch` | Route by the first true case |
| `core.merge` | Join paths that can both be live |
| `core.loop` | Run a subgraph once per element |
| `core.wait` | Suspend the run |
| `core.http.request` | Call an HTTP API that has no package |
| `core.mcp` | Call a tool of a connector the plugin ships |
| `core.chat.create` | Run a step that needs a language model, in the current project |
| `core.email.send` | Send one email: [emails.md](emails.md) |

## core.switch

`{ "id": "tier", "type": "core.switch", "cases": { "vip": { "expression": "'vip' in results.customer.tags" }, "other": { "expression": "true" } } }`

- `cases`: snake_case case names to boolean expressions, tried in order. The run takes the first true case.
- `default`: optional, one of the case names. The run takes it when no expression is true.
- Output: `{ "output": "<case>" }`.
- Each edge out of the switch names its case in `output`. A case with no edge ends that path, so a last case `true` with no edge is a filter. The release check warns about the edgeless case; for a filter, that warning is expected.
- A run that matches no case, with no `default`, fails with `no_case`.

## core.merge

`{ "id": "joined", "type": "core.merge" }`

- Two edges that can both be live must meet in a merge. Into any other node, the release check refuses them.
- It waits for every live incoming path. Output: the id of each incoming node that ran, to its output. A dead path leaves its key out, so read a key with `has()`.

## core.loop

`{ "id": "each", "type": "core.loop", "input": { "items": { "expression": "results.audience" } }, "body": { "nodes": [], "edges": [] } }`

- `input.items`: the list.
- `body`: the nodes and edges that run once per element. Its edges join body nodes only. A body expression reads the element as `iter.value` and its position as `iter.index`; a body code node reads `ctx.iter.value`.
- The body ends in exactly one node, the one with no edge out. The loop's output is that node's output for each element, in order.
- `concurrency`: 1 to 10 elements at once, 1 by default.
- `onIterationFailure`: `fail_run` (default) stops the run at the first failed element. `skip` runs the rest and outputs `{ values, failures }`, each failure `{ index, item, code, message }`.
- Retries and timeouts belong to the body nodes, not the loop.
- In a loop body, `ctx.iter.value` is one element of `items`, as the code node gets it at run time.
- A plain `for` in a code node is right for pure data shaping. Use the loop when each element has a side effect, a retry, or a line worth keeping in the history.

## core.wait

`{ "id": "later", "type": "core.wait", "input": { "for": "3d" } }`

- `input.for`: a duration, a whole number and `s`, `m`, `h`, or `d`, such as `45s` or `3d`.
- `input.until`: a timestamp with an offset, such as `2026-10-01T09:00:00Z`.
- Write exactly one of the two. A wait is at most 30 days. Output: `{ "resumed_at": "<timestamp>" }`.
- On a schedule, the ticks during a wait are skipped. The release check warns when `for` is longer than the schedule interval.

## core.http.request

`{ "id": "note", "type": "core.http.request", "input": { "method": "POST", "url": "https://api.example.com/v1/notes", "body": { "text": { "expression": "results.order.note" } } } }`

- `input.method`: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`.
- `input.url`: an absolute URL. The release check allows the host of a literal `url` only, and a call to a host no node allows fails with `host_not_allowed`. So write `url` as a literal, and put the parts that change in `query` or `body`. For a path that changes, call from a code node ([code-nodes.md](code-nodes.md)).
- `input.headers`, `input.query`: string-to-string maps.
- `input.body`: any JSON. An object or a list goes as JSON, with `content-type: application/json` unless you set one; a string goes as it is.
- `input.responseType`: `json` (default) or `text`.
- `credential`: a credential of the plugin's own connectors, sent with the call: [Keys in workflows.md](../workflows.md#keys). A call with a credential needs `https`.
- `retries`: attempts after the first, 0 to 20, 2 by default. `timeout`: milliseconds per attempt, from 1000, 30000 by default.
- `shape`: a JSON Schema of the response body. Without it, `body` is `unknown`, and the release check cannot check a path into it.
- `pages`: read every page of a list: [pages.md](pages.md).
- Output: `{ status, headers, body }`. `headers` keeps only `content-type`, `content-length`, `etag`, `last-modified`, `cache-control`, `location`, `retry-after`, and `x-request-id`.
- A network error, a timeout, 408, 429, and 5xx retry. Any other status outside 2xx fails with `http_status` and a sample of the body. A redirect fails with `redirect`; the gateway does not follow it. A body that is not JSON fails with `invalid_json`, unless `responseType` is `text`. A body over 6 MB fails with `output_cap`.
- Each call except `GET` sends the header `idempotency-key: <run id>:<node>`, unless you set one. A vendor that honours it applies a retried write once.

## core.mcp

`{ "id": "rows", "type": "core.mcp", "input": { "connector": "<connector name>", "tool": "<tool name>", "input": {} }, "shape": { "type": "object" } }`

- Use it for a connector of the plugin's own `mcp.json`. Read the shop's own data with `subbly.*` nodes.
- `input.connector`: the connector's name in the project. `input.tool`: one of its tools. `input.input`: the tool's arguments.
- `shape` (required): a JSON Schema of the tool output. The engine checks each output against it, and a mismatch fails with `schema_mismatch`.
- Output: the tool's structured content. A tool that answers in text only gives `{ "text": "<the text>" }`; when that text is JSON, parse it in a code node.
- `retries`, `timeout`, and `pages` work as on `core.http.request`.
- Failures: `needs_configuration` (the connector is missing or needs a reconnect), `unknown_tool`, `invalid_params` (the tool refused the input), and `tool_error`.

## core.chat.create

`{ "id": "agent", "type": "core.chat.create", "input": { "instruction": "<the work, as the agent reads it>" } }`

- Use a chat for a step that needs a language model, and nodes for a step with one right answer. A scheduled instruction for an agent is `core.schedule` plus one chat node.
- `input.instruction`: the whole instruction, as one string or one expression, in Markdown. The merchant sees it as the chat's first message.
- `input.model`: `normal` (default) or `intelligent-high`. Choose the one the work needs.
- `shape` (required): the JSON Schema of the chat's result.
- The node takes `id`, `type`, `input`, and `shape`, and no other key.
- Output: `{ "chat_id", "artifacts", "data" }`. The run pauses while the chat works. How to write the instruction and the `shape`, and how to use the output: [chat-nodes.md](chat-nodes.md).
- The chat keeps notes between runs: [memory.md](memory.md).
