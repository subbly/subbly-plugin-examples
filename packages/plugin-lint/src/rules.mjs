// The rules themselves.
//
// Mirrors subbly-builder branch feat/plugins-mcp:
//   packages/plugins/src/marketplace/{marketplace-manifest,plugin-manifest,mcp-config}.ts
//   packages/core/src/types/plugin-manifest.ts
//   packages/core/src/lib/automations/schedule.ts
//
// error = the refresh throws, so NO plugin in the marketplace releases.
// warn  = the builder accepts it, but it is wrong, dead, or broken at runtime.

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs'
import { join, basename, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

import { Report } from './report.mjs'
import { parseJsonSource, locator } from './json-source.mjs'
import { readFrontmatter, lineOf, colOf } from './frontmatter.mjs'
import { parseCron, meetsFloor, CronUnsupported, SCHEDULE_FLOOR_MINUTES } from './cron.mjs'

// --- constants lifted verbatim from the builder -----------------------------

export const PLUGIN_SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
export const MCP_SCHEMA_URL = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
export const NAMESPACE = 'co.subbly.builder'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SLUG_MESSAGE =
  'must be 1-64 lowercase alphanumerics with single - separators, starting and ending alphanumeric'
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[a-z0-9]+(\.[a-z0-9]+)*)?$/
const FIELD_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/
const CONNECTOR_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,49}$/
// The /i matters: skill and agent names allow uppercase and _, but never a dot.
const CONTENT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

const MANIFEST_KEYS = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions']
const NAMESPACE_KEYS = ['displayName', 'image', 'default', 'fields', 'automations', 'setup', 'connectors']
const FIELD_KEYS = ['key', 'label', 'type', 'required', 'secret', 'public', 'pattern', 'options']
const AUTOMATION_KEYS = ['name', 'schedule', 'model']
const AUTOMATION_MODELS = ['normal', 'intelligent-high']
const SERVER_KEYS = ['type', 'url', 'headers']

export const AGENT_TOOLS = ['read_file', 'write_file', 'edit_file', 'execute_command', 'get_stock_image', 'scrape_webpage', 'generate_image', 'restart_preview', 'apply_to_preview', 'mcp_run_tool', 'skill']
export const DEFAULT_ENV_KEYS = [
  'SUBBLY_API_KEY',
  'NEXT_PUBLIC_SUBBLY_API_KEY',
  'NEXT_PUBLIC_SHOP_NAME',
  'NEXT_PUBLIC_SHOP_CURRENCY',
  'NEXT_PUBLIC_SUPPORT_EMAIL',
  'NEXT_PUBLIC_SUPPORT_URL',
  'NEXT_PUBLIC_TERMS_CONDITIONS_URL',
]

const MISPLACED = ['agents', 'automations', 'scripts', 'instructions.md']

// The builder-maintained symlink to the installed version, the only stable
// segment prose may use in a sandbox path.
export const CURRENT_LINK = 'current'

// --- helpers ---------------------------------------------------------------

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

/**
 * The literal environment variable a config field becomes.
 * `PLUGIN_<SLUG>__<KEY>`, with NEXT_PUBLIC_ prepended to the whole name.
 * The slug/key boundary is a double underscore, which a slug can never hold.
 */
export function envVarName(slug, key, isPublic = false) {
  const name = `PLUGIN_${slug.replace(/-/g, '_').toUpperCase()}__${key}`
  return isPublic ? `NEXT_PUBLIC_${name}` : name
}

function readIfExists(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
  } catch {
    return []
  }
}

/** Reads a JSON file and returns its value plus a position locator. */
function readJson(path, file, report, ruleId, label) {
  const raw = readIfExists(path)
  if (raw === null) return { missing: true }

  const parsed = parseJsonSource(raw)
  if (!parsed.ok) {
    report.error(ruleId, file, `Invalid JSON in ${label}: ${parsed.message}`, {
      line: parsed.line,
      col: parsed.col,
      hint: 'no comments, no trailing commas, no JSON5',
    })
    return { invalid: true }
  }
  return { value: parsed.value, at: locator(parsed.root), raw }
}

/** A checker bound to one file, so rules read as assertions about a path. */
function checker(report, file, at) {
  return {
    string(ruleId, path, value, { min = 0, max = Infinity, trim = false, required = false, label = path } = {}) {
      const pos = at(path)
      if (value === undefined) {
        if (required) report.error(ruleId, file, `${label} is required`, at(path === '' ? '' : path.split('.').slice(0, -1).join('.')))
        return false
      }
      if (typeof value !== 'string') {
        report.error(ruleId, file, `${label}: expected string, received ${typeOf(value)}`, pos)
        return false
      }
      const measured = trim ? value.trim() : value
      if (measured.length < min) {
        report.error(ruleId, file, `${label}: too small, expected >=${min} characters`, pos)
        return false
      }
      if (measured.length > max) {
        report.error(ruleId, file, `${label}: too big, expected <=${max} characters (has ${measured.length})`, pos)
        return false
      }
      return true
    },

    boolean(ruleId, path, value) {
      if (value === undefined) return true
      if (typeof value !== 'boolean') {
        report.error(ruleId, file, `${path}: expected boolean, received ${typeOf(value)}`, at(path))
        return false
      }
      return true
    },

    /** Keys a strictObject would reject outright. */
    strictKeys(ruleId, path, obj, allowed, label = path) {
      for (const key of Object.keys(obj).filter((k) => !allowed.includes(k))) {
        report.error(ruleId, file, `${label}: unrecognized key "${key}"`, {
          ...at(path ? `${path}.${key}` : key, { key: true }),
          hint: `allowed: ${allowed.join(', ')}`,
        })
      }
    },

    /** Keys a plain z.object silently strips: accepted, but dead. */
    looseKeys(ruleId, path, obj, allowed, label = path) {
      for (const key of Object.keys(obj).filter((k) => !allowed.includes(k))) {
        report.warn(ruleId, file, `${label}: unknown key "${key}" is silently stripped and does nothing`, {
          ...at(path ? `${path}.${key}` : key, { key: true }),
          hint: `allowed: ${allowed.join(', ')}`,
        })
      }
    },
  }
}

