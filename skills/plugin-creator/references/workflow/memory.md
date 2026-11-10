# Memory between runs

A run knows its trigger and the outputs of its own nodes. Four places outlive it:

- **The store.** `ctx.store.get | put | delete` in code nodes: string keys, JSON values, one store per workflow, shared by all its versions and runs.
- **A chat's state directory.** A `core.chat.create` chat works in `workflow-data/<slug>/`: `MAP.md` holds its status and what the next run does, and `CONTEXT.md` holds stable facts.
- **The shop.** A tag or a metadata field on the record a run touched is a marker that every run and every workflow can read.
- **The project environment.** `ctx.env` is configuration, read-only: [Keys in workflows.md](../workflows.md#keys).

Module state resets on every call and `results` end with the run. Two workflows share state through the shop.

## Store rules

The node reads a snapshot before it starts, and its writes commit with the node run; the last writer wins per key. A value is capped at 64 KB and the store at 256 KB; past that the node fails `store_limit`.

- **Keep cursors, not collections.** Store `last_synced_at` or the newest id you saw, and query the vendor from there. A list that grows every run hits the cap, and then every run fails.
- **One writer per key.** Parallel loop bodies that `get`, append, and `put` the same key lose writes. Collect in the body's output and write once in the node after the loop.
- **Read old shapes.** Every version shares the store, so a value may have the shape an older version wrote. Check the shape and treat an unknown one as missing.
- **Markers.** Put a sent-marker in the store only when the vendor has no natural key: `put('sent:<order id>', true)` after the send, and check it before.

## Workflows that trigger themselves

A workflow that writes to what triggered it can trigger itself: an order handler that updates the order, a schedule that updates the rows it lists. Read a marker before the write and stop when it is there. Write the marker in the node that does the side effect.
