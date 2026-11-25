import { useEffect } from 'react'
import { actions, planOf, useStore } from './store'
import { addDays } from './date'
import { missedLogs } from './body'

const pick = (list: string[], not?: string) => { const l = list.length > 1 ? list.filter(x => x !== not) : list; return l[Math.floor(Math.random() * l.length)] }

/** Judged for the day before (the app day rolls at 4 AM). Shows on Today until done. */
export default function DoItNow({ today }: { today: string }) {
  const y = addDays(today, -1)
  const s = useStore(x => x)
  const w = s.withholds?.[y]
  const eligible = !!s.since && y >= s.since
  const missed = eligible ? missedLogs(s, y) : []

  useEffect(() => {
    if (eligible && !w && missed.length) actions.setWithhold(y, { missed, task: pick(planOf(s).wh), done: false })
  }, [eligible, w, missed.length, y]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!w || w.done) return null
  return (
    <section className="doit" role="alert">
      <div className="lab">Missed yesterday's {w.missed.join(' and ')}</div>
      <div className="cond doit-t">Do it now: {w.task}</div>
      <div className="row">
        <button className="pill light" onClick={() => actions.setWithhold(y, { ...w, done: true })}>Done</button>
        <button className="pill ghost-l" onClick={() => actions.setWithhold(y, { ...w, task: pick(planOf(s).wh, w.task) })}>Swap</button>
      </div>
    </section>
  )
}