// --- marketplace.json ------------------------------------------------------

function lintMarketplaceManifest(root, report) {
  const file = 'marketplace.json'
  const path = join(root, file)
  const doc = readJson(path, file, report, 'marketplace/parse', 'marketplace.json')

  if (doc.missing) {
    report.error('marketplace/parse', file, 'marketplace.json is missing from the repository root')
    return null
  }
  if (doc.invalid) return null

  const { value: data, at } = doc
  const check = checker(report, file, at)

  if (!isObject(data)) {
    report.error('marketplace/root-type', file, `expected object, received ${typeOf(data)}`, at(''))
    return null
  }

  check.looseKeys('marketplace/unknown-key', '', data, ['slug', 'version', 'plugins', '$schema'], '(root)')

  if (check.string('marketplace/slug', 'slug', data.slug, { min: 1, max: 64, required: true })) {
    if (!SLUG_PATTERN.test(data.slug)) report.error('marketplace/slug', file, `slug: ${SLUG_MESSAGE}`, at('slug'))
  }

  if (check.string('marketplace/version', 'version', data.version, { max: 50, required: true })) {
    if (!VERSION_PATTERN.test(data.version)) {
      report.error(
        'marketplace/version',
        file,
        'version must be X.Y.Z with an optional lowercase pre-release suffix like -beta or -beta.1',
        at('version')
      )
    }
  }

  if (data.plugins === undefined) {
    report.error('marketplace/plugins-type', file, 'plugins is required', at(''))
    return null
  }
  if (!Array.isArray(data.plugins)) {
    report.error('marketplace/plugins-type', file, `plugins: expected array, received ${typeOf(data.plugins)}`, at('plugins'))
    return null
  }
  if (data.plugins.length === 0) {
    report.warn('marketplace/plugins-empty', file, 'plugins is empty, which archives every plugin in this marketplace on release', at('plugins'))
  }

  const entries = []
  const seen = new Set()

  data.plugins.forEach((entry, i) => {
    const base = `plugins[${i}]`
    if (!isObject(entry)) {
      report.error('marketplace/entry-slug', file, `${base}: expected object, received ${typeOf(entry)}`, at(base))
      return
    }
    check.looseKeys('marketplace/unknown-key', base, entry, ['slug', 'published', 'source'])

    let slug = null
    if (check.string('marketplace/entry-slug', `${base}.slug`, entry.slug, { min: 1, max: 64, required: true })) {
      if (SLUG_PATTERN.test(entry.slug)) slug = entry.slug
      else report.error('marketplace/entry-slug', file, `${base}.slug: ${SLUG_MESSAGE}`, at(`${base}.slug`))
    }

    if (slug) {
      if (seen.has(slug)) {
        report.error('marketplace/slug-collision', file, 'plugin slugs must be unique', at(`${base}.slug`))
      } else {
        seen.add(slug)
      }
    }

    check.boolean('marketplace/published', `${base}.published`, entry.published)

    if (!isObject(entry.source)) {
      report.error('marketplace/source-type', file, `${base}.source: expected object, received ${typeOf(entry.source)}`, at(base))
      return
    }
    check.looseKeys('marketplace/unknown-key', `${base}.source`, entry.source, ['type', 'path'])

    if (entry.source.type !== 'local') {
      report.error(
        'marketplace/source-type',
        file,
        `${base}.source.type: expected "local", received ${JSON.stringify(entry.source.type)}`,
        at(`${base}.source.type`)
      )
    }

    let sourcePath = null
    if (check.string('marketplace/source-path', `${base}.source.path`, entry.source.path, { min: 1, max: 200, required: true })) {
      if (!entry.source.path.split('/').every((s) => SAFE_SEGMENT.test(s))) {
        report.error('marketplace/source-path', file, `${base}.source.path: path must be made of safe segments`, {
          ...at(`${base}.source.path`),
          hint: 'no leading /, no .., no empty or dot-leading segment',
        })
      } else {
        sourcePath = entry.source.path
      }
    }

    if (slug && sourcePath) {
      if (basename(sourcePath) !== slug) {
        report.warn(
          'marketplace/path-convention',
          file,
          `${base}.source.path basename "${basename(sourcePath)}" does not match slug "${slug}"`,
          { ...at(`${base}.source.path`), hint: 'house convention is plugins/<slug>' }
        )
      }
      entries.push({ slug, sourcePath, dir: join(root, sourcePath), at: at(`${base}.source.path`) })
    }
  })

  for (const entry of entries) {
    if (!existsSync(entry.dir)) {
      report.error('marketplace/source-missing', file, `source.path "${entry.sourcePath}" does not exist on disk`, entry.at)
    }
  }

  const listed = new Set(entries.map((e) => e.sourcePath))
  for (const dirent of listDir(join(root, 'plugins'))) {
    if (!dirent.isDirectory()) continue
    const candidate = `plugins/${dirent.name}`
    if (!listed.has(candidate)) {
      report.warn('marketplace/unlisted-directory', file, `directory ${candidate} is not listed in marketplace.json, so it never ships`, at('plugins'))
    }
  }

  return { version: data.version, entries }
}

// --- plugin.json -----------------------------------------------------------

