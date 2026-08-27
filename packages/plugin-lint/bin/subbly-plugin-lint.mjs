#!/usr/bin/env node
// Lints a Subbly marketplace against the builder's release gate.
//
//   subbly-plugin-lint                    human output
//   subbly-plugin-lint --format unix      file:line:col, for editors and CI
//   subbly-plugin-lint --format json
//   subbly-plugin-lint --format github    GitHub Actions annotations
//   subbly-plugin-lint --strict           warnings also fail
//   subbly-plugin-lint --root <dir>       lint somewhere other than the cwd
//   subbly-plugin-lint --no-git           skip the version-bump check
//   subbly-plugin-lint --rules            list every rule and exit
//
// Exit 0 when there are no errors, 1 otherwise.

import { lint } from '../src/rules.mjs'
import { FORMATTERS, RULES } from '../src/report.mjs'

const argv = process.argv.slice(2)

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const next = argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

if (argv.includes('--rules')) {
  const width = Math.max(...Object.keys(RULES).map((r) => r.length))
  for (const [id, description] of Object.entries(RULES)) {
    console.log(`${id.padEnd(width)}  ${description}`)
  }
  console.log(`\n${Object.keys(RULES).length} rules.`)
  process.exit(0)
}

const explicitRoot = flag('root', null)
const root = explicitRoot === null || explicitRoot === true ? process.cwd() : explicitRoot
const format = flag('format', 'stylish')
const strict = argv.includes('--strict')

if (!FORMATTERS[format]) {
  console.error(`Unknown format ${JSON.stringify(format)}. Available: ${Object.keys(FORMATTERS).join(', ')}`)
  process.exit(2)
}

// Comparing against origin/main only makes sense for the checkout you are in,
// so an explicit --root (a fixture, a temp copy) turns the git checks off.
const git = !argv.includes('--no-git') && explicitRoot === null

const report = lint(root, { git })
const output = FORMATTERS[format](report)
if (output.trim()) console.log(output)

process.exit(report.errors.length > 0 || (strict && report.warnings.length > 0) ? 1 : 0)
