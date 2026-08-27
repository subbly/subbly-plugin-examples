// Findings, rule registry and output formats.

/** Every rule the linter can report, with the docs anchor explaining it. */
export const RULES = {
  // marketplace.json
  'marketplace/parse': 'marketplace.json must be valid JSON',
  'marketplace/root-type': 'the root must be an object',
  'marketplace/slug': 'slug must be a valid slug',
  'marketplace/version': 'version must be X.Y.Z with an optional lowercase pre-release suffix',
  'marketplace/plugins-type': 'plugins must be an array',
  'marketplace/plugins-empty': 'an empty plugins array archives every plugin',
  'marketplace/entry-slug': 'each entry needs a valid slug',
  'marketplace/slug-collision': 'entry slugs must be unique',
  'marketplace/published': 'published must be a boolean',
  'marketplace/source-type': 'source.type must be "local"',
  'marketplace/source-path': 'source.path must be made of safe segments',
  'marketplace/source-missing': 'source.path must exist on disk',
  'marketplace/path-convention': 'source.path should be plugins/<slug>',
  'marketplace/unlisted-directory': 'a plugin directory no entry points at never ships',
  'marketplace/unknown-key': 'unknown keys are silently stripped',
  'marketplace/version-bump': 'content changed without a version bump releases nothing',

  // plugin.json
  'manifest/parse': 'plugin.json must be valid JSON',
  'manifest/missing': 'every marketplace entry needs a plugin.json',
  'manifest/unknown-key': 'the manifest root is strict; unknown keys reject the release',
  'manifest/schema-url': '$schema must be the exact Agent Plugins 1.0.0 URL',
  'manifest/name-slug': 'name must be a valid slug and equal the marketplace entry slug',
  'manifest/description': 'description is required, 1-500 characters',
  'manifest/version-discarded': 'a manifest version is accepted and then ignored',
  'manifest/author': 'author is a strict object',
  'manifest/string-length': 'string fields have maximum lengths',
  'manifest/keywords': 'keywords is an array of at most 20 short strings',
  'manifest/namespace-required': 'extensions["co.subbly.builder"] is required',
  'manifest/namespace-unknown-key': 'the namespace is strict; unknown keys reject the release',
  'manifest/display-name': 'displayName is required, 1-100 characters',
  'manifest/image': 'image is 1-500 characters',
  'manifest/boolean': 'flags must be booleans',

  // config fields
  'field/key-format': 'field keys must match /^[A-Z][A-Z0-9_]*$/',
  'field/key-duplicate': 'a duplicate field key silently overrides the first',
  'field/label': 'label is required, 1-100 characters',
  'field/type': 'type must be "text" or "select"',
  'field/options': 'options belong to select fields and select fields require them',
  'field/public-secret': 'public and secret are mutually exclusive',
  'field/public-credential': 'a public field ships its value into the browser bundle',
  'field/pattern': 'pattern is at most 200 characters',
  'field/default-required': 'a default plugin cannot declare required fields',
  'field/reserved-key': 'a field key must not restate the PLUGIN_ prefix the builder adds',

  // automations
  'automation/key-slug': 'automation keys must be valid slugs',
  'automation/unknown-key': 'a declaration holds exactly name, schedule and model',
  'automation/name': 'name is required, 1-100 characters',
  'automation/schedule-syntax': 'schedule must be a cron expression the builder can parse',
  'automation/schedule-floor': 'schedule must fire at most every 15 minutes',
  'automation/schedule-unverified': 'this cron syntax cannot be checked offline',
  'automation/model': 'model must be normal or intelligent-high',
  'automation/missing-file': 'every declared automation needs its markdown file',
  'automation/orphan-file': 'every automation file needs a declaration',
  'automation/empty-file': 'an automation file must not be empty',
  'automation/frontmatter': 'automation frontmatter is not stripped and leaks into the instruction',
  'setup/missing-install-skill': 'setup: true requires a skills/install skill',

  // connectors and mcp.json
  'connector/auth': 'a connector marker is exactly { "auth": "oauth" }',
  'connector/name-length': 'connector names are 1-100 characters',
  'connector/undefined-server': 'a declared connector needs a matching mcp.json server',
  'connector/no-mcp': 'declaring a connector requires an mcp.json',
  'connector/manual-prefix': 'a server name that restates the <slug>__ prefix gets it doubled',
  'mcp/parse': 'mcp.json must be valid JSON',
  'mcp/unknown-key': 'mcp.json is strict',
  'mcp/schema-url': '$schema must be the exact MCP 1.0.0 URL',
  'mcp/servers-type': 'mcpServers must be an object',
  'mcp/server-name': 'server names must match /^[a-z][a-z0-9_-]{0,49}$/',
  'mcp/server-type': 'servers must be streamable-http',
  'mcp/https-only': 'server URLs must be https',
  'mcp/url': 'server URLs must parse and be at most 500 characters',
  'mcp/url-interpolation': '${...} in a URL is never expanded',
  'mcp/header-shape': 'header names and values have length limits',
  'mcp/undeclared-env': 'an interpolated ${KEY} must be a declared field or a builder default',
  'mcp/lowercase-interpolation': 'only uppercase ${KEY} is expanded',

  // skills
  'skill/missing-file': 'every directory under skills/ needs a SKILL.md',
  'skill/loose-file': 'a loose file under skills/ is never loaded',
  'skill/frontmatter': 'SKILL.md must open with a parseable frontmatter block',
  'skill/description': 'description is required, 1-500 characters',
  'skill/name-format': 'the resolved skill name must be a valid content name',
  'skill/name-mismatch': 'name is required and must equal the directory name',
  'skill/extra-frontmatter': 'unknown frontmatter is ignored but still costs context',
  'skill/empty-body': 'a skill with no body teaches nothing',

  // agents
  'agent/missing-file': 'every directory under agents/ needs an AGENT.md',
  'agent/loose-file': 'a loose file under agents/ is never loaded',
  'agent/name-format': 'the directory name is the agent name and must be a valid content name',
  'agent/frontmatter': 'agent markdown must open with a parseable frontmatter block',
  'agent/description': 'description is required, 1-500 characters',
  'agent/name-mismatch': 'name is required and must equal the directory name',
  'agent/disallowed-tools': 'tools must come from the grantable set',
  'agent/empty-body': 'the agent body is required',

  // layout, scripts, sandbox
  'layout/root-content': 'builder content at the plugin root is never loaded',
  'layout/symlink': 'symlinks bypass the release gate and fail at runtime',
  'layout/node-modules': 'committed node_modules ships into every sandbox',
  'scripts/lockfile-missing': 'declared dependencies need a committed pnpm-lock.yaml',
  'scripts/lockfile-absent': 'no lockfile makes the install step re-run on every sync',
  'scripts/package-parse': 'scripts/package.json must be valid JSON',
  'sandbox/path-absolute': 'plugin prose never hardcodes a sandbox path; name scripts as scripts/<file>',
  'sandbox/script-missing': 'a scripts/<file> reference must match a shipped script',
}

