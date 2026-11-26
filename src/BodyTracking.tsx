import { useState, type FormEvent } from 'react'
import { addDays, fromKey } from './date'
import { actions, useStore, type BodyReview } from './store'
import { bodyReviewMetrics, reviewSunday, stepTargetOn } from './bodyReview'

const dateLabel = (day: string) => fromKey(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const number = (value?: number, decimals = 0) => value == null ? '–' : value.toLocaleString(undefined, { maximumFractionDigits: decimals })

function StepForm({ day, today, pickDay }: { day: string; today: string; pickDay: (day: string) => void }) {
  const existing = useStore(s => s.steps?.[day])
  const target = useStore(s => stepTargetOn(s, day))
  const [count, setCount] = useState(existing?.toString() ?? '')
  const [status, setStatus] = useState('')
  return (
    <form className="body-tracking-form" onSubmit={event => {
      event.preventDefault()
      if (count !== '' && actions.setSteps(day, Number(count))) setStatus('Steps saved.')
    }}>
      <div className="body-tracking-fields">
        <label className="field"><span className="lab">Date</span>
          <input type="date" value={day} max={today} onChange={event => {
            const date = event.target.value
            if (date && date <= today) pickDay(date)
          }} />
        </label>
        <label className="field"><span className="lab">Steps</span>
          <input type="number" inputMode="numeric" min={0} max={100000} step={1} required value={count} onChange={event => { setCount(event.target.value); setStatus('') }} />
        </label>
        <button className="pill" type="submit" disabled={count === ''}>Save</button>
      </div>
      <div className="row between">
        <p className="small">{target == null ? 'Log steps to establish your baseline.' : `Daily target: ${number(target)} steps`}</p>
        {existing != null && <button className="link" type="button" onClick={() => {
          actions.setSteps(day, null)
          setCount('')
          setStatus('Step entry removed.')
        }}>Clear</button>}
      </div>
      {status && <p className="small" role="status">{status}</p>}
    </form>
  )
}

function WeeklyReview({ sunday, today }: { sunday: string; today: string }) {
  const state = useStore(s => s)
  const saved = state.bodyReviews?.[sunday]
  const [notes, setNotes] = useState(saved?.notes ?? '')
  const [knee, setKnee] = useState<BodyReview['knee']>(saved?.knee ?? '')
  const [target, setTarget] = useState(saved?.stepTarget?.toString() ?? '')
  const [status, setStatus] = useState('')
  const metrics = bodyReviewMetrics(state, sunday)
  const start = addDays(sunday, -7)
  const end = addDays(sunday, -1)
  const monday = addDays(sunday, 1)
  const nextDay = addDays(today, 1)
  const starts = nextDay > monday ? nextDay : monday
  const statRows = [
    ['Weight average', `${number(metrics.averageWeight, 1)}${metrics.averageWeight == null ? '' : ' lb'} · ${metrics.weighInDays}/7 days`],
    ['Lifting days', number(metrics.liftingDays)],
    ['Steps average', `${number(metrics.averageSteps)} · ${metrics.stepDays}/7 days`],
    ['Calories average', `${number(metrics.averageCalories)} · ${metrics.foodDays}/7 days`],
    ['Protein average', `${number(metrics.averageProtein)}${metrics.averageProtein == null ? '' : ' g'} · ${metrics.proteinDays}/7 days`],
  ]

  function save(event: FormEvent) {
    event.preventDefault()
    const changed = target !== '' && Number(target) !== saved?.stepTarget
    const review: BodyReview = {
      metrics, knee, notes: notes.trim(),
      stepTarget: changed ? Number(target) : saved?.stepTarget,
      targetStarts: changed ? starts : saved?.targetStarts,
    }
    if (actions.saveBodyReview(sunday, review)) setStatus('Review saved.')
  }

  return (
    <form className="body-tracking-form" onSubmit={save}>
      <p className="small">{dateLabel(start)}–{dateLabel(end)}. Averages use logged days. Protein uses days with protein recorded for every entry.</p>
      <dl className="body-review-metrics">{statRows.map(([label, value]) =>
        <div key={label}><dt className="lab">{label}</dt><dd>{value}</dd></div>)}</dl>
      <label className="field"><span className="lab">Knee response</span>
        <select value={knee} onChange={event => setKnee(event.target.value as BodyReview['knee'])}>
          <option value="">Choose an option</option><option value="fine">Felt fine</option>
          <option value="some">Some discomfort</option><option value="limited">Limited activity</option>
        </select>
      </label>
      <label className="field"><span className="lab">Notes for next week</span>
        <textarea rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} />
      </label>
      <label className="field"><span className="lab">Daily step target (optional)</span>
        <input type="number" min={1} max={100000} step={1} inputMode="numeric" value={target} onChange={event => setTarget(event.target.value)} />
      </label>
      <p className="small">{saved?.targetStarts && target === saved.stepTarget?.toString()
        ? `Target starts ${dateLabel(saved.targetStarts)}.`
        : `A new target starts ${dateLabel(starts)}.`}</p>
      <button className="pill" type="submit">Save review</button>
      {status && <p className="small" role="status">{status}</p>}
    </form>
  )
}

export default function BodyTracking({ today }: { today: string }) {
  const [day, setDay] = useState(today)
  const selected = day > today ? today : day
  const sunday = reviewSunday(today)
  const saved = useStore(s => Boolean(s.bodyReviews?.[sunday]))
  return (
    <>
      <section className="body-tracking" aria-label="Daily steps">
        <h2 className="cond">Steps</h2>
        <StepForm key={selected} day={selected} today={today} pickDay={setDay} />
      </section>
      <section className="body-tracking" aria-label="Sunday review">
        <details>
          <summary><strong>{saved ? 'Sunday review saved' : 'Sunday review'} · {dateLabel(sunday)}</strong></summary>
          <WeeklyReview key={sunday} sunday={sunday} today={today} />
        </details>
      </section>
    </>
  )
}