function lintPluginManifest(root, entry, report) {
  const path = join(entry.dir, 'plugin.json')
  const file = relative(root, path)
  const doc = readJson(path, file, report, 'manifest/parse', `plugin.json of ${entry.slug}`)

  if (doc.missing) {
    report.error('manifest/missing', file, `plugin.json of ${entry.slug} is missing`, {
      hint: 'every marketplace entry needs one at <source.path>/plugin.json',
    })
    return null
  }
  if (doc.invalid) return null

  const { value: data, at } = doc
  const check = checker(report, file, at)

  if (!isObject(data)) {
    report.error('manifest/parse', file, `expected object, received ${typeOf(data)}`, at(''))
    return null
  }

  check.strictKeys('manifest/unknown-key', '', data, MANIFEST_KEYS, '(root)')

  if (data.$schema !== PLUGIN_SCHEMA_URL) {
    report.error('manifest/schema-url', file, `$schema: expected ${JSON.stringify(PLUGIN_SCHEMA_URL)}`, at('$schema'))
  }

  if (check.string('manifest/name-slug', 'name', data.name, { min: 1, max: 64, required: true })) {
    if (!SLUG_PATTERN.test(data.name)) {
      report.error('manifest/name-slug', file, `name: ${SLUG_MESSAGE}`, at('name'))
    } else if (data.name !== entry.slug) {
      report.error(
        'manifest/name-slug',
        file,
        `name ${JSON.stringify(data.name)} must equal the marketplace entry slug ${JSON.stringify(entry.slug)}`,
        at('name')
      )
    }
  }

  if (data.version !== undefined) {
    report.warn('manifest/version-discarded', file, 'version is accepted and then discarded; marketplace.json version is the only release trigger', {
      ...at('version', { key: true }),
      hint: 'remove it',
    })
  }

  if (data.description === undefined) {
    report.error('manifest/description', file, 'description is required', at(''))
  } else {
    check.string('manifest/description', 'description', data.description, { min: 1, max: 500, trim: true })
  }

  if (data.author !== undefined) {
    if (!isObject(data.author)) {
      report.error('manifest/author', file, `author: expected object, received ${typeOf(data.author)}`, at('author'))
    } else {
      check.strictKeys('manifest/author', 'author', data.author, ['name', 'email', 'url'])
      check.string('manifest/author', 'author.name', data.author.name, { min: 1, max: 100, trim: true, required: true })
      check.string('manifest/author', 'author.email', data.author.email, { max: 200, trim: true })
      check.string('manifest/author', 'author.url', data.author.url, { max: 500, trim: true })
    }
  }

  check.string('manifest/string-length', 'homepage', data.homepage, { max: 500, trim: true })
  check.string('manifest/string-length', 'repository', data.repository, { max: 500, trim: true })
  check.string('manifest/string-length', 'license', data.license, { max: 100, trim: true })

  if (data.keywords !== undefined) {
    if (!Array.isArray(data.keywords)) {
      report.error('manifest/keywords', file, `keywords: expected array, received ${typeOf(data.keywords)}`, at('keywords'))
    } else {
      if (data.keywords.length > 20) {
        report.error('manifest/keywords', file, `keywords: too big, expected <=20 items (has ${data.keywords.length})`, at('keywords'))
      }
      data.keywords.forEach((k, i) => check.string('manifest/keywords', `keywords[${i}]`, k, { min: 1, max: 50, trim: true }))
    }
  }

  if (data.extensions !== undefined && !isObject(data.extensions)) {
    report.error('manifest/namespace-required', file, `extensions: expected object, received ${typeOf(data.extensions)}`, at('extensions'))
    return null
  }

  const ext = data.extensions?.[NAMESPACE]
  if (ext === undefined) {
    report.error('manifest/namespace-required', file, `extensions["${NAMESPACE}"] is required`, at('extensions'))
    return null
  }
  const ns = `extensions.${NAMESPACE}`
  if (!isObject(ext)) {
    report.error('manifest/namespace-required', file, `extensions["${NAMESPACE}"]: expected object, received ${typeOf(ext)}`, at(ns))
    return null
  }

  check.strictKeys('manifest/namespace-unknown-key', ns, ext, NAMESPACE_KEYS, `extensions["${NAMESPACE}"]`)
  check.string('manifest/display-name', `${ns}.displayName`, ext.displayName, {
    min: 1, max: 100, trim: true, required: true, label: 'displayName',
  })
  check.string('manifest/image', `${ns}.image`, ext.image, { min: 1, max: 500, label: 'image' })
  check.boolean('manifest/boolean', `${ns}.default`, ext.default)
  check.boolean('manifest/boolean', `${ns}.setup`, ext.setup)

  const fields = lintFields(report, file, at, check, ns, ext, entry.slug)
  const automations = lintAutomationDeclarations(report, file, at, check, ns, ext)
  const connectors = lintConnectors(report, file, at, check, ns, ext)

  if (ext.default === true && fields.some((f) => f.required === true)) {
    report.error(
      'field/default-required',
      file,
      'a default plugin cannot declare required config fields, no user is present to fill them',
      at(`${ns}.default`)
    )
  }

  return { fieldKeys: fields.map((f) => f.key).filter(Boolean), automations, connectors, setup: ext.setup === true }
}

