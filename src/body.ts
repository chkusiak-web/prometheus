import { addDays, weekOf } from './date'
import { kcalTarget, planOf, type State } from './store'

export const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN

/** Weigh-ins in the 7 days ending on k (inclusive). */
const win7 = (s: State, k: string) => Array.from({ length: 7 }, (_, i) => s.weights?.[addDays(k, -i)]).filter((x): x is number => x != null)

export function bodyStats(s: State, today: string) {
  const plan = planOf(s)
  const now7 = avg(win7(s, today))
  const prev7 = avg(win7(s, addDays(today, -7)))
  const latest = Object.keys(s.weights || {}).sort().pop()
  const cur = Number.isNaN(now7) ? (latest ? s.weights![latest] : NaN) : now7
  const drop = prev7 - now7 // lb lost per week (positive = losing)
  // Pace tier: 7-day average vs last week's, with 0.25 lb grace.
  const tier: 'ok' | 'mid' | 'no' | 'none' = Number.isNaN(drop) ? 'none' : drop >= plan.pace - 0.25 ? 'ok' : drop >= plan.pace * 0.6 ? 'mid' : 'no'
  const toGo = cur - plan.goal
  const weeks = toGo / plan.pace
  const eta = Number.isNaN(weeks) || weeks <= 0 ? null : addDays(today, Math.ceil(weeks * 7))
  const kcal = (k: string) => (s.food?.[k] || []).reduce((t, f) => t + f.kcal, 0)

  // This week's behaviors (Mon–today).
  const wk = weekOf(today).filter(k => k <= today)
  const weighIns = wk.filter(k => s.weights?.[k] != null).length
  const foodDays = wk.filter(k => kcal(k) > 0).length
  // Until the workout runner exists, a workout = a day with a checked-off Body block.
  const workouts = wk.filter(k => (s.days[k]?.blocks || []).some(b => b.done && b.pillar === 'body')).length
  const small = weighIns >= 6 && foodDays >= 6 && workouts >= plan.workouts
  const big = tier === 'ok'
  return { plan, cur, now7, prev7, drop, tier, toGo, eta, kcal, target: kcalTarget(plan), weighIns, foodDays, workouts, small, big }
}

export const TIER = {
  ok: { label: 'On pace', color: 'var(--green)' },
  mid: { label: 'Close', color: '#C98A00' },
  no: { label: 'Behind', color: 'var(--ember)' },
  none: { label: 'Needs 2 weeks of weigh-ins', color: 'var(--muted)' },
} as const

/** A day counts as logged with a weigh-in and calories. */
export function missedLogs(s: State, k: string) {
  const m: ('weigh-in' | 'calories')[] = []
  if (s.weights?.[k] == null) m.push('weigh-in')
  if (!(s.food?.[k] || []).some(f => f.kcal > 0)) m.push('calories')
  return m
}