export class Report {
  constructor() {
    this.findings = []
  }

  add(level, ruleId, file, message, { line = 1, col = 1, hint } = {}) {
    if (!RULES[ruleId]) throw new Error(`unregistered rule id: ${ruleId}`)
    this.findings.push({ level, ruleId, file, message, line, col, hint })
  }

  error(ruleId, file, message, opts) {
    this.add('error', ruleId, file, message, opts)
  }

  warn(ruleId, file, message, opts) {
    this.add('warn', ruleId, file, message, opts)
  }

  get errors() {
    return this.findings.filter((f) => f.level === 'error')
  }

  get warnings() {
    return this.findings.filter((f) => f.level === 'warn')
  }
}

// --- formatters ------------------------------------------------------------

function sorted(findings) {
  return [...findings].sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col
  )
}

function group(findings) {
  const byFile = new Map()
  for (const f of sorted(findings)) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  return byFile
}

export const FORMATTERS = {
  /** Human default: grouped by file, aligned, rule id on every line. */
  stylish(report) {
    const lines = []
    for (const [file, list] of group(report.findings)) {
      lines.push('', file)
      const width = Math.max(...list.map((f) => `${f.line}:${f.col}`.length))
      for (const f of list) {
        const at = `${f.line}:${f.col}`.padEnd(width)
        lines.push(`  ${at}  ${f.level === 'error' ? 'error' : 'warn '}  ${f.message}  ${f.ruleId}`)
        if (f.hint) lines.push(`  ${' '.repeat(width)}         ${f.hint}`)
      }
    }
    const { length: errors } = report.errors
    const { length: warnings } = report.warnings
    lines.push('')
    lines.push(
      report.findings.length === 0
        ? 'Clean: the marketplace passes the release gate.'
        : `${errors} error(s), ${warnings} warning(s).`
    )
    if (errors > 0) {
      lines.push('Errors fail the refresh, which blocks the release of EVERY plugin in this marketplace.')
    }
    return lines.join('\n')
  },

  /**
   * file:line:col: severity: message [rule]
   *
   * What the VS Code problem matcher reads. "warning" rather than "warn"
   * because that is the severity word the matcher understands.
   */
  unix(report) {
    return sorted(report.findings)
      .map((f) => `${f.file}:${f.line}:${f.col}: ${f.level === 'error' ? 'error' : 'warning'}: ${f.message} [${f.ruleId}]`)
      .join('\n')
  },

  json(report) {
    return JSON.stringify(
      { ok: report.errors.length === 0, errors: report.errors, warnings: report.warnings },
      null,
      2
    )
  },

  /** GitHub Actions annotations, so CI marks the exact line in the diff. */
  github(report) {
    return sorted(report.findings)
      .map((f) => {
        const kind = f.level === 'error' ? 'error' : 'warning'
        return `::${kind} file=${f.file},line=${f.line},col=${f.col},title=${f.ruleId}::${f.message}`
      })
      .join('\n')
  },
}