function lintFields(report, file, at, check, ns, ext, slug) {
  if (ext.fields === undefined) return []
  if (!Array.isArray(ext.fields)) {
    report.error('field/type', file, `${ns}.fields: expected array, received ${typeOf(ext.fields)}`, at(`${ns}.fields`))
    return []
  }

  const seen = new Map()
  ext.fields.forEach((field, i) => {
    const p = `${ns}.fields[${i}]`
    const label = `fields[${i}]`
    if (!isObject(field)) {
      report.error('field/type', file, `${label}: expected object, received ${typeOf(field)}`, at(p))
      return
    }
    check.looseKeys('manifest/namespace-unknown-key', p, field, FIELD_KEYS, label)

    if (check.string('field/key-format', `${p}.key`, field.key, { max: 50, required: true, label: `${label}.key` })) {
      if (!FIELD_KEY_PATTERN.test(field.key)) {
        report.error('field/key-format', file, `${label}.key "${field.key}" must match /^[A-Z][A-Z0-9_]*$/`, {
          ...at(`${p}.key`),
          hint: 'uppercase, digits and underscores only, starting with a letter',
        })
      } else if (seen.has(field.key)) {
        report.warn('field/key-duplicate', file, `${label}.key "${field.key}" duplicates fields[${seen.get(field.key)}]`, {
          ...at(`${p}.key`),
          hint: 'both map to one env var, so the later declaration is silently ignored',
        })
      } else {
        seen.set(field.key, i)
      }
    }

    check.string('field/label', `${p}.label`, field.label, { min: 1, max: 100, required: true, label: `${label}.label` })

    if (field.type !== 'text' && field.type !== 'select') {
      report.error('field/type', file, `${label}.type: expected "text" or "select", received ${JSON.stringify(field.type)}`, at(`${p}.type`))
    }
    check.boolean('manifest/boolean', `${p}.required`, field.required)
    check.boolean('manifest/boolean', `${p}.secret`, field.secret)
    check.boolean('manifest/boolean', `${p}.public`, field.public)
    check.string('field/pattern', `${p}.pattern`, field.pattern, { max: 200, label: `${label}.pattern` })

    if (field.options !== undefined) {
      if (!Array.isArray(field.options)) {
        report.error('field/options', file, `${label}.options: expected array, received ${typeOf(field.options)}`, at(`${p}.options`))
      } else {
        field.options.forEach((o, j) =>
          check.string('field/options', `${p}.options[${j}]`, o, { min: 1, max: 100, label: `${label}.options[${j}]` })
        )
      }
    }

    if (field.public && field.secret) {
      report.error('field/public-secret', file, `${label}: public and secret are mutually exclusive`, at(`${p}.public`))
    }
    if (field.options !== undefined && field.type !== 'select') {
      report.error('field/options', file, `${label}: options are only allowed on select fields`, at(`${p}.options`))
    }
    if (field.type === 'select' && (field.options === undefined || field.options.length === 0)) {
      report.error('field/options', file, `${label}: select fields require options`, at(`${p}.type`))
    }
    if (field.public && field.secret !== true && /KEY|TOKEN|SECRET|PASSWORD/.test(field.key ?? '')) {
      report.warn('field/public-credential', file, `${label}.key "${field.key}" is public, so its value ships into the browser bundle`, {
        ...at(`${p}.public`),
        hint: 'never mark a credential public',
      })
    }

    // The builder already prepends PLUGIN_<SLUG>_, so a key that repeats it
    // produces PLUGIN_ACME_PLUGIN_ACME_TOKEN.
    if (typeof field.key === 'string' && /^(NEXT_PUBLIC_)?PLUGIN_/.test(field.key)) {
      report.warn('field/reserved-key', file, `${label}.key "${field.key}" restates a prefix the builder adds itself`, {
        ...at(`${p}.key`),
        hint: `it becomes ${envVarName(slug, field.key, field.public === true)}`,
      })
    }

  })

  return ext.fields.filter(isObject)
}

function lintAutomationDeclarations(report, file, at, check, ns, ext) {
  if (ext.automations === undefined) return []
  if (!isObject(ext.automations)) {
    report.error('automation/key-slug', file, `${ns}.automations: expected object keyed by slug, received ${typeOf(ext.automations)}`, at(`${ns}.automations`))
    return []
  }

  const slugs = []
  for (const [slug, decl] of Object.entries(ext.automations)) {
    const p = `${ns}.automations.${slug}`
    const label = `automations["${slug}"]`

    if (slug.length < 1 || slug.length > 64 || !SLUG_PATTERN.test(slug)) {
      report.error('automation/key-slug', file, `${label}: key ${SLUG_MESSAGE}`, at(p, { key: true }))
      continue
    }
    if (!isObject(decl)) {
      report.error('automation/unknown-key', file, `${label}: expected object, received ${typeOf(decl)}`, at(p))
      continue
    }

    check.strictKeys('automation/unknown-key', p, decl, AUTOMATION_KEYS, label)
    check.string('automation/name', `${p}.name`, decl.name, { min: 1, max: 100, trim: true, required: true, label: `${label}.name` })

    if (check.string('automation/schedule-syntax', `${p}.schedule`, decl.schedule, { min: 1, max: 100, required: true, label: `${label}.schedule` })) {
      lintSchedule(report, file, at(`${p}.schedule`), label, decl.schedule)
    }

    if (!AUTOMATION_MODELS.includes(decl.model)) {
      report.error(
        'automation/model',
        file,
        `${label}.model: expected ${AUTOMATION_MODELS.join(' | ')}, received ${JSON.stringify(decl.model)}`,
        at(`${p}.model`)
      )
    }
    slugs.push(slug)
  }
  return slugs
}

function lintSchedule(report, file, pos, label, schedule) {
  let cron
  try {
    cron = parseCron(schedule)
  } catch (e) {
    if (e instanceof CronUnsupported) {
      report.warn('automation/schedule-unverified', file, `${label}.schedule contains "${e.message}", which cannot be checked offline`, {
        ...pos,
        hint: 'the builder may accept it; confirm the 15-minute floor by hand',
      })
      return
    }
    report.error('automation/schedule-syntax', file, `${label}.schedule: invalid cron expression (${e.message})`, pos)
    return
  }
  if (!meetsFloor(cron)) {
    report.error('automation/schedule-floor', file, `${label}.schedule must fire at most every ${SCHEDULE_FLOOR_MINUTES} minutes`, pos)
  }
}

