import { weekOf } from './date'
import { getDay, HERO_QUESTS, HERO_SPOILS, type Hero, type State } from './store'
import { bodyStats } from './body'
import { CATS } from './mind-data'

export const monday = (today: string) => weekOf(today)[0]

/** This week's Hero Quest; a new week gets a fresh one, rotating through the list. */
export function heroOf(s: State, today: string): Hero {
  const wk = monday(today)
  const h = s.hero?.[wk]
  if (h) return h
  const n = Object.keys(s.hero || {}).length
  return { name: HERO_QUESTS[n % HERO_QUESTS.length], spoil: HERO_SPOILS[n % HERO_SPOILS.length], done: Array(7).fill(false), swaps: 0 }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x))

/** All completion-based. Body = 70% workouts + 30% logging. Overall = average of Mind, Body, Soul and Hero. */
export function scores(s: State, today: string) {
  const days = weekOf(today).filter(k => k <= today)
  const areaDone: Record<string, number> = {}
  let soulDays = 0
  for (const k of days) {
    const bl = getDay(s, k).blocks
    for (const b of bl) if (b.done && b.area) areaDone[b.area] = (areaDone[b.area] || 0) + 1
    if (bl.some(b => b.done && b.pillar === 'soul')) soulDays++
  }
  const areas = CATS.flatMap(c => c.areas)
  const mind = areas.reduce((t, a) => t + clamp((areaDone[a.n] || 0) / a.goal), 0) / areas.length
  const cats = CATS.map(c => ({ n: c.n, color: c.color, pct: c.areas.reduce((t, a) => t + clamp((areaDone[a.n] || 0) / a.goal), 0) / c.areas.length }))
  const bs = bodyStats(s, today)
  const body = 0.7 * (bs.plan.workouts ? clamp(bs.workouts / bs.plan.workouts) : 1) + 0.3 * clamp((bs.weighIns + bs.foodDays) / 12)
  const soul = soulDays / 7
  const heroDays = heroOf(s, today).done.filter(Boolean).length
  const hero = heroDays / 7
  return { mind, body, soul, hero, heroDays, overall: (mind + body + soul + hero) / 4, cats, bs, soulDays }
}
