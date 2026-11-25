import { addDays } from './date'
import { getDay, type State } from './store'
import { POOLS, SHORT, TRAITS } from './quests'

const LONG: Record<string, string> = Object.fromEntries(Object.entries(SHORT).map(([k, v]) => [v, k]))
/** Older saves stored short trait names. */
export const full = (t: string) => LONG[t] || t

export type Quest = { size: 'S' | 'M' | 'L'; text: string; mine?: boolean }
export const LEN = { S: 15, M: 30, L: 60 } as const

/** Last day each quest text was done. */
function lastDone(s: State) {
  const m: Record<string, string> = {}
  for (const k of Object.keys(s.days).sort()) for (const b of s.days[k].blocks) if (b.done && b.trait) m[b.name] = k
  return m
}

/** The pool for a trait, longest-not-done first (never-done first), your own quests included. */
export function rotation(s: State, trait: string): Quest[] {
  const ld = lastDone(s)
  const all: Quest[] = [...(POOLS[trait] || []).map(([size, text]) => ({ size, text })), ...(s.myQuests?.[trait] || []).map(text => ({ size: 'M' as const, text, mine: true }))]
  return all.map((q, i) => ({ q, i, d: ld[q.text] || '' })).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.i - b.i).map(x => x.q)
}

/** Rolling 7 days: quests done in a trait plus the days it was in your Soul triangle. */
export function traitScores(s: State, today: string) {
  const sc: Record<string, number> = Object.fromEntries(TRAITS.map(t => [t, 0]))
  for (let i = 0; i < 7; i++) {
    const d = getDay(s, addDays(today, -i))
    for (const b of d.blocks) if (b.done && b.trait && b.trait in sc) sc[b.trait] += 1
    for (const t of d.triangle || []) { const f = full(t); if (f in sc) sc[f] += 0.5 }
  }
  return sc
}

/** Suggested quest: the top of the rotation for your weakest trait (ties rotate by date). */
export function suggestion(s: State, today: string) {
  const sc = traitScores(s, today)
  const off = parseInt(today.slice(-2), 10) % TRAITS.length
  const order = TRAITS.map((_, i) => TRAITS[(i + off) % TRAITS.length])
  const trait = order.reduce((a, t) => sc[t] < sc[a] ? t : a, order[0])
  return { trait, quest: rotation(s, trait)[0] }
}
