import { useState } from 'react'
import { fromKey } from './date'
import { actions, bodySessionDone, hasCompletedSets, plannedLiftOn, useStore, type State, type WEx } from './store'

type Prescription = [name: string, sets: number, min: number, max: number, perSide?: boolean, timed?: boolean]
type Session = { name: string; lifts: Prescription[] } | { name: string; recovery: string }

const SESSIONS: Session[] = [
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

const shortDate = (date: string) => fromKey(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

function workingSets(state: State, [name, count, min, , perSide]: Prescription): WEx {
  const last = [...(state.workouts || [])].reverse().find(workout =>
    hasCompletedSets(workout) && workout.ex.some(exercise => exercise.name === name && exercise.sets.some(set => set.done && set.r > 0)))
  const previous = last?.ex.filter(exercise => exercise.name === name).flatMap(exercise => exercise.sets.filter(set => set.done && set.r > 0))
  const weight = previous?.at(-1)?.w ?? 0
  return {
    name, perSide, restSeconds: count >= 3 ? 90 : 60,
    sets: Array.from({ length: count }, () => ({ w: weight, r: min, done: false })),
  }
}

export function suggestedBodySession(state: State, today: string) {
  if (plannedLiftOn(state, today)) return undefined
  const index = SESSIONS.map((session, index) => ({ session, index }))
    .filter(({ session, index }) => 'lifts' in session && !bodySessionDone(state, index))
    .sort((a, b) => {
      const first = state.bodyWeek?.[a.index] ?? ''
      const second = state.bodyWeek?.[b.index] ?? ''
      return Number(second === today) - Number(first === today) || first.localeCompare(second)
    })[0]?.index
  const session = index == null ? undefined : SESSIONS[index]
  if (index == null || !session || !('lifts' in session)) return undefined
  return { index, name: session.name, lifts: session.lifts, exercises: session.lifts.map(lift => workingSets(state, lift)) }
}

export default function BodyWeek({ today }: { today: string }) {
  const state = useStore(s => s)
  const [open, setOpen] = useState(false)
  const dates = state.bodyWeek
  const completed = SESSIONS.filter((_, index) => bodySessionDone(state, index)).length

  return (
    <section className="body-week" aria-label="Body starter week">
      <div className="row between">
        <h2 className="cond">Body week</h2>
        {dates && <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide week' : 'Show week'}</button>}
      </div>
      <p className="small">{dates ? `${completed} / 5 planned lifts saved` : 'Five lifts and two recovery days. Your first lift appears in Start workout.'}</p>
      {dates && open && dates.map((day, index) => ({ day, index })).sort((a, b) => a.day.localeCompare(b.day)).map(({ day, index }) => {
        const session = SESSIONS[index]
        const done = bodySessionDone(state, index)
        const active = state.run?.bodySession === index
        const destinations = dates.map((target, position) => ({ target, position }))
          .filter(({ target, position }) => target >= today && position !== index &&
            state.run?.bodySession !== position && !bodySessionDone(state, position))
          .sort((a, b) => a.target.localeCompare(b.target))
        return (
          <div className="body-week-row" key={index}>
            <div className="row between">
              <span className="lab">{shortDate(day)}</span>
              {done && <span className="small">Done</span>}
            </div>
            <details>
              <summary><strong>{session.name}</strong></summary>
              {'lifts' in session ? <ul className="small">{session.lifts.map(([name, count, min, max, perSide, timed]) =>
                <li key={name}>{name} · {count} × {min}–{max}{timed ? ' sec' : ''}{perSide ? ' per side' : ''}</li>)}</ul>
                : <p className="small">{session.recovery}</p>}
              {!done && !active && destinations.length > 0 && (
                <label className="field"><span className="lab">Swap dates with</span>
                  <select value="" onChange={event => actions.moveBodySession(index, event.target.value, today)}>
                    <option value="" disabled>Choose a day</option>
                    {destinations.map(({ target, position }) =>
                      <option key={target} value={target}>{shortDate(target)} · {SESSIONS[position].name}</option>)}
                  </select>
                </label>
              )}
            </details>
          </div>
        )
      })}
    </section>
  )
}
