export const run = async (results, ctx) => {
  const greeting = ctx.env.PLUGIN_SHOP_EXAMPLE_AUTOMATIONS__GREETING ?? 'Hello'
  const tone = ctx.env.PLUGIN_SHOP_EXAMPLE_AUTOMATIONS__TONE ?? 'friendly'
  const ending = tone === 'formal' ? '.' : '!'

  return { text: `${greeting}${ending}`, scheduled_at: results.trigger.scheduled_at }
}
