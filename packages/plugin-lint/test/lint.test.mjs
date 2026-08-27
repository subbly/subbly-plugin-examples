#!/usr/bin/env node
// Fixture tests for the linter.
//
// Each case builds a throwaway marketplace in a temp directory, lints it, and
// asserts on the RULE ID that fired. Asserting on ids rather than message text
// means wording can change without breaking the suite, and a case cannot pass
// by tripping some unrelated rule.
//
// Usage: node test/lint.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { RULES } from '../src/report.mjs'
import { envVarName } from '../src/rules.mjs'

const LINTER = join(dirname(dirname(fileURLToPath(import.meta.url))), 'bin', 'subbly-plugin-lint.mjs')
const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'

// --- fixture helpers -------------------------------------------------------

function write(root, path, content) {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2))
}

/** A minimal marketplace that lints clean, as the baseline every case edits. */
function baseline(root, { marketplace, plugin, skill = true } = {}) {
  write(root, 'marketplace.json', marketplace ?? {
    slug: 'test-marketplace',
    version: '1.0.0',
    plugins: [{ slug: 'alpha', source: { type: 'local', path: 'plugins/alpha' } }],
  })
  write(root, 'plugins/alpha/plugin.json', plugin ?? {
    $schema: SCHEMA,
    name: 'alpha',
    description: 'A test plugin.',
    extensions: { 'co.subbly.builder': { displayName: 'Alpha' } },
  })
  if (skill) {
    write(root, 'plugins/alpha/skills/demo/SKILL.md', '---\nname: demo\ndescription: A demo skill.\n---\n\nBody.\n')
  }
}

function run(root) {
  try {
    return JSON.parse(execFileSync('node', [LINTER, '--root', root, '--format', 'json'], { encoding: 'utf8' }))
  } catch (e) {
    // A non-zero exit is expected whenever errors are found; stdout still holds JSON.
    if (!e.stdout) throw e
    return JSON.parse(e.stdout)
  }
}

// --- assertions ------------------------------------------------------------

let passed = 0
const failures = []
const exercised = new Set()

/**
 * @param name    what the case proves
 * @param build   populates the fixture root
 * @param expect  {rule} must appear as an error, {warn} as a warning,
 *                {clean: true} for no errors at all
 */
function check(name, build, expect) {
  const root = mkdtempSync(join(tmpdir(), 'subbly-lint-test-'))
  try {
    build(root)
    const result = run(root)

    if (expect.clean) {
      if (result.errors.length === 0) passed++
      else failures.push(`${name}\n    expected no errors, got: ${result.errors.map((e) => e.ruleId).join(', ')}`)
      return
    }

    const wanted = expect.warn ?? expect.rule
    if (!RULES[wanted]) {
      failures.push(`${name}\n    test refers to unregistered rule id ${JSON.stringify(wanted)}`)
      return
    }
    exercised.add(wanted)

    const pool = expect.warn ? result.warnings : result.errors
    const hit = pool.find((f) => f.ruleId === wanted)

    if (!hit) {
      const seen = pool.length === 0 ? '(nothing reported)' : pool.map((f) => f.ruleId).join(', ')
      failures.push(`${name}\n    expected ${expect.warn ? 'warning' : 'error'} ${wanted}\n    got: ${seen}`)
      return
    }
    // A finding with no position is a finding an editor cannot show.
    if (!Number.isInteger(hit.line) || hit.line < 1) {
      failures.push(`${name}\n    rule ${wanted} reported a bad line: ${hit.line}`)
      return
    }
    passed++
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// --- the baseline must be clean, or every other case is meaningless ---------

check('baseline fixture is clean', (r) => baseline(r), { clean: true })

// --- marketplace.json ------------------------------------------------------

check('rejects a bad version', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0', plugins: [] },
}), { rule: 'marketplace/version' })

check('rejects an uppercase slug', (r) => baseline(r, {
  marketplace: { slug: 'Bad', version: '1.0.0', plugins: [] },
}), { rule: 'marketplace/slug' })

check('rejects a non-local source type', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'alpha', source: { type: 'git', path: 'plugins/alpha' } }] },
}), { rule: 'marketplace/source-type' })