function lintConnectors(report, file, at, check, ns, ext) {
  if (ext.connectors === undefined) return []
  if (!isObject(ext.connectors)) {
    report.error('connector/auth', file, `${ns}.connectors: expected object, received ${typeOf(ext.connectors)}`, at(`${ns}.connectors`))
    return []
  }

  const names = []
  for (const [name, marker] of Object.entries(ext.connectors)) {
    const p = `${ns}.connectors.${name}`
    const label = `connectors["${name}"]`

    if (name.length < 1 || name.length > 100) {
      report.error('connector/name-length', file, `${label}: connector name must be 1-100 characters`, at(p, { key: true }))
    }
    if (!isObject(marker)) {
      report.error('connector/auth', file, `${label}: expected object, received ${typeOf(marker)}`, at(p))
      continue
    }
    check.strictKeys('connector/auth', p, marker, ['auth'], label)
    if (marker.auth !== 'oauth') {
      report.error('connector/auth', file, `${label}.auth: expected "oauth", received ${JSON.stringify(marker.auth)}`, at(`${p}.auth`))
    }
    names.push(name)
  }
  return names
}

// --- mcp.json --------------------------------------------------------------

function lintMcp(root, entry, manifest, report) {
  const path = join(entry.dir, 'mcp.json')
  const file = relative(root, path)
  const connectors = manifest?.connectors ?? []
  const doc = readJson(path, file, report, 'mcp/parse', `mcp.json of ${entry.slug}`)

  if (doc.missing) {
    if (connectors.length > 0) {
      report.error(
        'connector/no-mcp',
        relative(root, join(entry.dir, 'plugin.json')),
        `plugin.json declares connector ${connectors[0]}, but the plugin has no mcp.json`
      )
    }
    return
  }
  if (doc.invalid) return

  const { value: data, at } = doc
  const check = checker(report, file, at)

  if (!isObject(data)) {
    report.error('mcp/parse', file, `expected object, received ${typeOf(data)}`, at(''))
    return
  }

  check.strictKeys('mcp/unknown-key', '', data, ['$schema', 'mcpServers'], '(root)')
  if (data.$schema !== MCP_SCHEMA_URL) {
    report.error('mcp/schema-url', file, `$schema: expected ${JSON.stringify(MCP_SCHEMA_URL)}`, at('$schema'))
  }
  if (!isObject(data.mcpServers)) {
    report.error('mcp/servers-type', file, `mcpServers: expected object, received ${typeOf(data.mcpServers)}`, at('mcpServers'))
    return
  }

  const declaredKeys = new Set([...(manifest?.fieldKeys ?? []), ...DEFAULT_ENV_KEYS])
  const serverNames = new Set()

  for (const [name, server] of Object.entries(data.mcpServers)) {
    const p = `mcpServers.${name}`
    const label = `mcpServers["${name}"]`
    serverNames.add(name)

    // The builder already addresses connectors as <slug>__<name>, so a name
    // that restates the prefix produces alpha__alpha__api.
    const prefix = `${entry.slug.replace(/-/g, '_')}__`
    if (name.startsWith(prefix)) {
      report.warn('connector/manual-prefix', file, `server name "${name}" restates the prefix the builder adds itself`, {
        ...at(p, { key: true }),
        hint: `the builder namespaces it to ${prefix}${name}; drop the prefix`,
      })
    }

    if (!CONNECTOR_NAME_PATTERN.test(name)) {
      report.error('mcp/server-name', file, `${label}: name must match /^[a-z][a-z0-9_-]{0,49}$/`, {
        ...at(p, { key: true }),
        hint: 'lowercase, no dots, starting with a letter',
      })
    }
    if (!isObject(server)) {
      report.error('mcp/server-type', file, `${label}: expected object, received ${typeOf(server)}`, at(p))
      continue
    }
    check.strictKeys('mcp/unknown-key', p, server, SERVER_KEYS, label)

    if (server.type !== 'streamable-http') {
      report.error('mcp/server-type', file, `${label}.type: expected "streamable-http", received ${JSON.stringify(server.type)}`, {
        ...at(`${p}.type`),
        hint: 'stdio and command-based servers cannot ship',
      })
    }

    if (check.string('mcp/url', `${p}.url`, server.url, { min: 1, max: 500, required: true, label: `${label}.url` })) {
      try {
        new URL(server.url)
      } catch {
        report.error('mcp/url', file, `${label}.url is not a valid URL`, at(`${p}.url`))
      }
      if (!server.url.startsWith('https://')) {
        report.error('mcp/https-only', file, `${label}.url must be an https url`, at(`${p}.url`))
      }
      if (/\$\{[^}]+\}/.test(server.url)) {
        report.warn('mcp/url-interpolation', file, `${label}.url contains \${...}, which is never expanded and is sent literally`, at(`${p}.url`))
      }
    }

    if (server.headers !== undefined) {
      if (!isObject(server.headers)) {
        report.error('mcp/header-shape', file, `${label}.headers: expected object, received ${typeOf(server.headers)}`, at(`${p}.headers`))
        continue
      }
      for (const [header, value] of Object.entries(server.headers)) {
        const hp = `${p}.headers.${header}`
        const hlabel = `${label}.headers["${header}"]`
        if (header.length < 1 || header.length > 100) {
          report.error('mcp/header-shape', file, `${hlabel}: header name must be 1-100 characters`, at(hp, { key: true }))
        }
        if (!check.string('mcp/header-shape', hp, value, { min: 1, max: 1000, label: hlabel })) continue

        for (const match of value.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) {
          if (!declaredKeys.has(match[1])) {
            report.error('mcp/undeclared-env', file, `server ${name} references config field ${match[1]}, which plugin.json does not declare`, {
              ...at(hp),
              hint: `declare it under extensions["${NAMESPACE}"].fields, or use a builder default: ${DEFAULT_ENV_KEYS.join(', ')}`,
            })
          }
        }
        for (const match of value.matchAll(/\$\{([^}]*)\}/g)) {
          if (!/^[A-Z][A-Z0-9_]*$/.test(match[1])) {
            report.warn('mcp/lowercase-interpolation', file, `${hlabel}: \${${match[1]}} is not uppercase, so it is never expanded and is sent literally`, at(hp))
          }
        }
      }
    }
  }

  for (const connector of connectors) {
    if (!serverNames.has(connector)) {
      report.error('connector/undefined-server', file, `plugin.json declares connector ${connector}, which mcp.json does not define`, at('mcpServers'))
    }
  }
}

