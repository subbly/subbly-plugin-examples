# Chat nodes

How to write the instruction of a `core.chat.create` node and use its reply. The node's keys are in [core-nodes.md](core-nodes.md). The general rules for text an agent runs, done criteria included, are in [writing-for-the-agent.md](../writing-for-the-agent.md).

## What the chat can do

A chat node is the workflow's LLM step: one language-model call that works in the current project, the one the workflow belongs to. The chat is the same agent as a builder chat in this project, with no user present. It reads and edits every file of the project, runs commands in the project's sandbox, and checks the preview. It uses the project's connectors and skills, reads the shop's data, searches the web and reads pages, creates artifacts, and hands parts of the work to subagents. It cannot ask anyone a question. Its file changes land as a new version of the project, in that chat, like the changes of any chat.

Use it for any step a model does better than code: classify, extract, summarise, translate, write, or judge. It takes longer and costs more than a node, so keep steps with one right answer in nodes. It fits these jobs:

- **Keep the site current.** Refresh the featured products or the homepage banner from last week's sales or stock.
- **Seasonal and time-bound content.** Put up and take down a holiday notice, shipping cut-off dates, or a sale banner.
- **Audit the site.** Check for broken links, missing alt text, missing SEO tags, and pages that are slow or fail to build; write the findings as an artifact.
- **Follow a catalogue change.** On a product or plan change, update the pages and copy that mention it.
- **Keep translations in step.** After the source language changes, update the other languages.
- **Write a report.** A weekly sales, subscriptions, or churn review as an artifact, emailed to the merchant.
- **Judge one item.** Draft a reply to a review, classify a cancellation reason, or decide if a support request needs a person.
- **Watch the market.** Search competitors' prices or offers and report what changed.
- **Turn text into data.** Pull the fields a later node needs out of an email, a form message, or a review, such as the order number and the request type.

## Write the instruction

1. **Give the chat its inputs.** The chat does not see `results`. Put the values it needs into the instruction. The merchant sees the instruction as the chat's first message, so write it in Markdown: short paragraphs and lists, with line breaks (`\n` in `workflow.json`).
2. **Name the sources and tools.** Say which connector, skill, or shop data to read, and what the chat may change. The chat already knows that no user is present and where its state directory is ([memory.md](memory.md)), so spend the instruction on the work.
3. **Ask for an artifact when a person will read the result.** A review, a report, or a plan reads better as an artifact than as an email body. Ask for it with a clear title. The run gets its link in `artifacts`.
4. **Write the node's `shape`.** `shape` is a JSON Schema on the node, required, written like the input schema of a tool in function calling: an object with `properties`, `required`, and a `description` on each field. The chat returns its result in that shape, and the next nodes read it as `results.<id>.data`. The instruction does not have to describe the format; say what each field means in its `description`. Ask for the fewest fields the next node needs.

## Use the reply

The output is `{ chat_id, artifacts, data }`. The chat's own messages are not in it; a person reads them in the chat.

- `data` is the chat's result, and it matches `shape`. The release check checks each `results.<id>.data.<field>` path against the shape.
- `artifacts` lists each artifact the chat created, oldest first, as `{ id, title, kind, url }`. `kind` is `document` or `page`. `url` opens the artifact for a signed-in merchant; it is not a public link. When the instruction asks for an artifact, check that the list is not empty before a node that needs it.
- `chat_id` names the chat. Log it when a later node fails, so a person can open the chat.

A chat that ends without a result in the shape fails the node with `schema_mismatch`.

## How the run waits

- Only the chat node's successors wait. Other paths of the run go on.
- The chat has a fixed deadline. Split work that may run long across runs, with the chat's state directory.
- To test the nodes after a chat node, pin its output in the fixture.