check('rejects path traversal', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'alpha', source: { type: 'local', path: '../escape' } }] },
}), { rule: 'marketplace/source-path' })

check('catches a duplicate plugin slug', (r) => baseline(r, {
  marketplace: {
    slug: 'm', version: '1.0.0',
    plugins: [
      { slug: 'a-b', source: { type: 'local', path: 'plugins/alpha' } },
      { slug: 'a-b', source: { type: 'local', path: 'plugins/alpha' } },
    ],
  },
}), { rule: 'marketplace/slug-collision' })

check('accepts published false on an entry', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'alpha', published: false, source: { type: 'local', path: 'plugins/alpha' } }] },
}), { clean: true })

check('rejects a non-boolean published', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'alpha', published: 'no', source: { type: 'local', path: 'plugins/alpha' } }] },
}), { rule: 'marketplace/published' })

check('rejects a dot in a plugin slug', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'a.b', source: { type: 'local', path: 'plugins/alpha' } }] },
}), { rule: 'marketplace/entry-slug' })

check('catches a source.path that does not exist', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'ghost', source: { type: 'local', path: 'plugins/ghost' } }] },
}), { rule: 'marketplace/source-missing' })

check('warns about a directory no entry points at', (r) => {
  baseline(r)
  write(r, 'plugins/orphan/plugin.json', { $schema: SCHEMA, name: 'orphan' })
}, { warn: 'marketplace/unlisted-directory' })

check('warns about a path basename that differs from the slug', (r) => {
  baseline(r, { marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: 'alpha', source: { type: 'local', path: 'plugins/other' } }] } })
  write(r, 'plugins/other/plugin.json', { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } })
}, { warn: 'marketplace/path-convention' })

// --- plugin.json -----------------------------------------------------------

check('rejects an unknown top-level key', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', displayName: 'Alpha', extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/unknown-key' })

check('rejects a wrong $schema', (r) => baseline(r, {
  plugin: { $schema: 'https://example.com/other.json', name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/schema-url' })

check('rejects name that differs from the marketplace slug', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'beta', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/name-slug' })

check('rejects a missing description', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/description' })

check('rejects a missing namespace', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: {} },
}), { rule: 'manifest/namespace-required' })

check('rejects a missing displayName', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': {} } },
}), { rule: 'manifest/display-name' })

check('rejects a typo inside the namespace', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', displayname: 'oops' } } },
}), { rule: 'manifest/namespace-unknown-key' })

check('warns that a manifest version is discarded', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', version: '1.0.0', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { warn: 'manifest/version-discarded' })

check('rejects a non-strict author key', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', author: { name: 'S', twitter: '@s' }, extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/author' })

// --- config fields ---------------------------------------------------------

const withFields = (fields, extra = {}) => ({
  $schema: SCHEMA, name: 'alpha', description: 'x',
  extensions: { 'co.subbly.builder': { displayName: 'Alpha', fields, ...extra } },
})

check('rejects a lowercase field key', (r) => baseline(r, {
  plugin: withFields([{ key: 'api_key', label: 'Key', type: 'text' }]),
}), { rule: 'field/key-format' })

check('warns about a duplicate field key', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'One', type: 'text' }, { key: 'K', label: 'Two', type: 'text' }]),
}), { warn: 'field/key-duplicate' })

check('rejects public plus secret', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'K', type: 'text', public: true, secret: true }]),
}), { rule: 'field/public-secret' })

check('rejects a select with no options', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'K', type: 'select' }]),
}), { rule: 'field/options' })

check('rejects options on a text field', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'K', type: 'text', options: ['a'] }]),
}), { rule: 'field/options' })

check('warns about a public credential', (r) => baseline(r, {
  plugin: withFields([{ key: 'API_KEY', label: 'Key', type: 'text', public: true }]),
}), { warn: 'field/public-credential' })

check('rejects a default plugin with required fields', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'K', type: 'text', required: true }], { default: true }),
}), { rule: 'field/default-required' })

// --- automations -----------------------------------------------------------