// --- skills ----------------------------------------------------------------

function lintSkills(root, entry, report) {
  const skillsDir = join(entry.dir, 'skills')
  if (!existsSync(skillsDir)) return


  for (const dirent of listDir(skillsDir)) {
    if (!dirent.isDirectory()) {
      if (dirent.name.endsWith('.md')) {
        report.warn('skill/loose-file', relative(root, join(skillsDir, dirent.name)), 'a loose file directly under skills/ is never loaded', {
          hint: 'move it into skills/<name>/',
        })
      }
      continue
    }

    const dir = join(skillsDir, dirent.name)
    const skillPath = join(dir, 'SKILL.md')
    const file = relative(root, skillPath)

    if (!existsSync(skillPath)) {
      report.error('skill/missing-file', relative(root, dir), `Invalid skills of ${entry.slug}: skill ${dirent.name} is missing SKILL.md`, {
        hint: 'every directory under skills/ needs one, case-sensitive',
      })
      continue
    }

    const text = readIfExists(skillPath) ?? ''
    const fm = readFrontmatter(text)

    if (fm.duplicate) {
      report.error('skill/frontmatter', file, `frontmatter is unparseable: duplicated mapping key "${fm.duplicate}"`, { line: fm.duplicateLine })
      continue
    }
    if (fm.unsupported) {
      report.error('skill/frontmatter', file, `frontmatter line cannot be validated: "${fm.unsupported}"`, {
        line: fm.unsupportedLine,
        hint: 'keep frontmatter to flat key: value pairs and simple lists',
      })
      continue
    }
    if (fm.unterminated) {
      report.error('skill/frontmatter', file, 'the frontmatter block is never closed', { line: 1, hint: 'close it with --- on its own line' })
      continue
    }
    if (!fm.fenced) {
      report.error('skill/frontmatter', file, 'no frontmatter found, so description is missing', {
        line: 1,
        hint: 'line 1 must be exactly --- with no blank line or indentation before it',
      })
      continue
    }

    const attrs = fm.attributes
    const descLine = fm.keyLines.description ?? 1

    if (attrs.description === undefined || attrs.description === null) {
      report.error('skill/description', file, `Invalid skill ${dirent.name}: description is required`, { line: 1 })
    } else if (typeof attrs.description !== 'string') {
      report.error('skill/description', file, 'description must be a string', { line: descLine })
    } else if (attrs.description.length < 1 || attrs.description.length > 500) {
      report.error('skill/description', file, `description must be 1-500 characters (has ${attrs.description.length})`, { line: descLine })
    }

    const name = dirent.name
    const nameLine = fm.keyLines.name ?? 1

    if (name.length > 50) {
      report.error('skill/name-format', file, `skill name is too long, expected <=50 characters`, { line: nameLine })
    }
    if (!CONTENT_NAME_PATTERN.test(name)) {
      report.error('skill/name-format', file, `invalid skill name ${JSON.stringify(name)}`, {
        line: nameLine,
        hint: 'letters, digits, - and _ only; no dots, no spaces, no colons',
      })
    }

    if (attrs.name === undefined) {
      report.error('skill/name-mismatch', file, 'name is required and must equal the directory name', {
        line: 1,
        hint: `add "name: ${dirent.name}"`,
      })
    } else if (attrs.name !== dirent.name) {
      report.error('skill/name-mismatch', file, `name ${JSON.stringify(attrs.name)} must equal the directory name ${JSON.stringify(dirent.name)}`, {
        line: nameLine,
        hint: 'the directory is the skill name',
      })
    }
    for (const [key, line] of Object.entries(fm.keyLines)) {
      if (key !== 'name' && key !== 'description') {
        report.warn('skill/extra-frontmatter', file, `frontmatter key "${key}" is ignored by the builder but still shipped to the model on every use`, { line })
      }
    }
    if (fm.body.trim() === '') {
      report.warn('skill/empty-body', file, 'the skill body is empty, so the skill teaches the model nothing', { line: fm.bodyLine })
    }
  }
}

// --- agents ----------------------------------------------------------------

