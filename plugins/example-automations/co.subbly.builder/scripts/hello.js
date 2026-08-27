const colors = require('picocolors')

const greeting = process.env.PLUGIN_EXAMPLE_AUTOMATIONS__GREETING
const tone = process.env.PLUGIN_EXAMPLE_AUTOMATIONS__TONE || 'friendly'

if (!greeting) {
  console.error(colors.red('PLUGIN_EXAMPLE_AUTOMATIONS__GREETING is not set'))
  process.exit(1)
}

if (tone === 'formal') {
  console.log(colors.green(`${greeting}.`))
  process.exit(0)
}

console.log(colors.green(`${greeting}!`))