const withAutomation = (schedule, model = 'normal') => ({
  $schema: SCHEMA, name: 'alpha', description: 'x',
  extensions: { 'co.subbly.builder': { displayName: 'Alpha', automations: { nightly: { name: 'Nightly', schedule, model } } } },
})

check('rejects a schedule under the 15-minute floor', (r) => {
  baseline(r, { plugin: withAutomation('*/5 * * * *') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do the thing.')
}, { rule: 'automation/schedule-floor' })

check('accepts a schedule exactly at the floor', (r) => {
  baseline(r, { plugin: withAutomation('*/15 * * * *') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do the thing.')
}, { clean: true })

check('accepts an hourly schedule', (r) => {
  baseline(r, { plugin: withAutomation('0 * * * *') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do the thing.')
}, { clean: true })

check('rejects an invalid cron expression', (r) => {
  baseline(r, { plugin: withAutomation('not a cron') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do the thing.')
}, { rule: 'automation/schedule-syntax' })

check('rejects a model outside the two allowed', (r) => {
  baseline(r, { plugin: withAutomation('0 9 * * *', 'genius') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do the thing.')
}, { rule: 'automation/model' })

check('rejects an extra key in a declaration', (r) => {
  baseline(r, {
    plugin: {
      $schema: SCHEMA, name: 'alpha', description: 'x',
      extensions: { 'co.subbly.builder': { displayName: 'Alpha', automations: { nightly: { name: 'N', schedule: '0 9 * * *', model: 'normal', timezone: 'UTC' } } } },
    },
  })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do the thing.')
}, { rule: 'automation/unknown-key' })

check('rejects a declared automation with no file', (r) => {
  baseline(r, { plugin: withAutomation('0 9 * * *') })
}, { rule: 'automation/missing-file' })

check('rejects an automation file with no declaration', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/automations/stray.md', 'Orphan.')
}, { rule: 'automation/orphan-file' })

check('rejects an empty automation file', (r) => {
  baseline(r, { plugin: withAutomation('0 9 * * *') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', '   \n')
}, { rule: 'automation/empty-file' })

check('warns about frontmatter in an automation file', (r) => {
  baseline(r, { plugin: withAutomation('0 9 * * *') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', '---\nname: Nightly\n---\n\nDo the thing.\n')
}, { warn: 'automation/frontmatter' })

// --- setup ------------------------------------------------------------------

const withSetup = {
  $schema: SCHEMA, name: 'alpha', description: 'x',
  extensions: { 'co.subbly.builder': { displayName: 'Alpha', setup: true } },
}

check('accepts setup: true with an install skill', (r) => {
  baseline(r, { plugin: withSetup })
  write(r, 'plugins/alpha/skills/install/SKILL.md', '---\nname: install\ndescription: Finish setting up Alpha.\n---\n\nSteps.\n')
}, { clean: true })

check('rejects setup: true without an install skill', (r) => {
  baseline(r, { plugin: withSetup })
}, { rule: 'setup/missing-install-skill' })

check('rejects a non-boolean setup flag', (r) => {
  baseline(r, {
    plugin: {
      $schema: SCHEMA, name: 'alpha', description: 'x',
      extensions: { 'co.subbly.builder': { displayName: 'Alpha', setup: 'yes' } },
    },
  })
}, { rule: 'manifest/boolean' })

// --- mcp.json and connectors ----------------------------------------------

const withConnector = {
  $schema: SCHEMA, name: 'alpha', description: 'x',
  extensions: { 'co.subbly.builder': { displayName: 'Alpha', connectors: { alpha: { auth: 'oauth' } } } },
}

check('rejects a declared connector with no mcp.json', (r) => baseline(r, { plugin: withConnector }), {
  rule: 'connector/no-mcp',
})

check('rejects a connector mcp.json does not define', (r) => {
  baseline(r, { plugin: withConnector })
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { other: { type: 'streamable-http', url: 'https://x.test/mcp' } } })
}, { rule: 'connector/undefined-server' })

check('rejects a connector auth other than oauth', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', connectors: { alpha: { auth: 'header' } } } } },
}), { rule: 'connector/auth' })

check('rejects a non-https url', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { s: { type: 'streamable-http', url: 'http://x.test/mcp' } } })
}, { rule: 'mcp/https-only' })

check('rejects a stdio server', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { s: { type: 'stdio', url: 'https://x.test/mcp' } } })
}, { rule: 'mcp/server-type' })

check('rejects a command-based server', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/mcp', command: 'node' } } })
}, { rule: 'mcp/unknown-key' })

check('rejects an uppercase server name', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { Bad: { type: 'streamable-http', url: 'https://x.test/mcp' } } })
}, { rule: 'mcp/server-name' })

