// The linter as a library.
//
//   import { lint, FORMATTERS } from '@subbly/plugin-lint'
//   const report = lint(process.cwd(), { git: false })
//   console.log(FORMATTERS.stylish(report))
//
// The ESLint plugin lives behind its own entry: '@subbly/plugin-lint/eslint'.

export { lint, envVarName, PLUGIN_SCHEMA_URL, MCP_SCHEMA_URL, NAMESPACE, AGENT_TOOLS, DEFAULT_ENV_KEYS, CURRENT_LINK } from './src/rules.mjs'
export { RULES, FORMATTERS, Report } from './src/report.mjs'
export { SCHEDULE_FLOOR_MINUTES, parseCron, meetsFloor, CronUnsupported } from './src/cron.mjs'
