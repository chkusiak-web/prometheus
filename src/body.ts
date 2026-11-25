import { LIB, WORKOUTS } from './exercises'
import { addDays, weekOf } from './date'
import { hasCompletedSets, kcalTarget, planOf, type State } from './store'

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
  const liftDays = new Set((s.workouts || []).filter(hasCompletedSets).map(workout => workout.day))
  const workouts = wk.filter(day => liftDays.has(day)).length
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

const ORDER = Object.keys(WORKOUTS)
/** The workout up next: the one after your last finished workout, in template order. */
export function nextWorkout(s: State) {
  const last = (s.workouts || []).filter(w => w.endedAt).sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!last) return ORDER[0]
  const i = ORDER.indexOf(last.name)
  return i < 0 ? ORDER[0] : ORDER[(i + 1) % ORDER.length]
}
const MUS = Object.fromEntries(LIB.map(x => [x[0], x[1]]))
export type MStat = 'p' | 's' | 'n'
/** Per muscle: days since last trained (finished workouts), and plan / sore / ready. */
export function muscleMap(s: State, today: string) {
  const ago: Record<string, number> = {}
  for (const w of s.workouts || []) {
    if (!w.endedAt) continue
    const d = Math.round((+new Date(today + 'T12:00') - +new Date(w.day + 'T12:00')) / 864e5)
    for (const e of w.ex) { const m = MUS[e.name]; if (m && e.sets.some(x => x.done) && (ago[m] == null || d < ago[m])) ago[m] = d }
  }
  const plan = new Set((WORKOUTS[nextWorkout(s)] || []).map(n => MUS[n]).filter(Boolean))
  const stat = (m: string): MStat => plan.has(m) ? 'p' : ago[m] != null && ago[m] <= 1 ? 's' : 'n'
  return { ago, plan, stat, next: nextWorkout(s) }
}
