# Writing for the agent

How to write text the agent runs: a `SKILL.md`, an `AGENT.md`, an automation prompt, `instructions.md`. The packaging differs. The writing does not. These rules make the agent take the same path on each run.

Each document has up to two parts. A **trigger** decides when the text loads. A **body** decides what the agent does once it is loaded. Judge each part on its own.

| Type | Trigger | Body |
|---|---|---|
| Skill | `description` in frontmatter | loaded into the main agent's context |
| Agent | `description` in frontmatter | the subagent's system prompt |
| Automation | the cron schedule, no trigger text | the prompt the builder runs unattended |
| Instructions | none, always loaded | a few lines on every turn |

## The trigger

A skill or agent description sits in context on every turn of every project that installs the plugin. It is the only thing the main agent sees before it loads the skill or starts the agent. Its wording, not the body, decides whether it fires.

Write it as a list of situations, not as a summary of the body. Start with what the document is in a few words, then the cases that must trigger it: "Use when the user asks X; when a file Y changes; when Z fails." Front-load the words the user is likely to type. A good body behind a weak description is a bug: it never loads. Sharpen the description before you inline the material elsewhere.

Each case is a distinct branch of the body. Synonyms for one branch are one branch written twice. Cut them. Cut identity the body already carries. Each word costs context on every turn, forever, so the trigger earns harder pruning than the body.

For an agent, the description also tells the main agent what comes back. Name the result in one clause, so the main agent knows when to delegate and what to expect.

## Prose over examples

Write the body as instructions and expected end results. Describe what the agent must do, in which order, and what "done" looks like. Do not teach through a pile of examples.

Examples fail in two ways. The agent copies an example into a case it does not fit, because a concrete artifact pulls harder than the rule beside it. And each example is long, so the rule that matters gets buried in the middle of sample output. A rule stated in one sentence transfers to all cases. An example transfers to cases that look like the example.

Use one example only when prose cannot carry the shape: an exact file format, a manifest key, a command line. Keep it minimal and put the rule next to it. Never show two examples where one plus a sentence does the job.

When you want to show a result, describe the end state instead: "The report has one section per broken link with the source page, the target and the HTTP status." The agent can produce that from the sentence. It does not need a sample report.

## Steps and done criteria

A body is built from **steps** (ordered actions) and **reference** (rules and facts read on demand). Put the steps first. Put reference under its own heading, so a reader of one rule finds its caveats beside it, not scattered through the file.

End each step on a criterion the agent can check. "Every product page visited" tells done from not-done. "Enough understanding gathered" does not, and the agent ends the step early to reach the steps it can see ahead. The criterion also sets how hard the agent works: "every modified file accounted for" forces more than "produce a change list". The strongest criteria are both checkable and exhaustive.

An agent body and an automation prompt need one more thing: the last step names the final message. The main agent gets only that message back from a subagent, and nobody reads an automation's transcript. State what the final message must contain, and it is the done criterion for the whole run.

## Say what to do, not what to avoid

State the target behaviour. "Write one-line comments" beats "do not write long comments". A prohibition puts the forbidden behaviour in context and makes it more available, not less. Use a prohibition only as a hard guardrail you cannot phrase as a positive, and pair it with the positive target.

Pick strong, existing words the model already knows and reuse them as a single token. "Tight loop", "dry run", "idempotent". A word repeated anchors the same behaviour each time it appears and costs one token. A phrase spelled out at three places is three restatements begging to collapse into one word. Coining a new term works only when you define it once, clearly. It recruits nothing the model already knows.

## Give the agent what it cannot see

A skill body runs inside the main agent, which already knows the project. An agent body and an automation prompt do not. The subagent starts with a fresh context and knows nothing about the shop, the stack or the conventions. The automation runs with no user to ask. Put all they need in the body, or name a skill for them to load. A step that says "follow the project conventions" is a no-op in a subagent: it has none to follow.

## Keep it short

Inline what every path through the body needs. Push what only some paths reach into `references/<file>.md` beside the document and name it from the body with the condition to open it. The document's directory is the root for these paths. A long body thins attention across all of it, even when every line is correct.

`instructions.md` is the extreme case. It is in every prompt of every turn and nothing prunes it for you. Keep only rules that must hold on each turn. All conditional content is a skill.

Prune line by line:

- **One source of truth**: say each thing in one place. The same rule in two places drifts and inflates its own weight.
- **Do not restate the environment**: `package.json` scripts, config files and `--help` output are already there and cannot go stale. Write down what the agent cannot find by looking: the convention nobody wrote, the reason behind a choice, the gotcha no config confesses.
- **Delete no-ops**: a sentence the agent already obeys by default pays context to say nothing. "Be careful" is a no-op. Delete the whole sentence, or replace the weak word with one strong enough to change behaviour.
- **Delete stale lines**: a body grows by layers because adding feels safe and removing feels risky. Each release, read the document once and remove what no longer bears on the task.

## Checklist before commit

- A skill or agent description lists the trigger cases and starts with the words a user would type. An agent description also names what comes back.
- The body opens with the steps, in order, each ending on a checkable criterion. An agent or automation body ends by naming the final message.
- Rules are prose. Any example is minimal, has a rule beside it and exists because prose could not carry the shape.
- Each instruction says what to do. Prohibitions are rare and paired with the positive.
- An agent or automation body carries all project knowledge it needs, or names the skill to load.
- Nothing restates a file or command the agent can read itself.
- Every line still bears on the task. Branch-specific material lives in `references/`. `instructions.md` holds only every-turn rules.
- `pnpm lint` passes with 0 errors.
