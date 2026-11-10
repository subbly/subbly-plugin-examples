# Send an email

1. **Choose the kind** of each send node by the kind rule below. Done when the user agrees with each kind. For a large marketing send, also tell the user about the daily limit (Many recipients, below) and offer to split the audience across days.
2. **Get the data.** Read it from the trigger payload or a package node, such as `subbly.order.get` with `expand: ["customer"]`. For a list of recipients, shape the audience as Many recipients says. Done when every value the mail shows comes from `results`, or from `ctx.iter.value` in a loop.
3. **Build the mail in a code node.** CEL has no HTML escape, so the code node writes the HTML. It returns `subject` and `html`. When the address can be missing, it also returns `to`, and it throws `TerminalError` with the order or customer id when there is no address. Done when the HTML meets every rule in The HTML below.
4. **Add `core.email.send`** by The node below. Its fields read the code node's output, or `iter.value` in a loop. Done when the release check passes.
5. **Test** in a test shop, by Test runs below. Done when the mail in the owner's inbox looks right.

## The kind

Subbly's rule is stricter than CAN-SPAM. `transactional` is only for mail about an order, subscription, account, or shipment the recipient already has, with no promotion. Any promotion, offer, discount code, win-back, welcome, or newsletter is `marketing`, also when it is about an order: a thank-you with a discount code is marketing. Unsure means `marketing`.

Marketing mail gets the consent and unsubscribe checks, an unsubscribe link, and one-click unsubscribe headers:

- **Consent.** When the shop requires consent, Subbly sends only to customers who opted in. Otherwise it sends to every address that has not unsubscribed. So choose the audience by the ask alone and let Subbly apply consent; it reports each skip as `skipped_reason`.
- **Unsubscribe.** One unsubscribe stops all marketing mail from the shop; transactional mail still goes out. Subbly checks again just before it sends, so a recipient who unsubscribes while the mail waits does not get it.

## The HTML

- **Escape** every value that comes from a customer or an order: names, addresses, product descriptions, notes. Replace `&`, `<`, `>`, `"`, and `'` with entities.
- **A full document.** Subbly adds no shop layout. Write `<!doctype html>` to `</html>` with a table layout, CSS only in `style` attributes, and absolute `https` image URLs.
- **A postal address** in marketing mail. Write `{{ business_address }}` and ask the user to turn on the shop's business address display, or write the address in the HTML.
- **Size.** Gmail hides the HTML after about 102 KB, and the hidden part takes the unsubscribe link with it. Keep marketing HTML under about 80 KB, or put the placeholders near the top.

### Placeholders

Subbly fills these on every kind:

- `{{ unsubscribe_link }}`: Subbly's unsubscribe URL. Without it, Subbly adds a footer link to marketing mail. Write the anchor as `<a href="{{ unsubscribe_link }}" clicktracking="off" data-pm-no-track>Unsubscribe</a>`, so no provider rewrites the link.
- `{{ unsubscribe_token }}`: the bare token, for the merchant's own unsubscribe or preferences page, such as `https://shop.example/unsubscribe?t={{ unsubscribe_token }}`. Subbly still adds its footer link unless the HTML also has `{{ unsubscribe_link }}`.
- `{{ business_address }}`: the shop's address when the shop shows it.

### The merchant's own unsubscribe page

A page that takes `{{ unsubscribe_token }}`:

- works without a login;
- shows a confirm button on GET and writes only on POST;
- redeems the token with a POST to `/account/actions/unsubscribe/{token}` on the shop's checkout domain;
- keeps working for 30 days after each send.

## The node

One node sends one mail from the shop's sender. It takes only `id`, `type`, and `input`; its retries are fixed, 12 (2 in a test run) with a 30 s timeout.

- `input.kind`: `transactional` or `marketing`, by The kind above.
- `input.to`: one address.
- `input.subject`: one line.
- `input.html`: the whole body, at most 1,000,000 bytes.
- `input.replyTo`: optional, the address for replies.
- Output: `{ sent, message_id, skipped_reason }`.
- `sent: true` means Subbly accepted the mail, not that it was delivered. Subbly reports no bounce or delivery back.
- `skipped_reason` is `no_consent` or `unsubscribed`. It is a normal result: the node is `ok` and the run continues. Branch on it with a `core.switch` case such as `has(results.send.skipped_reason)`.

## Many recipients

Put the code node and the send node in a `core.loop` body, one mail per iteration. Shape the audience in a code node before the loop, so `ctx.iter.value` has a type: [core-nodes.md](core-nodes.md).

Builder mail shares the shop's daily email limit with the shop's own order and account mail, test sends included. A large marketing loop can hold the shop's own mail, and a held mail expires unsent after 36 hours.

## Test runs

A test run sends each send node's mail to the shop owner, once per node per run, whatever `to` says. Later loop iterations get the same `message_id` and `sent: true`, and send nothing. A test send skips the consent and unsubscribe checks, so it never returns `skipped_reason`.

The nodes after the send node still run once per element, and their writes are real. So pin the list node in the fixture to one record.
