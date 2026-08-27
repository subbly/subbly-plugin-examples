// Cron parsing and the builder 15-minute schedule floor.
//
// Mirrors packages/core/src/lib/automations/schedule.ts: 101 firings sampled
// from 2026-01-01T00:00:00Z, rejected if any gap falls under the floor.

export const SCHEDULE_FLOOR_MINUTES = 15

const CRON_ALIASES = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
}
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export class CronUnsupported extends Error {}

function expandField(spec, min, max, names) {
  const out = new Set()
  for (const part of spec.split(',')) {
    const piece = part.trim()
    if (piece === '') throw new Error('empty field element')
    if (/[LW#?]/i.test(piece)) throw new CronUnsupported(piece)

    const [rangePart, stepPart] = piece.split('/')
    const step = stepPart === undefined ? 1 : Number(stepPart)
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad step "${stepPart}"`)

    let lo
    let hi
    if (rangePart === '*') {
      lo = min
      hi = max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      lo = toNumber(a, names)
      hi = toNumber(b, names)
    } else {
      lo = toNumber(rangePart, names)
      hi = stepPart === undefined ? lo : max
    }
    if (lo < min || hi > max || lo > hi) throw new Error(`value out of range in "${piece}"`)
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return out
}

function toNumber(token, names) {
  const t = token.trim()
  if (/^\d+$/.test(t)) return Number(t)
  if (names) {
    const i = names.indexOf(t.toLowerCase().slice(0, 3))
    if (i !== -1) return i
  }
  throw new Error(`unrecognized value "${t}"`)
}

/** Returns {fields} or throws. Mirrors what cron-parser accepts, minus L/W/#. */
export function parseCron(expression) {
  const expr = (CRON_ALIASES[expression.trim().toLowerCase()] ?? expression).trim()
  const parts = expr.split(/\s+/)
  if (parts.length !== 5 && parts.length !== 6) {
    throw new Error(`expected 5 or 6 fields, got ${parts.length}`)
  }
  const [sec, min, hour, dom, mon, dow] = parts.length === 6 ? parts : ['0', ...parts]
  const dowSet = expandField(dow, 0, 7, DAYS)
  if (dowSet.has(7)) dowSet.add(0)
  return {
    seconds: expandField(sec, 0, 59),
    minutes: expandField(min, 0, 59),
    hours: expandField(hour, 0, 23),
    dom: expandField(dom, 1, 31),
    months: expandField(mon, 1, 12, MONTHS),
    dow: dowSet,
    domRestricted: dom.trim() !== '*',
    dowRestricted: dow.trim() !== '*',
  }
}

/**
 * Replicates scheduleMeetsFloor: 101 firings from 2026-01-01T00:00:00Z, reject
 * if any gap is under 15 minutes. Iterates by day so a yearly cron stays cheap.
 */
export function meetsFloor(cron) {
  if (cron.seconds.size > 1) return false // sub-minute firings

  const minutesOfDay = []
  for (const h of [...cron.hours].sort((a, b) => a - b)) {
    for (const m of [...cron.minutes].sort((a, b) => a - b)) minutesOfDay.push(h * 60 + m)
  }
  minutesOfDay.sort((a, b) => a - b)
  if (minutesOfDay.length === 0) return true

  // A same-day gap under the floor fails regardless of which days match.
  for (let i = 1; i < minutesOfDay.length; i++) {
    if (minutesOfDay[i] - minutesOfDay[i - 1] < SCHEDULE_FLOOR_MINUTES) return false
  }

  // Then walk real days for the wrap-around gap between consecutive fire days.
  const start = Date.UTC(2026, 0, 1)
  let firings = 0
  let previousDayIndex = null
  const DAY_LIMIT = 366 * 120

  for (let day = 0; day < DAY_LIMIT && firings <= 101; day++) {
    const date = new Date(start + day * 86400000)
    if (!dayMatches(cron, date)) continue

    if (previousDayIndex !== null) {
      const dayGap = (day - previousDayIndex) * 1440
      const wrap = dayGap - minutesOfDay[minutesOfDay.length - 1] + minutesOfDay[0]
      if (wrap < SCHEDULE_FLOOR_MINUTES) return false
    }
    previousDayIndex = day
    firings += minutesOfDay.length
  }
  return true
}

function dayMatches(cron, date) {
  if (!cron.months.has(date.getUTCMonth() + 1)) return false
  const domHit = cron.dom.has(date.getUTCDate())
  const dowHit = cron.dow.has(date.getUTCDay())
  // Standard cron: when both are restricted the match is OR, not AND.
  if (cron.domRestricted && cron.dowRestricted) return domHit || dowHit
  if (cron.domRestricted) return domHit
  if (cron.dowRestricted) return dowHit
  return true
}