function lintAgents(root, entry, report) {
  const agentsDir = join(entry.dir, NAMESPACE, 'agents')
  if (!existsSync(agentsDir)) return

  for (const dirent of listDir(agentsDir)) {
    if (!dirent.isDirectory()) {
      if (dirent.name.endsWith('.md')) {
        report.warn('agent/loose-file', relative(root, join(agentsDir, dirent.name)), 'a loose file directly under agents/ is never loaded', {
          hint: 'move it into agents/<name>/AGENT.md',
        })
      }
      continue
    }

    const dir = join(agentsDir, dirent.name)
    const path = join(dir, 'AGENT.md')
    const file = relative(root, path)

    if (!existsSync(path)) {
      report.error('agent/missing-file', relative(root, dir), `Invalid agents of ${entry.slug}: agent ${dirent.name} is missing AGENT.md`, {
        hint: 'every directory under agents/ needs one, case-sensitive',
      })
      continue
    }

    const name = dirent.name
    if (name.length > 50) {
      report.error('agent/name-format', file, 'the agent directory name is too long, expected <=50 characters', { line: 1 })
    }
    if (!CONTENT_NAME_PATTERN.test(name)) {
      report.error('agent/name-format', file, `Invalid agent ${name}: invalid agent name`, {
        line: 1,
        hint: 'the directory is the agent name: letters, digits, - and _ only, no dots',
      })
    }

    const text = readIfExists(path) ?? ''
    const fm = readFrontmatter(text)

    if (fm.duplicate) {
      report.error('agent/frontmatter', file, `frontmatter is unparseable: duplicated mapping key "${fm.duplicate}"`, { line: fm.duplicateLine })
      continue
    }
    if (fm.unsupported) {
      report.error('agent/frontmatter', file, `frontmatter line cannot be validated: "${fm.unsupported}"`, {
        line: fm.unsupportedLine,
        hint: 'keep frontmatter to flat key: value pairs and simple lists',
      })
      continue
    }
    if (fm.unterminated) {
      report.error('agent/frontmatter', file, 'the frontmatter block is never closed', { line: 1 })
      continue
    }
    if (!fm.fenced) {
      report.error('agent/frontmatter', file, 'no frontmatter found, so description is missing', {
        line: 1,
        hint: 'line 1 must be exactly --- with no blank line or indentation before it',
      })
      continue
    }

    const attrs = fm.attributes
    const descLine = fm.keyLines.description ?? 1

    if (attrs.description === undefined || attrs.description === null) {
      report.error('agent/description', file, `Invalid agent ${dirent.name}: description is required`, {
        line: 1,
        hint: 'it is the only signal the main agent has when choosing this subagent',
      })
    } else if (typeof attrs.description !== 'string') {
      report.error('agent/description', file, 'description must be a string', { line: descLine })
    } else if (attrs.description.length < 1 || attrs.description.length > 500) {
      report.error('agent/description', file, `description must be 1-500 characters (has ${attrs.description.length})`, { line: descLine })
    }

    if (attrs.name === undefined) {
      report.error('agent/name-mismatch', file, 'name is required and must equal the directory name', {
        line: 1,
        hint: `add "name: ${name}"`,
      })
    } else if (attrs.name !== name) {
      report.error('agent/name-mismatch', file, `name ${JSON.stringify(attrs.name)} must equal the directory name ${JSON.stringify(name)}`, {
        line: fm.keyLines.name,
        hint: 'the directory is the agent name',
      })
    }

    if (attrs.tools !== undefined && attrs.tools !== null) {
      const list = Array.isArray(attrs.tools)
        ? attrs.tools
        : String(attrs.tools).split(',').map((t) => t.trim()).filter(Boolean)
      if (!(list.length === 1 && list[0] === '*')) {
        const bad = list.filter((t) => t !== '*' && !AGENT_TOOLS.includes(t))
        if (bad.length > 0) {
          report.error('agent/disallowed-tools', file, `Invalid agent ${dirent.name}: disallowed tools: ${bad.map((b) => JSON.stringify(b)).join(', ')}`, {
            line: fm.keyLines.tools ?? 1,
            hint: `grantable: ${AGENT_TOOLS.join(', ')}`,
          })
        }
      }
    }

    if (fm.body.trim() === '') {
      report.error('agent/empty-body', file, `Invalid agent ${dirent.name}: agent markdown body is empty`, { line: fm.bodyLine })
    }
  }
}

// --- automations -----------------------------------------------------------

function lintAutomationFiles(root, entry, declared, report) {
  const dir = join(entry.dir, NAMESPACE, 'automations')
  const present = new Set()

  for (const dirent of listDir(dir)) {
    if (!dirent.isFile() || !dirent.name.endsWith('.md')) continue
    present.add(dirent.name.slice(0, -3))
  }

  // The builder reports orphans first, so a real run can surface only this one.
  const orphans = [...present].filter((s) => !declared.includes(s))
  for (const orphan of orphans) {
    report.error(
      'automation/orphan-file',
      relative(root, join(dir, `${orphan}.md`)),
      `Invalid automations of ${entry.slug}: files without a manifest declaration: ${orphans.join(', ')}`,
      { line: 1, hint: `declare it in plugin.json under extensions["${NAMESPACE}"].automations, or delete it` }
    )
  }

  for (const slug of declared) {
    const path = join(dir, `${slug}.md`)
    if (!present.has(slug)) {
      report.error(
        'automation/missing-file',
        relative(root, join(entry.dir, 'plugin.json')),
        `Invalid automations of ${entry.slug}: missing automations/${slug}.md`,
        { hint: `create ${NAMESPACE}/automations/${slug}.md` }
      )
      continue
    }
    const text = readIfExists(path) ?? ''
    if (text.trim() === '') {
      report.error('automation/empty-file', relative(root, path), `Invalid automations of ${entry.slug}: automations/${slug}.md is empty`, { line: 1 })
    }
    if (text.trimStart().startsWith('---')) {
      report.warn('automation/frontmatter', relative(root, path), 'frontmatter here is not parsed or stripped, so it lands verbatim in the agent instruction', {
        line: 1,
        hint: 'name, schedule and model belong in plugin.json',
      })
    }
  }
}

function lintSetup(root, entry, manifest, report) {
  if (!manifest?.setup) return
  if (existsSync(join(entry.dir, 'skills', 'install', 'SKILL.md'))) return
  report.error(
    'setup/missing-install-skill',
    relative(root, join(entry.dir, 'plugin.json')),
    `setup of ${entry.slug} declares setup: true, but there is no skills/install skill for the setup chat to follow`,
    { hint: 'create skills/install/SKILL.md, or drop the setup flag' }
  )
}

