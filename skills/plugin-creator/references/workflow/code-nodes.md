# Code nodes

Write a code node to shape data, to branch on several fields at once, to call a vendor that has no package, or to keep state in `ctx.store`. For everything else, use a package or core node: it is typed, retried, and shows one line per call in the run history.

A code node is `{ "id": "<id>", "type": "code", "file": "nodes/<id>.js", "hosts": ["api.example.com"], "env": ["API_KEY"] }`. Its file is plain JavaScript and exports one function, `export const run = async (results, ctx) => {...}`. `results` holds the output of each node before it, by node id.

- `ctx.env` holds the variables the node lists in `env`. In a plugin, each is a config field of the plugin: [Keys in workflows.md](../workflows.md#keys). In a loop body, `ctx.iter` holds `value`, `index`, and `parent`.
- Return plain JSON. The release check does not know its shape, so a wrong path into it fails the run that reads it, not the release.
- Only a thrown `RetryableError` and a timeout retry. Any other throw, a failed `fetch` included, fails the node at once, and `fetch` returns a 5xx as an ordinary response. So check `response.status`: throw `RetryableError` on 408, 429, and 5xx, and `TerminalError` on any other failure, each naming the id it worked on. Both classes come from `@subbly/workflows`. `ctx.idempotencyKey` is stable per node call; pass it to vendors that take one.
- No npm packages. The runtime is a worker, not Node: `fetch`, `console`, `URL`, `crypto`, and `setTimeout`, plus `node:buffer`, `node:crypto`, `node:util`, `node:events`, and `node:url`. No `require`, `process`, `eval`, or dynamic import. Module state can outlive a call and other calls share it, so keep nothing at module scope.
- List every host the node calls in `hosts`, as a host name with no scheme or path, such as `api.twilio.com`. A call to a host that no node of the workflow lists fails with `host_not_allowed`. A credential the node names goes only to the node's own hosts.
- `console.log` is kept, 64 KB per node run. Log ids and statuses.
- A node gets 10 s of CPU and `timeout` (default 30 s) of wall time.
- Call a package through a package node, one call per element with `core.loop` ([core-nodes.md](core-nodes.md)). Keys and credentials: [Keys in workflows.md](../workflows.md#keys). `ctx.store`: [memory.md](memory.md).
