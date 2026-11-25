import { useSyncExternalStore } from 'react'
import { addDays, nowInfo } from './date'

export type Pillar = 'mind' | 'body' | 'soul' | 'todo'
export const PILLARS: { id: Pillar; name: string; color: string }[] = [
  { id: 'mind', name: 'Mind', color: 'var(--cobalt)' },
  { id: 'body', name: 'Body', color: 'var(--ember)' },
  { id: 'soul', name: 'Soul', color: 'var(--gold)' },
  { id: 'todo', name: 'To-do', color: 'var(--muted)' },
]
export const pillarOf = (p: Pillar) => PILLARS.find(x => x.id === p)!

export interface Block { id: string; name: string; pillar: Pillar; start: number; len: number; done: boolean; doneAt?: number; trait?: string; area?: string; goalId?: string }
export interface Sleep { bed: number; wake: number; quality: number } // minutes since midnight
export interface Day { blocks: Block[]; rating?: number; triangle?: string[]; closedAt?: number; water?: number; sleep?: Sleep }
export interface WSet { w: number; r: number; done: boolean }
export interface WEx { name: string; sets: WSet[]; restSeconds?: number; perSide?: boolean }
export interface Workout { id: string; name: string; day: string; startedAt: number; endedAt?: number; ex: WEx[]; cur: number; bodySession?: number }
export interface FoodItem { id: string; meal: Meal; name: string; kcal: number; p?: number; c?: number; f?: number; grams?: number }
export type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'
export const MEALS: Meal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
export interface Plan { goal: number; pace: number; workouts: number; maint: number; floor: number; small: string; big: string; wh: string[] }
export interface Withhold { missed: ('weigh-in' | 'calories')[]; task: string; done: boolean }
export interface State {
  v: 1
  days: Record<string, Day>
  /** First day the app was used; missed-log checks start from here. */
  since?: string
  weights?: Record<string, number>
  food?: Record<string, FoodItem[]>
  plan?: Plan
  withholds?: Record<string, Withhold>
  workouts?: Workout[]
  /** One date per starter session, in template order. */
  bodyWeek?: string[]
  /** The workout in progress, kept so leaving the app doesn't lose it. */
  run?: Workout | null
  /** Your own Soul quests, by trait. */
  myQuests?: Record<string, string[]>
  /** Your own Mind tasks, by area. */
  myTasks?: Record<string, string[]>
  checkins?: CheckIn[]
  /** Weekly Hero Quest, keyed by the week's Monday. */
  hero?: Record<string, Hero>
  goals?: Goal[]
}
export interface Hero { name: string; spoil: string; done: boolean[]; swaps: number }
export interface Goal { id: string; name: string; pillar: Pillar; len: number; freq: number }
export const HERO_QUESTS = ['Run 5K every day', 'Finish a book this week', 'Call a different person every day', 'No phone after 9 pm, all week', 'Write 3,500 words this week', 'Train 60 minutes every day', '10,000 steps every day', 'Sleep 7h+ every night']
export const HERO_SPOILS = ['Dinner out / takeaway', 'Brunch out', 'Buy a book', 'A concert or comedy show', 'Bottle of wine']
export interface CheckIn { ts: number; day: string; corner: string; word: string; stress: number; drive: number }

export const DEFAULT_PLAN: Plan = {
  goal: 200, pace: 1.5, workouts: 4, maint: 3150, floor: 1800, small: 'Coffee treat', big: '$25 to the gear fund',
  wh: ['15 pushups', 'Clean the bathroom', '20-minute walk', '50 squats', 'Take out all the trash', 'Do the dishes', '10-minute stretch', 'Wipe down the kitchen', 'Put away the laundry', "Prep tomorrow's lunch"],
}
export const planOf = (s: State) => s.plan || DEFAULT_PLAN
/** Daily food target = maintenance minus pace x 500, never under the floor. */
export const kcalTarget = (p: Plan) => Math.max(p.floor, Math.round(p.maint - p.pace * 500))

export const hasCompletedSets = (workout: Workout) =>
  workout.endedAt != null && workout.ex.some(exercise => exercise.sets.some(set => set.done && set.r > 0))