check('rejects an undeclared env var in a header', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', {
    $schema: MCP_SCHEMA,
    mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/mcp', headers: { 'X-Key': '${MYSTERY_KEY}' } } },
  })
}, { rule: 'mcp/undeclared-env' })

check('accepts a builder default env var in a header', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', {
    $schema: MCP_SCHEMA,
    mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/mcp', headers: { 'X-Key': '${SUBBLY_API_KEY}' } } },
  })
}, { clean: true })

check('accepts a declared field key in a header', (r) => {
  baseline(r, { plugin: withFields([{ key: 'MY_TOKEN', label: 'Token', type: 'text', secret: true }]) })
  write(r, 'plugins/alpha/mcp.json', {
    $schema: MCP_SCHEMA,
    mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/mcp', headers: { 'X-Key': '${MY_TOKEN}' } } },
  })
}, { clean: true })

check('warns about a lowercase interpolation that never expands', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', {
    $schema: MCP_SCHEMA,
    mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/mcp', headers: { 'X-Key': '${apiKey}' } } },
  })
}, { warn: 'mcp/lowercase-interpolation' })

check('accepts two plugins sharing a server name, namespacing isolates them', (r) => {
  write(r, 'marketplace.json', {
    slug: 'm', version: '1.0.0',
    plugins: [
      { slug: 'alpha', source: { type: 'local', path: 'plugins/alpha' } },
      { slug: 'beta', source: { type: 'local', path: 'plugins/beta' } },
    ],
  })
  for (const slug of ['alpha', 'beta']) {
    write(r, `plugins/${slug}/plugin.json`, { $schema: SCHEMA, name: slug, description: 'x', extensions: { 'co.subbly.builder': { displayName: slug } } })
    write(r, `plugins/${slug}/mcp.json`, { $schema: MCP_SCHEMA, mcpServers: { shared: { type: 'streamable-http', url: `https://${slug}.test/mcp` } } })
  }
}, { clean: true })

check('warns when a server name restates the plugin-slug prefix', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', {
    $schema: MCP_SCHEMA,
    mcpServers: { alpha__api: { type: 'streamable-http', url: 'https://x.test/mcp' } },
  })
}, { warn: 'connector/manual-prefix' })

// --- skills ----------------------------------------------------------------

check('rejects a skill directory with no SKILL.md', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/broken/notes.md', 'stray')
}, { rule: 'skill/missing-file' })

check('rejects a SKILL.md with no frontmatter', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/nofm/SKILL.md', '# Just a heading\n')
}, { rule: 'skill/frontmatter' })

check('rejects a blank line before the frontmatter fence', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/blank/SKILL.md', '\n---\ndescription: x\n---\n\nBody.\n')
}, { rule: 'skill/frontmatter' })

check('rejects a SKILL.md with no description', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/nodesc/SKILL.md', '---\nname: nodesc\n---\n\nBody.\n')
}, { rule: 'skill/description' })

check('rejects a duplicate frontmatter key', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/dup/SKILL.md', '---\ndescription: one\ndescription: two\n---\n\nBody.\n')
}, { rule: 'skill/frontmatter' })

check('rejects a dot in a skill directory name', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/a.b/SKILL.md', '---\ndescription: x\n---\n\nBody.\n')
}, { rule: 'skill/name-format' })

check('warns about an extra frontmatter key', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/extra/SKILL.md', '---\nname: extra\ndescription: x\nlicense: MIT\n---\n\nBody.\n')
}, { warn: 'skill/extra-frontmatter' })

