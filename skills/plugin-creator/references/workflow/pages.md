# Pages

`pages` makes one node read every page of a vendor list. `results.<id>` is then one array: the items of every page, joined in order. Paging and looping are separate jobs. Page the list with `pages`, then loop over `results.<id>` for the side effects. Never loop over page numbers.

A page is `{ input, output, index }`: the input of that call, its output, and its position from 0. `items` returns the records of one page. `next` returns a patch for the next call, or `null` to stop. The engine merges the patch over the input of that page, one top-level field at a time, so a `next` that changes one query parameter writes the whole `query`. One `next` covers page numbers, offsets, cursors, and next-page links.

- **Package paging.** When a package marks a node `paged`, it declares its paging. Write `pages: true`, or `pages: { max }`. The package also declares `Item`, one record of the array. Every `subbly.*` list that takes `page` pages by `pagination.currentPage` and `pagination.lastPage`, and its items are `data`.
- **Your own paging.** On `core.http.request` or `core.mcp`, write `pages: { items, next }`. On a package node, your `items` and `next` replace the package ones. The release check checks both against the node's input and output: `next` returns input fields or `null`, and `items` returns a list.
- **Where it goes.** Only a package node, `core.http.request`, and `core.mcp` take `pages`. The release check refuses it on a code node, a trigger, a control node, and `core.chat.create`. `pages: true` on a node whose package declares no paging fails the release check; write `items` and `next`.
- **Durable pages.** Each page is its own node run, `<id>[0]`, `<id>[1]`, and so on, with the node's retries and timeout. A failed page retries alone. A continued run starts at the first page without an `ok` node run. The nodes after the paged node start only when the last page is in. Each `ok` page counts as one action; the joined node run counts none.
- **Stable pages.** Vendor data can move between a failure and a continued run. Only a cursor or a closed window (such as `createdAt.lte`) keeps the pages stable. Page numbers over an open window can skip or repeat a record.

`max` is a whole number from 1; the default is 100. `max` is a safety cap, not a stop: when page `max` is in and `next` still asks for more, the node fails. To read only part of a list, stop in `next` (see Stop early). The engine never drops records without a failure:

| Code | Cause |
| --- | --- |
| `page_limit` | Page `max` is in and `next` still returns a patch. Raise `max` or narrow the input. After a new release, a continued run fetches only the pages after the last `ok` one. |
| `page_stuck` | `next` gave the same input as the page it came from. The engine stops before it repeats the call. |
| `output_cap` | The joined items passed 6 MB. The engine fetches no page after that. |
| `expression` | `items` or `next` threw, timed out, or returned the wrong kind of value. The message names `pages.items` or `pages.next` and the page index. |

### Stop early

When one page is enough, such as the newest 20 orders, leave `pages` out and set `perPage`. `results.<id>` is then the page itself, and its records are in `data`. Prefer a filter in the input to a rule in `next` when the vendor supports it. A closed `createdAt` window reads fewer pages, and it keeps the pages stable across a continued run.

To stop, return `null` from `next`. Return `null`, not `false`: any value other than a patch or `null` fails the node with `expression`. `pages: true` always reads to the last page. To stop earlier on a package node, write `items` and `next` yourself. For a `subbly.*` list, the package `next` is one line, so copy it and add your rule in front. `next` reads only `page`, in one expression.

The first 2 pages: `page.index < 1 && page.output.pagination.currentPage < page.output.pagination.lastPage ? {'page': page.output.pagination.currentPage + 1} : null`.

The same pattern covers the other rules:

- **A record count.** Stop in `next` when `(page.index + 1) * perPage` reaches the count, and cut the joined array in the next node. Write the numbers in.
- **A date, on a newest-first list.** Filter the records in `items`, and stop in `next` when the last record of the page is older than the date.
- **No last page.** Stop when a page has fewer records than `perPage`, and ask for `(has(page.input.page) ? page.input.page : 1) + 1`.
- **A cursor.** Keep the cursor patch, and put the rule in front of it.