// --- layout, scripts, sandbox paths ----------------------------------------

function lintLayout(root, entry, report) {
  for (const name of MISPLACED) {
    if (existsSync(join(entry.dir, name))) {
      report.warn('layout/root-content', relative(root, join(entry.dir, name)), 'builder content at the plugin root is never loaded', {
        hint: `move it to ${NAMESPACE}/${name}`,
      })
    }
  }

  const scripts = join(entry.dir, NAMESPACE, 'scripts')
  const pkgPath = join(scripts, 'package.json')
  if (existsSync(pkgPath)) {
    const file = relative(root, pkgPath)
    let pkg = null
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    } catch (e) {
      report.error('scripts/package-parse', file, `Invalid JSON in scripts/package.json: ${e.message}`)
    }
    const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {}
    const hasDeps = Object.keys(deps).length > 0
    const lock = join(scripts, 'pnpm-lock.yaml')
    if (hasDeps && !existsSync(lock)) {
      report.error('scripts/lockfile-missing', file, 'scripts/package.json declares dependencies but there is no pnpm-lock.yaml', {
        hint: 'install runs pnpm install --frozen-lockfile and fails without one',
      })
    }
    if (!hasDeps && !existsSync(lock)) {
      report.warn('scripts/lockfile-absent', file, 'a dependency-free package.json with no lockfile makes the install step re-run on every sync')
    }
  }

  walk(entry.dir, (path, node) => {
    const file = relative(root, path)
    if (node.isSymbolicLink()) {
      report.error('layout/symlink', file, 'symlinks under plugins/ bypass the release gate and then fail at runtime', {
        hint: 'commit a real file',
      })
      return false
    }
    if (node.isDirectory() && node.name === 'node_modules') {
      report.warn('layout/node-modules', file, 'committed node_modules ships into every sandbox', { hint: 'gitignore it' })
      return false
    }
    return true
  })

  lintSandboxPaths(root, entry, report)
}

function walk(dir, visit) {
  for (const dirent of listDir(dir)) {
    const path = join(dir, dirent.name)
    let stat
    try {
      stat = lstatSync(path)
    } catch {
      continue
    }
    const node = {
      name: dirent.name,
      isSymbolicLink: () => stat.isSymbolicLink(),
      isDirectory: () => stat.isDirectory() && !stat.isSymbolicLink(),
    }
    if (visit(path, node) === false) continue
    if (node.isDirectory()) walk(path, visit)
  }
}

/**
 * Plugin prose never names a sandbox location. The builder tells the agent
 * where each plugin's scripts directory is, so a script is addressed as
 * `scripts/<file>` and everything else is discovered. A hardcoded path
 * leaks the sandbox layout and breaks when it moves.
 */
function lintSandboxPaths(root, entry, report) {
  const absolute = /\/project\/workspace\S*|\.subbly\/(?:plugins|data|worktrees)\S*/g
  const script = /(?<![\w./-])scripts\/([\w.-]+(?:\/[\w.-]+)*)/g
  const scriptsDir = join(entry.dir, NAMESPACE, 'scripts')

  walk(entry.dir, (path, node) => {
    if (node.isDirectory() || !path.endsWith('.md')) return true
    const text = readIfExists(path)
    if (!text) return true

    for (const [full] of text.matchAll(absolute)) {
      const where = { line: lineOf(text, full), col: colOf(text, full) }
      report.error('sandbox/path-absolute', relative(root, path), `sandbox path "${full}" hardcodes the sandbox layout`, { ...where, hint: 'name a script as scripts/<file>; the builder resolves the directory' })
    }

    for (const [full, file] of text.matchAll(script)) {
      if (existsSync(join(scriptsDir, file))) continue
      const where = { line: lineOf(text, full), col: colOf(text, full) }
      report.warn('sandbox/script-missing', relative(root, path), `"${full}" names a script the plugin does not ship`, { ...where, hint: `add ${NAMESPACE}/scripts/${file} or fix the reference` })
    }
    return true
  })
}

// --- release bump ----------------------------------------------------------

function lintVersionBump(root, version, report) {
  let base = null
  for (const ref of ['origin/main', 'main']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', ref], { cwd: root, stdio: 'pipe' })
      base = ref
      break
    } catch {
      /* try the next ref */
    }
  }
  if (!base) return

  try {
    const changed = execFileSync('git', ['diff', '--name-only', base, '--', 'plugins/'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
    if (changed.length === 0) return

    const baseVersion = JSON.parse(execFileSync('git', ['show', `${base}:marketplace.json`], { cwd: root, encoding: 'utf8' })).version
    if (baseVersion === version) {
      report.warn('marketplace/version-bump', 'marketplace.json', `${changed.length} file(s) under plugins/ changed since ${base}, but version is still ${version}`, {
        hint: 'a merge without a version bump releases nothing',
      })
    }
  } catch {
    /* no baseline to compare against */
  }
}

// --- entry point -----------------------------------------------------------

export function lint(root, { git = true } = {}) {
  const report = new Report()
  const marketplace = lintMarketplaceManifest(root, report)
  if (!marketplace) return report

  for (const entry of marketplace.entries) {
    if (!existsSync(entry.dir)) continue
    const manifest = lintPluginManifest(root, entry, report)
    lintMcp(root, entry, manifest, report)
    lintSkills(root, entry, report)
    lintAgents(root, entry, report)
    lintAutomationFiles(root, entry, manifest?.automations ?? [], report)
    lintSetup(root, entry, manifest, report)
    lintLayout(root, entry, report)
  }

  if (git) lintVersionBump(root, marketplace.version, report)
  return report
}