check('warns about a loose file under skills/', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/stray.md', 'not a skill')
}, { warn: 'skill/loose-file' })

check('warns about an empty skill body', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/hollow/SKILL.md', '---\nname: hollow\ndescription: x\n---\n')
}, { warn: 'skill/empty-body' })

// --- agents ----------------------------------------------------------------

check('rejects an agent with an empty body', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', '---\ndescription: Helps.\n---\n\n   \n')
}, { rule: 'agent/empty-body' })

check('rejects an agent with no description', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', '---\ntools: read_file\n---\n\nBody.\n')
}, { rule: 'agent/description' })

check('rejects a disallowed tool', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', '---\ndescription: Helps.\ntools: read_file, publish\n---\n\nBody.\n')
}, { rule: 'agent/disallowed-tools' })

check('accepts the quoted wildcard tools form', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', "---\nname: helper\ndescription: Helps.\ntools: '*'\n---\n\nBody.\n")
}, { clean: true })

check('accepts a YAML list of tools', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', '---\nname: helper\ndescription: Helps.\ntools:\n  - read_file\n  - skill\n---\n\nBody.\n')
}, { clean: true })

check('rejects a dot in an agent directory name', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/my.helper/AGENT.md', '---\nname: my.helper\ndescription: Helps.\n---\n\nBody.\n')
}, { rule: 'agent/name-format' })

check('rejects a frontmatter agent name that differs from the file name', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', '---\nname: other\ndescription: Helps.\n---\n\nBody.\n')
}, { rule: 'agent/name-mismatch' })

check('warns about a loose file directly under agents/', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/notes.md', 'ignored')
}, { warn: 'agent/loose-file' })

check('rejects an agent directory with no AGENT.md', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/hollow/notes.md', 'ignored')
}, { rule: 'agent/missing-file' })

// --- layout, scripts and sandbox paths -------------------------------------

check('rejects package.json with dependencies and no lockfile', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/scripts/package.json', { name: 's', dependencies: { picocolors: '^1' } })
}, { rule: 'scripts/lockfile-missing' })

check('accepts package.json with dependencies and a lockfile', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/scripts/package.json', { name: 's', dependencies: { picocolors: '^1' } })
  write(r, 'plugins/alpha/co.subbly.builder/scripts/pnpm-lock.yaml', "lockfileVersion: '9.0'\n")
}, { clean: true })

check('rejects a symlink under plugins/', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/real.md', 'content')
  symlinkSync(join(r, 'plugins/alpha/real.md'), join(r, 'plugins/alpha/link.md'))
}, { rule: 'layout/symlink' })

check('warns about builder content at the plugin root', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/agents/stray.md', '---\ndescription: x\n---\n\nBody.\n')
}, { warn: 'layout/root-content' })

check('rejects a hardcoded plugins path', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/demo/SKILL.md', '---\nname: demo\ndescription: x\n---\n\nRun `.subbly/plugins/x/go.js`.\n')
}, { rule: 'sandbox/path-absolute' })

check('rejects a hardcoded workspace path', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/automations/tick.md', 'Write to /project/workspace/x/log.txt.\n')
  write(r, 'plugins/alpha/plugin.json', JSON.stringify({ $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', automations: { tick: { name: 'Tick', schedule: '0 * * * *', model: 'normal' } } } } }, null, 2))
}, { rule: 'sandbox/path-absolute' })

check('warns about a scripts reference the plugin does not ship', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/demo/SKILL.md', '---\nname: demo\ndescription: x\n---\n\nRun `node scripts/go.js`.\n')
}, { warn: 'sandbox/script-missing' })

check('accepts a scripts reference that matches a shipped script', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/demo/SKILL.md', '---\nname: demo\ndescription: x\n---\n\nRun `node scripts/go.js`.\n')
  write(r, 'plugins/alpha/co.subbly.builder/scripts/go.js', 'console.log(1)\n')
}, { clean: true })

// --- JSON parse positions --------------------------------------------------

check('reports a trailing comma as a parse error', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/plugin.json', '{\n  "$schema": "' + SCHEMA + '",\n  "name": "alpha",\n}\n')
}, { rule: 'manifest/parse' })

