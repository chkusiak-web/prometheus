import { useState } from 'react'
import { fromKey } from './date'
import { BODY_PLAN_DAYS, bodyPlanDates } from './bodyPlanDates'
import { actions, bodySessionDone, hasCompletedSets, plannedLiftOn, useStore, type State, type WEx } from './store'

type Prescription = [name: string, sets: number, min: number, max: number, perSide?: boolean, timed?: boolean]
type Session = { name: string; lifts: Prescription[] } | { name: string; recovery: string }

const WEEK: Session[] = [
  { name: 'Upper A', lifts: [
    ['Dumbbell floor press', 3, 6, 10], ['Single-arm row', 3, 8, 12, true],
    ['Standing dumbbell press', 2, 8, 12], ['Face pull', 2, 12, 20],
  ] },
  { name: 'Lower A', lifts: [
    ['Dumbbell Romanian deadlift', 3, 8, 12], ['Goblet squat', 2, 8, 12],
    ['Glute bridge', 3, 10, 15], ['Single-leg calf raise', 2, 12, 20, true],
  ] },
  { name: 'Recovery', recovery: 'Take an easy walk and do some gentle mobility.' },
  { name: 'Upper B', lifts: [
    ['Push-up', 3, 6, 12], ['Lat pulldown', 3, 8, 12],
    ['Cable lateral raise', 2, 12, 15, true], ['Hammer curl', 2, 10, 15],
  ] },
  { name: 'Lower B', lifts: [
    ['Goblet squat', 3, 8, 12], ['Single-leg RDL', 2, 8, 12, true],
    ['Cable kickback', 2, 10, 15, true], ['Dead bug', 2, 8, 10, true],
  ] },
  { name: 'Upper accessories and core', lifts: [
    ['Dumbbell floor press', 2, 10, 12], ['Single-arm row', 2, 10, 12, true],
    ['Rear delt fly', 2, 12, 15], ['Rope pushdown', 2, 10, 15],
    ['Side plank', 2, 20, 30, true, true],
  ] },
  { name: 'Recovery and review', recovery: 'Take an easy walk and note how the week felt.' },
]

const PHASES = [
  { name: 'Foundation', starts: 0, main: [8, 12], accessory: [10, 15], extraSets: 0 },
  { name: 'Build', starts: 4, main: [6, 10], accessory: [10, 15], extraSets: 1 },
  { name: 'Strength', starts: 16, main: [5, 8], accessory: [8, 12], extraSets: 1 },
  { name: 'Volume', starts: 28, main: [8, 12], accessory: [12, 16], extraSets: 1 },
  { name: 'Consolidation', starts: 40, main: [6, 10], accessory: [10, 15], extraSets: 0 },
]

export function bodyPlanSession(index: number): Session | undefined {
  if (index < 0 || index >= BODY_PLAN_DAYS) return undefined
  if (index === BODY_PLAN_DAYS - 1) return { name: 'Year review', recovery: 'Take an easy walk and review the year.' }

  const week = Math.floor(index / 7)
  const base = WEEK[index % WEEK.length]
  if ('recovery' in base) return base

  const phase = [...PHASES].reverse().find(item => week >= item.starts) ?? PHASES[0]
  const lighter = week % 4 === 3
  const lifts = base.lifts.map(([name, sets, min, max, perSide, timed], lift): Prescription => {
    const main = lift < 2 && sets >= 3
    const range = week < 4 || timed ? [min, max] : main ? phase.main : phase.accessory
    const working = sets + (main ? phase.extraSets : 0)
    return [name, lighter ? Math.max(1, Math.floor(working * 0.6)) : working, range[0], range[1], perSide, timed]
  })
  return { name: lighter ? `${base.name} · lighter` : base.name, lifts }
}

