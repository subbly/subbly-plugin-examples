// Line-aware frontmatter reader.
//
// The builder parses with front-matter + js-yaml safeLoad. We support the flat
// key/scalar/list shapes plugin content actually uses and refuse anything
// richer, rather than guessing and quietly disagreeing with js-yaml.
//
// Every key records the line it sits on so findings can point at it.

export function readFrontmatter(text) {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = stripped.split(/\r?\n/)
  const opener = lines[0]?.trimEnd()

  if (opener !== '---' && opener !== '= yaml =') {
    // front-matter yields {} here, so the builder fails on the missing
    // description rather than on a parse error.
    return { fenced: false, attributes: {}, keyLines: {}, body: stripped, bodyLine: 1 }
  }

  let close = -1
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd()
    if (trimmed === '---' || trimmed === '...' || trimmed === '= yaml =') {
      close = i
      break
    }
  }
  if (close === -1) {
    return { fenced: false, unterminated: true, attributes: {}, keyLines: {}, body: stripped, bodyLine: 1 }
  }

  const attributes = {}
  const keyLines = {}
  let pendingKey = null

  for (let i = 1; i < close; i++) {
    const raw = lines[i]
    const lineNumber = i + 1
    if (!raw.trim() || raw.trim().startsWith('#')) continue

    const item = raw.match(/^\s+-\s*(.*)$/)
    if (item && pendingKey) {
      if (!Array.isArray(attributes[pendingKey])) attributes[pendingKey] = []
      attributes[pendingKey].push(unquote(item[1]))
      continue
    }

    const pair = raw.match(/^([A-Za-z0-9_$-]+)\s*:\s*(.*)$/)
    if (!pair) {
      return { fenced: true, unsupported: raw.trim(), unsupportedLine: lineNumber, attributes: {}, keyLines: {}, body: '', bodyLine: close + 2 }
    }

    const [, key, rawValue] = pair
    if (key in keyLines) {
      return { fenced: true, duplicate: key, duplicateLine: lineNumber, attributes: {}, keyLines: {}, body: '', bodyLine: close + 2 }
    }
    keyLines[key] = lineNumber

    const value = rawValue.trim()
    if (value === '') {
      attributes[key] = null
      pendingKey = key
    } else if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      attributes[key] = inner ? inner.split(',').map((s) => unquote(s.trim())) : []
      pendingKey = null
    } else {
      attributes[key] = unquote(value)
      pendingKey = null
    }
  }

  return {
    fenced: true,
    attributes,
    keyLines,
    body: lines.slice(close + 1).join('\n'),
    bodyLine: close + 2,
  }
}

function unquote(value) {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))
  return quoted && value.length >= 2 ? value.slice(1, -1) : value
}

/** Line of the first match, for findings that point into the body. */
export function lineOf(text, needle, fallback = 1) {
  const index = text.indexOf(needle)
  if (index === -1) return fallback
  return text.slice(0, index).split('\n').length
}

/** Column of the first match on its line, 1-based. */
export function colOf(text, needle, fallback = 1) {
  const index = text.indexOf(needle)
  if (index === -1) return fallback
  const lineStart = text.lastIndexOf('\n', index) + 1
  return index - lineStart + 1
}
