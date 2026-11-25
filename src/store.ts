import { useSyncExternalStore } from 'react'

export type Pillar = 'mind' | 'body' | 'soul' | 'todo'
export const PILLARS: { id: Pillar; name: string; color: string }[] = [
  { id: 'mind', name: 'Mind', color: 'var(--cobalt)' },
  { id: 'body', name: 'Body', color: 'var(--ember)' },
  { id: 'soul', name: 'Soul', color: 'var(--gold)' },
  { id: 'todo', name: 'To-do', color: 'var(--muted)' },
]
export const pillarOf = (p: Pillar) => PILLARS.find(x => x.id === p)!

export interface Block { id: string; name: string; pillar: Pillar; start: number; len: number; done: boolean; doneAt?: number }
export interface Day { blocks: Block[]; rating?: number; triangle?: string[]; closedAt?: number }
export interface State { v: 1; days: Record<string, Day> }

const KEY = 'prometheus:v1'
const EMPTY_DAY: Day = { blocks: [] }

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '')
    if (s && s.v === 1 && s.days) return s
  } catch { /* first run */ }
  return { v: 1, days: {} }
}

let state = load()
const subs = new Set<() => void>()
function set(next: State) {
  state = next
  localStorage.setItem(KEY, JSON.stringify(state))
  subs.forEach(f => f())
}
// Keep two open copies (e.g. Safari tab + home-screen app on desktop) in step.
addEventListener('storage', e => { if (e.key === KEY) { state = load(); subs.forEach(f => f()) } })

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => sel(state))
}
export const getDay = (s: State, k: string): Day => s.days[k] || EMPTY_DAY

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

function patchDay(k: string, fn: (d: Day) => Day) {
  set({ ...state, days: { ...state.days, [k]: fn(getDay(state, k)) } })
}
const sortB = (b: Block[]) => [...b].sort((x, y) => x.start - y.start)

export const actions = {
  addBlock(k: string, b: Omit<Block, 'id' | 'done'>) {
    patchDay(k, d => ({ ...d, blocks: sortB([...d.blocks, { ...b, id: uid(), done: false }]) }))
  },
  updateBlock(k: string, id: string, p: Partial<Block>) {
    patchDay(k, d => ({ ...d, blocks: sortB(d.blocks.map(b => b.id === id ? { ...b, ...p } : b)) }))
  },
  toggle(k: string, id: string) {
    patchDay(k, d => ({ ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, done: !b.done, doneAt: b.done ? undefined : Date.now() } : b) }))
  },
  /** Extend pushes later blocks that it now overlaps, in a cascade. */
  extend(k: string, id: string, by: number) {
    patchDay(k, d => {
      const bl = sortB(d.blocks.map(b => b.id === id ? { ...b, len: b.len + by } : { ...b }))
      let i = bl.findIndex(b => b.id === id)
      for (; i < bl.length - 1; i++) {
        const end = bl[i].start + bl[i].len
        if (bl[i + 1].start < end && !bl[i + 1].done) bl[i + 1].start = end
        else break
      }
      return { ...d, blocks: bl }
    })
  },
  duplicate(k: string, id: string) {
    const b = getDay(state, k).blocks.find(x => x.id === id)
    if (b) actions.addBlock(k, { name: b.name, pillar: b.pillar, start: b.start + b.len, len: b.len })
  },
  remove(k: string, id: string) {
    patchDay(k, d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }))
  },
  closeDay(k: string, rating: number, triangle: string[]) {
    patchDay(k, d => ({ ...d, rating, triangle, closedAt: Date.now() }))
  },
  importAll(json: string) {
    const s = JSON.parse(json)
    if (!s || s.v !== 1 || typeof s.days !== 'object') throw new Error('Not a Prometheus backup')
    set(s)
  },
  exportAll: () => JSON.stringify(state, null, 1),
}

/** Day won: 3+ check-offs, with at least one each in Mind, Body and Soul. */
export function dayStatus(d: Day) {
  const done = d.blocks.filter(b => b.done)
  const has = { mind: done.some(b => b.pillar === 'mind'), body: done.some(b => b.pillar === 'body'), soul: done.some(b => b.pillar === 'soul') }
  return { count: done.length, has, won: done.length >= 3 && has.mind && has.body && has.soul }
}
