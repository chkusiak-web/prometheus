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
  const [checking, setChecking] = useState<string | boolean>(false)
  const add = (a: string, text: string, len: number) => actions.addBlock(today, { name: text, pillar: 'mind', area: a, start: nextSlot(getDay(s, today).blocks, mins), len })
  return (
    <main className="screen mind">
      <h1 className="cond pageh">Mind</h1>
      <Wheel done={done} onTap={setArea} />
      <EmotionRing s={s} onCheck={c => setChecking(c || true)} />
      {area && <TaskSheet area={area} done={done[area] || 0} today={today} add={(t, l) => add(area, t, l)} close={() => setArea(null)} />}
      {checking && <CheckIn today={today} start={typeof checking === 'string' ? checking : null} add={add} close={() => setChecking(false)} />}
    </main>
  )
}

/** The prototype's wheel: 12 wedges of 30°, rounded by a 6px round-join stroke; fill radius grows with the square root of progress. */
function Wheel({ done, onTap }: { done: Record<string, number>; onTap: (a: string) => void }) {
  const R = 136, R0 = 30, RAD = 6, GAP = 1.6, deg = Math.PI / 180
  const P = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  const wedge = (i: number, r1: number) => {
    const a0 = (i * 30 - 90) * deg, a1 = ((i + 1) * 30 - 90) * deg, ri = R0 + RAD, ro = r1 - RAD
    if (ro <= ri + 1) return null
    const ii = (RAD + GAP) / ri, io = (RAD + GAP) / ro
    return `M${P(ri, a0 + ii)}L${P(ro, a0 + io)}A${ro} ${ro} 0 0 1 ${P(ro, a1 - io)}L${P(ri, a1 - ii)}Z`
  }
  return (
    <svg className="wheel" viewBox="-146 -146 292 292" role="group" aria-label="Mind wheel of 12 activities. Tap a segment for its tasks.">
      {AREAS.map((a, i) => {
        const pct = Math.min(1, (done[a.n] || 0) / a.goal), rf = R0 + RAD * 2 + (R - R0 - RAD * 2) * Math.sqrt(pct)
        const bg = `color-mix(in srgb, ${a.color} 20%, #ECE8E1)`, fg = pct > 0 ? wedge(i, rf) : null
        return (
          <g key={a.n} role="button" tabIndex={0} aria-label={`${a.n}: ${done[a.n] || 0} of ${a.goal} this week`} className="wedge" onClick={() => onTap(a.n)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(a.n) } }}>
            <title>{a.n}</title>
            <path d={wedge(i, R)!} style={{ fill: bg, stroke: bg }} strokeWidth={2 * RAD} strokeLinejoin="round" />
            {fg && <path d={fg} fill={a.color} stroke={a.color} strokeWidth={2 * RAD} strokeLinejoin="round" />}
          </g>
        )
      })}
    </svg>
  )
}

/** Corner positions (x, y) on the ring: Wired, Bright, Spent, Easy. */
const EWP: Record<string, [number, number]> = { Wired: [-1, -1], Bright: [1, -1], Spent: [-1, 1], Easy: [1, 1] }
const EWS: [number, number[]][] = [[0, [255, 138, 14]], [45, [255, 176, 0]], [90, [141, 187, 46]], [135, [19, 160, 111]], [225, [47, 91, 234]], [315, [255, 74, 28]], [360, [255, 138, 14]]]
const EWB = [217, 212, 204]
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
function ringAt(d: number) { for (let i = 0; i < EWS.length - 1; i++) { const [a, ca] = EWS[i], [b, cb] = EWS[i + 1]; if (d >= a && d <= b) return mix(ca, cb, (d - a) / (b - a)) } return EWS[0][1] }
/** Halo color: the ring's color at the average direction of all check-ins, faded toward stone when they balance out. */
function haloOf(s: State) {
  const all = s.checkins || []
  if (!all.length) return EWB
  let x = 0, y = 0
  for (const c of all) { const p = EWP[c.corner]; if (p) { x += p[0]; y += -p[1] } }
  x /= all.length; y /= all.length
  const m = Math.min(1, Math.hypot(x, y) / Math.SQRT2)
  let d = Math.atan2(x, y) * 180 / Math.PI; if (d < 0) d += 360
  const nd = Math.round((d - 45) / 90) * 90 + 45; d = ((nd + (d - nd) * 0.4) + 360) % 360
  return mix(EWB, ringAt(d), Math.min(1, m * 4))
}

function EmotionRing({ s, onCheck }: { s: State; onCheck: (corner?: string) => void }) {
  const r = 67 * Math.SQRT1_2
  return (
    <div className="ewh">
      <div className="ewr" />
      <button className="ewc" style={{ ['--avg' as string]: `rgb(${haloOf(s)})` }} aria-label="Check in" onClick={() => onCheck()}><b>+</b><span>Check in</span></button>
      {CORNERS.map(c => { const [x, y] = EWP[c.n]; return <button key={c.n} className="ewn" style={{ left: `calc(50% + ${x * r}px)`, top: `${83 + y * r}px` }} aria-label={`Log ${c.n}`} onClick={() => onCheck(c.n)} /> })}
      <span className="ewt l t">Wired</span><span className="ewt r t">Bright</span><span className="ewt l b">Spent</span><span className="ewt r b">Easy</span>
    </div>
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

function CheckIn({ today, start, add, close }: { today: string; start: string | null; add: (area: string, t: string, len: number) => void; close: () => void }) {
  const s = useStore(x => x)
  const [corner, setCorner] = useState<string | null>(start)
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