export const bodySessionDone = (s: State, index: number) =>
  (s.workouts || []).some(workout => workout.bodySession === index && hasCompletedSets(workout))

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
if (!state.since) { state = { ...state, since: nowInfo().today }; localStorage.setItem(KEY, JSON.stringify(state)) }
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
  setWeight(k: string, lb: number | null) {
    const w = { ...state.weights }
    if (lb == null) delete w[k]; else w[k] = Math.round(lb * 10) / 10
    set({ ...state, weights: w })
  },
  addFood(k: string, meal: Meal, name: string, kcal: number, extra?: { p?: number; c?: number; f?: number; grams?: number }) {
    set({ ...state, food: { ...state.food, [k]: [...(state.food?.[k] || []), { id: uid(), meal, name, kcal: Math.round(kcal), ...extra }] } })
  },
  removeFood(k: string, id: string) {
    set({ ...state, food: { ...state.food, [k]: (state.food?.[k] || []).filter(f => f.id !== id) } })
  },
  setPlan(p: Plan) { set({ ...state, plan: p }) },
  setWithhold(k: string, w: Withhold) { set({ ...state, withholds: { ...state.withholds, [k]: w } }) },
  addMyQuest(trait: string, q: string) { set({ ...state, myQuests: { ...state.myQuests, [trait]: [...(state.myQuests?.[trait] || []), q] } }) },
  setHero(week: string, h: Hero) { set({ ...state, hero: { ...state.hero, [week]: h } }) },
  saveGoal(g: Goal) { const gs = state.goals || []; set({ ...state, goals: gs.some(x => x.id === g.id) ? gs.map(x => x.id === g.id ? g : x) : [...gs, g] }) },
  removeGoal(id: string) { set({ ...state, goals: (state.goals || []).filter(g => g.id !== id) }) },
  addMyTask(area: string, t: string) { set({ ...state, myTasks: { ...state.myTasks, [area]: [...(state.myTasks?.[area] || []), t] } }) },
  addCheckIn(c: CheckIn) { set({ ...state, checkins: [...(state.checkins || []), c] }) },
  setTriangle(k: string, t: string[]) { patchDay(k, d => ({ ...d, triangle: t })) },
  setWater(k: string, n: number) { patchDay(k, d => ({ ...d, water: Math.max(0, Math.min(12, n)) })) },
  setSleep(k: string, sl: Sleep | undefined) { patchDay(k, d => ({ ...d, sleep: sl })) },
  startBodyWeek(today: string) {
    if (state.bodyWeek) return
    set({ ...state, plan: { ...planOf(state), workouts: 5 }, bodyWeek: Array.from({ length: 7 }, (_, index) => addDays(today, index)) })
  },
  moveBodySession(index: number, destination: string, today: string) {
    const dates = state.bodyWeek
    if (!dates || !dates[index] || destination < today) return
    const other = dates.indexOf(destination)
    if (other < 0 || index === other || [index, other].some(i =>
      state.run?.bodySession === i || bodySessionDone(state, i))) return
    const next = [...dates]
    next[other] = dates[index]
    next[index] = destination
    set({ ...state, bodyWeek: next })
  },
  startBodySession(index: number, name: string, ex: WEx[]) {
    const { today } = nowInfo()
    if (state.run || state.bodyWeek?.[index] !== today || bodySessionDone(state, index)) return
    set({ ...state, run: { id: uid(), bodySession: index, day: today, startedAt: Date.now(), name, ex, cur: 0 } })
  },
  setRun(r: Workout | null) { set({ ...state, run: r }) },
  /** Saves the workout and adds a done Body block for it, so it counts toward the day. */
  finishRun() {
    const r = state.run; if (!r) return
    const w: Workout = { ...r, endedAt: Date.now() }
    if (r.bodySession != null && !hasCompletedSets(w)) {
      set({ ...state, run: null })
      return
    }
    const { mins: start } = nowInfo(new Date(r.startedAt))
    const len = Math.max(15, Math.round((w.endedAt! - r.startedAt) / 60000 / 15) * 15)
    const day = getDay(state, r.day)
    set({ ...state, run: null, workouts: [...(state.workouts || []), w],
      days: { ...state.days, [r.day]: { ...day, blocks: sortB([...day.blocks, { id: uid(), name: r.name, pillar: 'body', start, len, done: true, doneAt: Date.now() }]) } } })
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
  // 8 of 8 water glasses also counts as the Body check.
  const has = { mind: done.some(b => b.pillar === 'mind'), body: done.some(b => b.pillar === 'body') || (d.water ?? 0) >= 8, soul: done.some(b => b.pillar === 'soul') }
  const count = done.length + ((d.water ?? 0) >= 8 ? 1 : 0)
  return { count, has, won: count >= 3 && has.mind && has.body && has.soul }
}