check('reports invalid JSON in marketplace.json', (r) => {
  baseline(r)
  write(r, 'marketplace.json', '{ "slug": "m", }')
}, { rule: 'marketplace/parse' })

check('rejects a non-object marketplace root', (r) => {
  baseline(r)
  write(r, 'marketplace.json', '[]')
}, { rule: 'marketplace/root-type' })

check('rejects a non-array plugins', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: {} },
}), { rule: 'marketplace/plugins-type' })

check('warns about an empty plugins array', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [] },
}), { warn: 'marketplace/plugins-empty' })

check('rejects an entry slug with a leading dash', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', plugins: [{ slug: '-bad', source: { type: 'local', path: 'plugins/alpha' } }] },
}), { rule: 'marketplace/entry-slug' })

check('warns about an unknown marketplace key', (r) => baseline(r, {
  marketplace: { slug: 'm', version: '1.0.0', owner: 'subbly', plugins: [] },
}), { warn: 'marketplace/unknown-key' })

check('rejects a missing plugin.json', (r) => {
  write(r, 'marketplace.json', { slug: 'm', version: '1.0.0', plugins: [{ slug: 'alpha', source: { type: 'local', path: 'plugins/alpha' } }] })
  write(r, 'plugins/alpha/skills/demo/SKILL.md', '---\nname: demo\ndescription: x\n---\n\nBody.\n')
}, { rule: 'manifest/missing' })

check('rejects an over-long license', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', license: 'M'.repeat(101), extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/string-length' })

check('rejects more than 20 keywords', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', keywords: Array.from({ length: 21 }, (_, i) => `k${i}`), extensions: { 'co.subbly.builder': { displayName: 'Alpha' } } },
}), { rule: 'manifest/keywords' })

check('rejects a non-boolean default', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', default: 'yes' } } },
}), { rule: 'manifest/boolean' })

check('rejects an empty image', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', image: '' } } },
}), { rule: 'manifest/image' })

check('rejects a missing field label', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', type: 'text' }]),
}), { rule: 'field/label' })

check('rejects an unknown field type', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'K', type: 'number' }]),
}), { rule: 'field/type' })

check('rejects an over-long field pattern', (r) => baseline(r, {
  plugin: withFields([{ key: 'K', label: 'K', type: 'text', pattern: 'a'.repeat(201) }]),
}), { rule: 'field/pattern' })

check('rejects an uppercase automation key', (r) => {
  baseline(r, {
    plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', automations: { Nightly: { name: 'N', schedule: '0 9 * * *', model: 'normal' } } } } },
  })
  write(r, 'plugins/alpha/co.subbly.builder/automations/Nightly.md', 'Do it.')
}, { rule: 'automation/key-slug' })

check('rejects a missing automation name', (r) => {
  baseline(r, {
    plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', automations: { nightly: { schedule: '0 9 * * *', model: 'normal' } } } } },
  })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do it.')
}, { rule: 'automation/name' })

check('warns that L syntax cannot be checked offline', (r) => {
  baseline(r, { plugin: withAutomation('0 9 L * *') })
  write(r, 'plugins/alpha/co.subbly.builder/automations/nightly.md', 'Do it.')
}, { warn: 'automation/schedule-unverified' })

check('reports invalid JSON in mcp.json', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', '{ "mcpServers": }')
}, { rule: 'mcp/parse' })

check('rejects a wrong mcp $schema', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: SCHEMA, mcpServers: {} })
}, { rule: 'mcp/schema-url' })

check('rejects a non-object mcpServers', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: [] })
}, { rule: 'mcp/servers-type' })

check('rejects an unparseable server url', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { s: { type: 'streamable-http', url: 'not a url' } } })
}, { rule: 'mcp/url' })

check('warns about interpolation in a server url', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/${SUBBLY_API_KEY}' } } })
}, { warn: 'mcp/url-interpolation' })

check('rejects an empty header value', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/mcp.json', { $schema: MCP_SCHEMA, mcpServers: { s: { type: 'streamable-http', url: 'https://x.test/mcp', headers: { 'X-Key': '' } } } })
}, { rule: 'mcp/header-shape' })

