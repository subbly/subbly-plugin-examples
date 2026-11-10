# CEL expressions

CEL computes one value from the data of the run. It has no statements, loops, local variables, or side effects.

## Where an expression goes

A node's input field takes a literal or `{ "expression": "<CEL>" }` as its whole value. To build an object or a list, write it in CEL: `{ "expression": "{'gte': results.trigger.since, 'lte': results.trigger.until}" }`. A trigger's input takes literals only.

Expressions go in node input fields, `core.switch` cases (a boolean), `core.loop` `items` and the body's inputs, and custom paging: [pages.md](pages.md).

| Variable | Holds | Where |
| --- | --- | --- |
| `results` | Each upstream node's output by id; the trigger is `results.trigger`. | Everywhere but paging. |
| `iter` | `value`, `index`, and `parent`, the outer loop's `iter`. | A loop body. |
| `page` | `input`, `output`, and `index` of one page. | `pages.items` and `pages.next`. |

## Writing one

- Read a field with `results.customer.email` and an element with `results.orders[0]`. Join strings with `+`. Compare with `==`, `!=`, `<`, `>=`, and combine with `&&`, `||`, `!`. Choose with `cond ? a : b`. Test membership with `'vip' in results.customer.tags`. The empty value is `null`.
- Work on a list with the macros `filter`, `map`, `exists`, and `all`, as in `results.customers.filter(c, c.email != null)`, and count with `size(x)`.
- Beside the built-ins: `sortBy(list, 'path')` sorts ascending by the field at a dot path, nulls last; `maxBy(list, 'path')` and `minBy(list, 'path')` return the element with the largest or smallest field, or `null`; `sum(list)` adds numbers. The strings extension adds `lowerAscii`, `upperAscii`, `trim`, `split`, `join`, `replace`, `substring`, `indexOf`, `charAt`, and `format`.
- Guard a field that can be missing with `has(x.y)`, which is false for a missing or `null` field. A node on a switch branch that did not run, or a merge key from it, is missing from `results`.
- Arithmetic needs one number kind. Whole numbers are `int` and the rest `double`, and one field can be either from run to run, so convert first: `double(results.order.total) * 1.1`. Comparisons mix freely.

Move logic that needs local variables or several steps into a code node: [code-nodes.md](code-nodes.md).

## What fails where

The release check reports a syntax error with its line and column, and checks each plain path, such as `results.customers[0].email`, against the node types: an unknown field, a wrong type, and a `null` the field does not take all fail. A computed expression, such as a ternary, a macro, or a function call, is checked for its paths only. At run time, an expression that fails, such as one that reads a missing key, fails the node with `expression`, and the message names the expression.