const shortDate = (date: string) => fromKey(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

function workingSets(state: State, [name, count, min, max, perSide]: Prescription): WEx {
  const last = [...(state.workouts || [])].reverse().find(workout =>
    hasCompletedSets(workout) && workout.ex.some(exercise => exercise.name === name && exercise.sets.some(set => set.done && set.r > 0)))
  const previous = last?.ex.filter(exercise => exercise.name === name).flatMap(exercise => exercise.sets.filter(set => set.done && set.r > 0))
  const weight = previous?.at(-1)?.w ?? 0
  return {
    name, perSide, targetRange: [min, max], restSeconds: count >= 3 ? 90 : 60,
    sets: Array.from({ length: count }, () => ({ w: weight, r: min, done: false })),
  }
}

export function suggestedBodySession(state: State, today: string) {
  if (plannedLiftOn(state, today)) return undefined
  const index = bodyPlanDates(state.bodyWeek, today).indexOf(today)
  const session = bodyPlanSession(index)
  if (!session || !('lifts' in session) || bodySessionDone(state, index)) return undefined
  return { index, name: session.name, lifts: session.lifts, exercises: session.lifts.map(lift => workingSets(state, lift)) }
}

export default function BodyWeek({ today }: { today: string }) {
  const state = useStore(s => s)
  const [open, setOpen] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState<number>()
  const [message, setMessage] = useState('')
  const dates = bodyPlanDates(state.bodyWeek, today)
  const ordered = dates.map((day, index) => ({ day, index })).sort((a, b) => a.day.localeCompare(b.day))
  const lastWeek = Math.floor((ordered.length - 1) / 7)
  const elapsed = ordered.filter(slot => slot.day <= today).length
  const currentWeek = Math.floor(Math.max(0, elapsed - 1) / 7)
  const week = selectedWeek ?? currentWeek
  const phase = [...PHASES].reverse().find(item => week >= item.starts)
  const visible = ordered.slice(week * 7, week * 7 + 7)
  const completed = new Set((state.workouts || []).filter(workout =>
    workout.bodySession != null && hasCompletedSets(workout)).map(workout => workout.bodySession)).size

  function changeWeek(next: number) {
    setSelectedWeek(next)
    setMessage('')
  }

  return (
    <section className="body-week" aria-label="365-day Body plan">
      <div className="row between">
        <h2 className="cond">Body plan</h2>
        <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide plan' : 'Show plan'}</button>
      </div>
      <p className="small">{state.bodyWeek ? `${completed} / 260 planned lifts saved` : '365 days. Your plan dates are set when you start your first suggested lift.'}</p>
      {open && <>
        <div className="body-plan-nav">
          <button className="pill ghost" disabled={week === 0} onClick={() => changeWeek(week - 1)} aria-label="Previous week">‹</button>
          <select aria-label="Body plan week" value={week} onChange={event => changeWeek(Number(event.target.value))}>
            {Array.from({ length: lastWeek + 1 }, (_, index) =>
              <option key={index} value={index}>{index === lastWeek ? 'Day 365' : `Week ${index + 1}`}</option>)}
          </select>
          <button className="pill ghost" disabled={week === lastWeek} onClick={() => changeWeek(week + 1)} aria-label="Next week">›</button>
        </div>
        <div className="row between">
          <span className="lab">{week === lastWeek ? 'Year review' : `${phase?.name}${week % 4 === 3 ? ' · lighter week' : ''}`}</span>
          {week !== currentWeek && <button className="link" onClick={() => changeWeek(currentWeek)}>Current week</button>}
        </div>
        {message && <p className="small" role="status">{message}</p>}
        {visible.map(({ day, index }) => {
          const session = bodyPlanSession(index)
          if (!session) return null
          const done = bodySessionDone(state, index)
          const active = state.run?.bodySession === index
          return (
            <div className="body-week-row" key={index}>
              <div className="row between">
                <span className="lab">{shortDate(day)}{day === today ? ' · Today' : ''}</span>
                {done && <span className="small">Done</span>}
              </div>
              <details>
                <summary><strong>{session.name}</strong></summary>
                {'lifts' in session ? <ul className="small">{session.lifts.map(([name, count, min, max, perSide, timed]) =>
                  <li key={name}>{name} · {count} × {min}–{max}{timed ? ' sec' : ''}{perSide ? ' per side' : ''}</li>)}</ul>
                  : <p className="small">{session.recovery}</p>}
                {state.bodyWeek && !done && !active && today <= ordered.at(-1)!.day && (
                  <form className="body-plan-move" onSubmit={event => {
                    event.preventDefault()
                    const destination = String(new FormData(event.currentTarget).get('destination') ?? '')
                    const movingTo = dates.indexOf(destination)
                    if (actions.moveBodySession(index, destination, today)) {
                      if (movingTo >= 0) changeWeek(Math.floor(ordered.findIndex(slot => slot.day === destination) / 7))
                      setMessage(`${session.name} moved to ${shortDate(destination)}.`)
                    } else setMessage('Choose another plan date with a session that has not started.')
                  }}>
                    <label className="field"><span className="lab">Swap dates with</span>
                      <input name="destination" type="date" required min={today} max={ordered.at(-1)?.day} />
                    </label>
                    <button className="pill ghost" type="submit">Swap dates</button>
                  </form>
                )}
              </details>
            </div>
          )
        })}
      </>}
    </section>
  )
}