check('rejects a skill name that differs from its directory', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/skills/folder/SKILL.md', '---\nname: different\ndescription: x\n---\n\nBody.\n')
}, { rule: 'skill/name-mismatch' })

check('rejects agent frontmatter that is never closed', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/agents/helper/AGENT.md', '---\ndescription: Helps.\n\nBody.\n')
}, { rule: 'agent/frontmatter' })



check('warns about committed node_modules', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/scripts/node_modules/pkg/index.js', 'module.exports = 1')
}, { warn: 'layout/node-modules' })

check('warns about a dependency-free package.json with no lockfile', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/scripts/package.json', { name: 's' })
}, { warn: 'scripts/lockfile-absent' })

check('reports invalid JSON in scripts/package.json', (r) => {
  baseline(r)
  write(r, 'plugins/alpha/co.subbly.builder/scripts/package.json', '{ oops }')
}, { rule: 'scripts/package-parse' })

check('rejects an over-long connector name', (r) => baseline(r, {
  plugin: { $schema: SCHEMA, name: 'alpha', description: 'x', extensions: { 'co.subbly.builder': { displayName: 'Alpha', connectors: { ['c'.repeat(101)]: { auth: 'oauth' } } } } },
}), { rule: 'connector/name-length' })

// --- environment variable naming ------------------------------------------

check('keeps the slug/key boundary unambiguous across plugins', (r) => {
  write(r, 'marketplace.json', {
    slug: 'm', version: '1.0.0',
    plugins: [
      { slug: 'my-thing', source: { type: 'local', path: 'plugins/my-thing' } },
      { slug: 'my', source: { type: 'local', path: 'plugins/my' } },
    ],
  })
  write(r, 'plugins/my-thing/plugin.json', {
    $schema: SCHEMA, name: 'my-thing', description: 'x',
    extensions: { 'co.subbly.builder': { displayName: 'A', fields: [{ key: 'X', label: 'X', type: 'text' }] } },
  })
  write(r, 'plugins/my/plugin.json', {
    $schema: SCHEMA, name: 'my', description: 'x',
    extensions: { 'co.subbly.builder': { displayName: 'B', fields: [{ key: 'THING_X', label: 'X', type: 'text' }] } },
  })
}, { clean: true })

if (envVarName('my-thing', 'X') === envVarName('my', 'THING_X')) {
  failures.push('the double-underscore boundary must keep slug "my-thing" + key "X" distinct from slug "my" + key "THING_X"')
} else {
  passed++
}

check('allows the same field key in two different plugins', (r) => {
  write(r, 'marketplace.json', {
    slug: 'm', version: '1.0.0',
    plugins: [
      { slug: 'alpha', source: { type: 'local', path: 'plugins/alpha' } },
      { slug: 'beta', source: { type: 'local', path: 'plugins/beta' } },
    ],
  })
  for (const slug of ['alpha', 'beta']) {
    write(r, `plugins/${slug}/plugin.json`, {
      $schema: SCHEMA, name: slug, description: 'x',
      extensions: { 'co.subbly.builder': { displayName: slug, fields: [{ key: 'API_KEY', label: 'Key', type: 'text' }] } },
    })
  }
}, { clean: true })

check('warns about a field key that restates the PLUGIN_ prefix', (r) => baseline(r, {
  plugin: withFields([{ key: 'PLUGIN_ALPHA_TOKEN', label: 'Token', type: 'text' }]),
}), { warn: 'field/reserved-key' })

// --- report ----------------------------------------------------------------

const untested = Object.keys(RULES).filter((id) => !exercised.has(id))

console.log(`\n${passed} passed, ${failures.length} failed`)
for (const f of failures) console.log(`\n  FAIL  ${f}`)

console.log(`\n${exercised.size}/${Object.keys(RULES).length} rules have a fixture.`)
if (untested.length > 0) {
  console.log(`Untested rules:\n${untested.map((id) => `  ${id}`).join('\n')}`)
}

process.exit(failures.length > 0 ? 1 : 0)
