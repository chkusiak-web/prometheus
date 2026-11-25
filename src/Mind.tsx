import { useState } from 'react'
import { actions, getDay, useStore, type State } from './store'
import { useNow } from './useNow'
import { weekOf } from './date'
import { CATS, CORNERS, TASKS } from './mind-data'
import { nextSlot } from './Today'

const AREAS = CATS.flatMap(c => c.areas.map(a => ({ ...a, cat: c.n, color: c.color })))
const toMin = (h: number) => Math.max(15, Math.round(h * 60 / 15) * 15)
const lenL = (m: number) => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`) : `${m} min`

/** Done Mind blocks per area, Monday to today. */
function weekDone(s: State, today: string) {
  const n: Record<string, number> = {}
  for (const k of weekOf(today).filter(k => k <= today)) for (const b of getDay(s, k).blocks) if (b.done && b.area) n[b.area] = (n[b.area] || 0) + 1
  return n
}

export default function Mind() {
  const { today, mins } = useNow()
  const s = useStore(x => x)
  const done = weekDone(s, today)
  const [area, setArea] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const add = (a: string, text: string, len: number) => actions.addBlock(today, { name: text, pillar: 'mind', area: a, start: nextSlot(getDay(s, today).blocks, mins), len })
  return (
    <main className="screen mind">
      <h1 className="cond pageh">Mind</h1>
      <Wheel done={done} onTap={setArea} />
      <div className="legend">{CATS.map(c => <span key={c.n}><i style={{ background: c.color }} />{c.n}</span>)}</div>
      <EmotionRing s={s} today={today} onCheck={() => setChecking(true)} />
      {area && <TaskSheet area={area} done={done[area] || 0} today={today} add={(t, l) => add(area, t, l)} close={() => setArea(null)} />}
      {checking && <CheckIn today={today} add={add} close={() => setChecking(false)} />}
    </main>
  )
}

function Wheel({ done, onTap }: { done: Record<string, number>; onTap: (a: string) => void }) {
  const R0 = 46, R1 = 150, n = AREAS.length, gap = 0.035
  const arc = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)]
  const wedge = (i: number, r1: number) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 + gap, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - gap
    const [x0, y0] = arc(R0, a0), [x1, y1] = arc(r1, a0), [x2, y2] = arc(r1, a1), [x3, y3] = arc(R0, a1)
    return `M${x0},${y0}L${x1},${y1}A${r1},${r1} 0 0 1 ${x2},${y2}L${x3},${y3}A${R0},${R0} 0 0 0 ${x0},${y0}Z`
  }
  return (
    <svg className="wheel" viewBox="-160 -160 320 320" role="group" aria-label="Mind areas this week">
      {AREAS.map((a, i) => {
        const f = Math.min(1, (done[a.n] || 0) / a.goal), mid = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2, [lx, ly] = arc(100, mid)
        return (
          <g key={a.n} role="button" tabIndex={0} aria-label={`${a.n}: ${done[a.n] || 0} of ${a.goal} this week`} className="wedge" onClick={() => onTap(a.n)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(a.n) } }}>
            <path d={wedge(i, R1)} fill={a.color} opacity={0.16} />
            {f > 0 && <path d={wedge(i, R0 + (R1 - R0) * f)} fill={a.color} />}
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className={f > 0.55 ? 'on' : ''}>{a.n}</text>
          </g>
        )
      })}
      <text x={0} y={-4} textAnchor="middle" className="wc">{Object.values(done).reduce((a, b) => a + b, 0)}</text>
      <text x={0} y={14} textAnchor="middle" className="wl">this week</text>
    </svg>
  )
}

/** Quadrant layout: x = unpleasant → pleasant, y = high → low energy. */
const QPOS: Record<string, [number, number]> = { Wired: [-1, -1], Bright: [1, -1], Spent: [-1, 1], Easy: [1, 1] }
const pt = (c: { corner: string; stress: number; drive: number }) => { const [x, y] = QPOS[c.corner] || [0, 0]; const k = 0.35 + (Math.max(c.stress, c.drive) - 1) / 4 * 0.55; return [x * k, y * k] }

function EmotionRing({ s, today, onCheck }: { s: State; today: string; onCheck: () => void }) {
  const all = s.checkins || [], todays = all.filter(c => c.day === today)
  const avg = all.length ? all.map(pt).reduce((a, p) => [a[0] + p[0] / all.length, a[1] + p[1] / all.length], [0, 0]) : null
  const last = todays[todays.length - 1]
  return (
    <section className="emo">
      <div className="ring">
        {CORNERS.map(c => <span key={c.n} style={{ background: c.color, color: c.ink ? 'var(--ink)' : '#fff' }}>{c.n}</span>)}
        {todays.map((c, i) => { const [x, y] = pt(c); return <i key={i} className="edot" style={{ left: `${50 + x * 30}%`, top: `${50 + y * 30}%` }} /> })}
        {avg && <i className="edot avg" style={{ left: `${50 + avg[0] * 30}%`, top: `${50 + avg[1] * 30}%` }} aria-label="All-time average" />}
      </div>
      <div className="emo-r">
        <div className="lab">Feelings</div>
        <div className="small">{last ? `Last: ${last.word} · stress ${last.stress} · drive ${last.drive}` : todays.length ? '' : 'No check-in yet today'}</div>
        <button className="pill" onClick={onCheck}>+ Check in</button>
      </div>
    </section>
  )
}

function TaskSheet({ area, done, today, add, close }: { area: string; done: number; today: string; add: (t: string, len: number) => void; close: () => void }) {
  const s = useStore(x => x)
  const a = AREAS.find(x => x.n === area)!
  const list: [string, number][] = [...(TASKS[area] || []), ...(s.myTasks?.[area] || []).map(t => [t, 0.5] as [string, number])]
  const onToday = new Set(getDay(s, today).blocks.filter(b => b.area === area).map(b => b.name))
  const [own, setOwn] = useState('')
  const row = ([t, h]: [string, number]) => (
    <div key={t} className="qrow">
      <span><b>{t}</b><span className="small">{lenL(toMin(h))}</span></span>
      {onToday.has(t) ? <span className="added" style={{ background: a.color, color: '#fff' }} aria-label="On today">✓</span> : <button className="mini dark" aria-label={`Add ${t} to today`} onClick={() => add(t, toMin(h))}>+</button>}
    </div>
  )
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div className="lab" style={{ color: a.color }}>{a.cat} · {done} of {a.goal} this week</div>
        <h2 className="cond">{area}</h2>
        {list.slice(0, 4).map(row)}
        <form className="qrow own" onSubmit={e => { e.preventDefault(); const t = own.trim(); if (t) { actions.addMyTask(area, t); add(t, 30); setOwn('') } }}>
          <input className="name" placeholder="Add your own" value={own} onChange={e => setOwn(e.target.value)} maxLength={80} />
          <button className="mini dark" aria-label="Add your own task" disabled={!own.trim()}>+</button>
        </form>
        {list.slice(4).map(row)}
      </div>
    </div>
  )
}

function CheckIn({ today, add, close }: { today: string; add: (area: string, t: string, len: number) => void; close: () => void }) {
  const s = useStore(x => x)
  const [corner, setCorner] = useState<string | null>(null)
  const [word, setWord] = useState<string | null>(null)
  const [stress, setStress] = useState(3), [drive, setDrive] = useState(3)
  const [added, setAdded] = useState<string | null>(null)
  const c = CORNERS.find(x => x.n === corner)
  const save = () => {
    actions.addCheckIn({ ts: Date.now(), day: today, corner: corner!, word: word!, stress, drive })
    // Stress 4–5, Drive 1 or Drive 5 forces a short Emotion quest into today.
    const area = stress >= 4 ? 'Stress' : drive === 1 ? 'Drive' : drive === 5 ? 'Stability' : null
    if (area) {
      const onToday = new Set(getDay(s, today).blocks.map(b => b.name))
      const pool = TASKS[area].filter(([t, h]) => h <= 0.25 && !onToday.has(t))
      const [t, h] = (pool.length ? pool : TASKS[area])[Math.floor(Math.random() * (pool.length || TASKS[area].length))]
      add(area, t, toMin(h)); setAdded(t)
    } else close()
  }
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Check in" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        {added ? (
          <>
            <div className="lab">Added to today</div>
            <h2 className="cond">{added}</h2>
            <p className="small">A short Emotion quest, because {stress >= 4 ? 'stress is high' : drive === 1 ? 'drive is low' : 'drive is maxed out'}. It counts as Mind.</p>
            <button className="pill big" onClick={close}>OK</button>
          </>
        ) : !c ? (
          <>
            <h2 className="cond">How are you feeling?</h2>
            <div className="quad">{CORNERS.map(q => <button key={q.n} style={{ background: q.color, color: q.ink ? 'var(--ink)' : '#fff' }} onClick={() => setCorner(q.n)}><b>{q.n}</b><span>{q.words.slice(0, 3).join(', ')}</span></button>)}</div>
          </>
        ) : !word ? (
          <>
            <div className="row between"><div className="lab">{c.n}</div><button className="link" onClick={() => setCorner(null)}>Back</button></div>
            <h2 className="cond">Pick a word</h2>
            <div className="words">{c.words.map(w => <button key={w} onClick={() => setWord(w)} style={{ ['--c' as string]: c.color }}>{w}</button>)}</div>
          </>
        ) : (
          <>
            <div className="row between"><div className="lab">{c.n} · {word}</div><button className="link" onClick={() => setWord(null)}>Back</button></div>
            <Slider label="Stress" v={stress} set={setStress} />
            <Slider label="Drive" v={drive} set={setDrive} />
            <button className="pill big" onClick={save}>Save</button>
          </>
        )}
      </div>
    </div>
  )
}

const Slider = ({ label, v, set }: { label: string; v: number; set: (n: number) => void }) => (
  <div className="slider"><div className="row between"><b>{label}</b><span className="small">{v} of 5</span></div>
    <div className="seg" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map(n => <button key={n} role="radio" aria-checked={v === n} className={v === n ? 'on' : ''} onClick={() => set(n)}>{n}</button>)}</div></div>
)
