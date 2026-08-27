// Position-aware JSON reader.
//
// JSON.parse throws away source locations, so a finding can only name a file.
// This parses to the same values while recording, for every node, where its key
// and its value start, which is what turns a message into an editor squiggle.

/**
 * @returns {{ok: true, root: Node, value: any} | {ok: false, line: number, col: number, message: string}}
 * A Node is {value, keyLine, keyCol, line, col, children: Map|Array}.
 */
export function parseJsonSource(text) {
  const state = { text, pos: 0, line: 1, col: 1 }
  try {
    skipWhitespace(state)
    const root = parseValue(state)
    skipWhitespace(state)
    if (state.pos < text.length) fail(state, `unexpected character ${JSON.stringify(text[state.pos])}`)
    return { ok: true, root, value: root.value }
  } catch (e) {
    if (e instanceof JsonSourceError) return { ok: false, line: e.line, col: e.col, message: e.message }
    throw e
  }
}

class JsonSourceError extends Error {
  constructor(message, line, col) {
    super(message)
    this.line = line
    this.col = col
  }
}

function fail(state, message) {
  throw new JsonSourceError(message, state.line, state.col)
}

function advance(state, count = 1) {
  for (let i = 0; i < count; i++) {
    if (state.text[state.pos] === '\n') {
      state.line++
      state.col = 1
    } else {
      state.col++
    }
    state.pos++
  }
}

function skipWhitespace(state) {
  while (state.pos < state.text.length && /\s/.test(state.text[state.pos])) advance(state)
}

function parseValue(state) {
  skipWhitespace(state)
  const line = state.line
  const col = state.col
  const char = state.text[state.pos]

  if (char === undefined) fail(state, 'unexpected end of input')
  if (char === '{') return parseObject(state, line, col)
  if (char === '[') return parseArray(state, line, col)
  if (char === '"') return { value: parseString(state), line, col, children: null }

  const literal = /^(true|false|null)/.exec(state.text.slice(state.pos))
  if (literal) {
    advance(state, literal[0].length)
    return { value: literal[0] === 'true' ? true : literal[0] === 'false' ? false : null, line, col, children: null }
  }

  const number = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(state.text.slice(state.pos))
  if (number) {
    advance(state, number[0].length)
    return { value: Number(number[0]), line, col, children: null }
  }

  fail(state, `unexpected character ${JSON.stringify(char)}`)
}

function parseObject(state, line, col) {
  advance(state) // {
  const children = new Map()
  const value = {}
  skipWhitespace(state)

  if (state.text[state.pos] === '}') {
    advance(state)
    return { value, line, col, children }
  }

  for (;;) {
    skipWhitespace(state)
    const keyLine = state.line
    const keyCol = state.col
    if (state.text[state.pos] !== '"') fail(state, 'expected a property name in double quotes')
    const key = parseString(state)

    skipWhitespace(state)
    if (state.text[state.pos] !== ':') fail(state, 'expected ":" after the property name')
    advance(state)

    const child = parseValue(state)
    child.keyLine = keyLine
    child.keyCol = keyCol
    children.set(key, child)
    value[key] = child.value

    skipWhitespace(state)
    if (state.text[state.pos] === ',') {
      advance(state)
      skipWhitespace(state)
      // A trailing comma is legal JSON5 but not JSON, and the builder uses JSON.parse.
      if (state.text[state.pos] === '}') fail(state, 'trailing comma is not valid JSON')
      continue
    }
    if (state.text[state.pos] === '}') {
      advance(state)
      return { value, line, col, children }
    }
    fail(state, 'expected "," or "}"')
  }
}

function parseArray(state, line, col) {
  advance(state) // [
  const children = []
  const value = []
  skipWhitespace(state)

  if (state.text[state.pos] === ']') {
    advance(state)
    return { value, line, col, children }
  }

  for (;;) {
    const child = parseValue(state)
    children.push(child)
    value.push(child.value)

    skipWhitespace(state)
    if (state.text[state.pos] === ',') {
      advance(state)
      skipWhitespace(state)
      if (state.text[state.pos] === ']') fail(state, 'trailing comma is not valid JSON')
      continue
    }
    if (state.text[state.pos] === ']') {
      advance(state)
      return { value, line, col, children }
    }
    fail(state, 'expected "," or "]"')
  }
}

function parseString(state) {
  advance(state) // opening quote
  let out = ''
  for (;;) {
    const char = state.text[state.pos]
    if (char === undefined) fail(state, 'unterminated string')
    if (char === '"') {
      advance(state)
      return out
    }
    if (char === '\\') {
      advance(state)
      const escape = state.text[state.pos]
      const simple = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
      if (escape in simple) {
        out += simple[escape]
        advance(state)
      } else if (escape === 'u') {
        const hex = state.text.slice(state.pos + 1, state.pos + 5)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail(state, 'invalid \\u escape')
        out += String.fromCharCode(parseInt(hex, 16))
        advance(state, 5)
      } else {
        fail(state, `invalid escape \\${escape}`)
      }
      continue
    }
    out += char
    advance(state)
  }
}

/**
 * Resolves a dotted/indexed path to a position.
 *
 * `at('plugins[0].source.type')` gives the value position; pass `key: true`
 * for the property name instead, which is what an unknown-key finding wants.
 * Falls back to the nearest resolvable ancestor so a finding always lands
 * somewhere sensible rather than at 1:1.
 */
export function locator(root) {
  return function at(path, { key = false } = {}) {
    if (!root) return { line: 1, col: 1 }
    if (!path) return { line: root.line, col: root.col }

    const steps = String(path)
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)

    let node = root
    let deepest = root
    let i = 0
    while (i < steps.length) {
      if (!node?.children) break

      if (Array.isArray(node.children)) {
        const next = node.children[Number(steps[i])]
        if (!next) break
        node = deepest = next
        i++
        continue
      }

      // Keys may themselves contain dots (co.subbly.builder), so rejoin the
      // longest run of steps that names a real child before giving up.
      let matched = null
      for (let take = steps.length - i; take >= 1; take--) {
        const candidate = steps.slice(i, i + take).join('.')
        const next = node.children.get(candidate)
        if (next) {
          matched = { next, take }
          break
        }
      }
      if (!matched) break
      node = deepest = matched.next
      i += matched.take
    }
    if (key && deepest.keyLine !== undefined) return { line: deepest.keyLine, col: deepest.keyCol }
    return { line: deepest.line, col: deepest.col }
  }
}
