// ESLint bridge.
//
// The release gate is cross-file: whether plugin.json is valid depends on
// marketplace.json, and a missing automations/<slug>.md is a defect in a file
// that does not exist. ESLint visits one existing file at a time, so rules
// cannot be written that way directly.
//
// Instead the engine runs once per ESLint invocation and each file is handed
// the findings that belong to it. Every rule in src/rules.mjs reaches
// the editor, absence-checks included, and the engine stays the one place a
// rule is written.

import { relative } from 'node:path'
import { lint } from './rules.mjs'

let cache = null

function findingsFor(cwd, filename) {
  // ESLint lints files in one pass, so a single engine run covers all of them.
  // Keyed on cwd so a watching editor re-runs when the workspace changes.
  if (!cache || cache.cwd !== cwd) {
    const byFile = new Map()
    // git comparisons are for CI, not for a keystroke in the editor.
    for (const finding of lint(cwd, { git: false }).findings) {
      if (!byFile.has(finding.file)) byFile.set(finding.file, [])
      byFile.get(finding.file).push(finding)
    }
    cache = { cwd, byFile, at: Date.now() }
  }
  return cache.byFile.get(relative(cwd, filename)) ?? []
}

/** Editors keep one process alive, so stale results need a short lifetime. */
const MAX_CACHE_MS = 1000

function level(want) {
  return {
    meta: {
      type: want === 'error' ? 'problem' : 'suggestion',
      docs: {
        description:
          want === 'error'
            ? 'Release-gate errors: the marketplace refresh throws, so no plugin releases'
            : 'Release-gate warnings: accepted by the builder, but wrong, dead, or broken at runtime',
      },
      schema: [],
    },
    create(context) {
      if (cache && Date.now() - cache.at > MAX_CACHE_MS) cache = null

      const report = () => {
        for (const finding of findingsFor(context.cwd, context.filename)) {
          if (finding.level !== want) continue
          context.report({
            loc: { line: finding.line, column: finding.col },
            message: `${finding.message} [${finding.ruleId}]`,
          })
        }
      }

      // Document is the momoa (JSON) root; root is the mdast (markdown) one.
      // Program covers a plain JS file, should this ever lint one.
      return { 'Document:exit': report, 'root:exit': report, 'Program:exit': report }
    },
  }
}

export default {
  meta: { name: 'subbly', version: '1.0.0' },
  rules: {
    errors: level('error'),
    warnings: level('warn'),
  },
}
