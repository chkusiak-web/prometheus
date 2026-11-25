import { useEffect, useMemo, useState } from 'react'
import { actions, uid, useStore, type State, type WEx, type Workout } from './store'
import { LIB, WORKOUTS, type Ex } from './exercises'
import { nowInfo } from './date'

const EXR = (n: string): Ex => LIB.find(x => x[0] === n) || [n, 'Abs', [], 'Bodyweight', 0, 10, '']
const unitL = (e: Ex) => e[6] === 's' ? 's' : e[6] === 'm' ? ' m' : ' reps'
const REST = 60
const SETS = 3
const RANGE = 4 // rep range = default reps .. default + 4

/** Double progression from the last time you did this exercise:
 *  every set at the top of the range -> +5 lb and back to the bottom; otherwise same weight, +1 rep. */
function prefill(s: State, name: string) {
  const e = EXR(name)
  const last = [...(s.workouts || [])].reverse().map(w => w.ex.find(x => x.name === name)).find(x => x && x.sets.some(st => st.done))
  if (!last) return { w: e[4], r: e[5] }
  const done = last.sets.filter(st => st.done)
  const w = done[done.length - 1].w, r = Math.min(...done.map(st => st.r))
  if (e[6] || !e[4]) return { w, r: r + 1 } // timed / bodyweight: just add a rep (or second)
  if (done.every(st => st.r >= e[5] + RANGE)) return { w: w + 5, r: e[5] }
  return { w, r: Math.min(r + 1, e[5] + RANGE) }
}
const mkEx = (s: State, name: string): WEx => { const p = prefill(s, name); return { name, sets: Array.from({ length: SETS }, () => ({ ...p, done: false })) } }

export function Preview({ close, first }: { close: () => void; first?: string }) {
  const s = useStore(x => x)
  const [name, setName] = useState(first && WORKOUTS[first] ? first : Object.keys(WORKOUTS)[0])
  const [ex, setEx] = useState<WEx[]>(() => WORKOUTS[name].map(n => mkEx(s, n)))
  const [adding, setAdding] = useState(false)
  const pickTemplate = (n: string) => { setName(n); setEx(WORKOUTS[n].map(x => mkEx(s, x))) }
  const start = () => { actions.setRun({ id: uid(), name, day: nowInfo().today, startedAt: Date.now(), ex, cur: 0 }); close() }
  if (adding) return <Library title="Add exercise" onPick={n => { setEx(e => [...e, mkEx(s, n)]); setAdding(false) }} onBack={() => setAdding(false)} />
  return (
    <>
      <div className="lab">Start workout</div>
      <div className="chips">{Object.keys(WORKOUTS).map(n => <button key={n} className={n === name ? 'on' : ''} onClick={() => pickTemplate(n)}>{n}</button>)}</div>
      <h2 className="cond">{name}</h2>
      <div className="exlist">
        {ex.map((x, i) => { const e = EXR(x.name); return (
          <div key={x.name + i} className="exrow"><span><b>{x.name}</b><span className="small">{x.sets.length} × {x.sets[0].w ? x.sets[0].w + ' lb × ' : ''}{x.sets[0].r}{unitL(e)}</span></span>
            <button aria-label={`Remove ${x.name}`} onClick={() => setEx(a => a.filter((_, j) => j !== i))}>✕</button></div>
        ) })}
      </div>
      <button className="pill ghost" onClick={() => setAdding(true)}>+ Add exercise</button>
      <button className="pill big" disabled={!ex.length} onClick={start}>Start</button>
    </>
  )
}

function Library({ title, muscle, onPick, onBack }: { title: string; muscle?: string; onPick: (n: string) => void; onBack: () => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    // Each search word must start a word in the name, muscle or equipment ("db" also means dumbbell).
    const AL: Record<string, string> = { db: 'dumbbell', bb: 'barbell', ohp: 'overhead', bw: 'bodyweight' }
    const hit = LIB.filter(e => { const words = (e[0] + ' ' + e[1] + ' ' + e[3] + ' ' + e[2].join(' ')).toLowerCase().split(/[\s-]+/); return t.every(w => words.some(x => x.startsWith(w) || (AL[w] && x.startsWith(AL[w])))) })
    return muscle && !t.length ? [...hit.filter(e => e[1] === muscle), ...hit.filter(e => e[1] !== muscle)] : hit
  }, [q, muscle])
  return (
    <>
      <div className="row between"><h2 className="cond">{title}</h2><button className="link" onClick={onBack}>Back</button></div>
      <input className="name" placeholder="Search: dumbbell, chest, squat…" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" autoCorrect="off" aria-label="Search exercises" enterKeyHint="search" />
      <div className="exlist scroll">
        {list.map(e => <button key={e[0]} className="exrow" onClick={() => onPick(e[0])}><span><b>{e[0]}</b><span className="small">{e[1]} · {e[3]}</span></span></button>)}
      </div>
    </>
  )
}

export function Runner() {
  const r = useStore(s => s.run)
  const s = useStore(x => x)
  const [rest, setRest] = useState<number | null>(null)
  const [swap, setSwap] = useState(false)
  const [end, setEnd] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const iv = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(iv) }, [])
  useEffect(() => { if (rest != null && rest <= Date.now()) setRest(null) })
  if (!r) return null
  const save = (p: Partial<Workout>) => actions.setRun({ ...r, ...p })
  const x = r.ex[r.cur], e = EXR(x.name)
  const si = x.sets.findIndex(st => !st.done), set = x.sets[si]
  const nextIdx = () => { for (let k = 1; k <= r.ex.length; k++) { const i = (r.cur + k) % r.ex.length; if (r.ex[i].sets.some(st => !st.done)) return i } return -1 }
  const upd = (i: number, p: Partial<WEx['sets'][0]>) => save({ ex: r.ex.map((y, j) => j !== r.cur ? y : { ...y, sets: y.sets.map((st, k) => k === i ? { ...st, ...p } : st) }) })
  const doneSet = () => {
    // Weight and reps carry forward to the next set unless you change them.
    const sets = x.sets.map((st, k) => k === si ? { ...st, done: true } : k > si && !st.done ? { ...st, w: set.w, r: set.r } : st)
    const ex = r.ex.map((y, j) => j === r.cur ? { ...y, sets } : y)
    const more = sets.some(st => !st.done)
    const nr = { ...r, ex }
    if (!more) { const n = (() => { for (let k = 1; k <= ex.length; k++) { const i = (r.cur + k) % ex.length; if (ex[i].sets.some(st => !st.done)) return i } return -1 })(); if (n < 0) { actions.setRun(nr); setEnd(true); return } nr.cur = n }
    actions.setRun(nr); setRest(Date.now() + REST * 1000)
  }
  const mins = Math.floor((Date.now() - r.startedAt) / 60000)
  const total = r.ex.reduce((t, y) => t + y.sets.filter(st => st.done).length, 0)
  const vol = r.ex.reduce((t, y) => t + y.sets.filter(st => st.done).reduce((a, st) => a + st.w * st.r, 0), 0)

  if (end || (si < 0 && nextIdx() < 0)) return (
    <div className="flow runner">
      <div className="step">
        <div className="lab">Workout done</div>
        <h1 className="cond">{r.name}</h1>
        <div className="strip"><div><div className="n">{mins}</div><div className="lab">Minutes</div></div><div><div className="n">{total}</div><div className="lab">Sets</div></div><div><div className="n">{vol.toLocaleString()}</div><div className="lab">lb moved</div></div></div>
        <button className="pill big" onClick={() => actions.finishRun()}>Save workout</button>
        {!end || <button className="link" onClick={() => setEnd(false)}>Keep going</button>}
        <button className="link" onClick={() => { if (confirm('Discard this workout? Nothing will be saved.')) actions.setRun(null) }}>Discard</button>
      </div>
    </div>
  )

  if (swap) return (
    <div className="flow runner exercise-swap"><div className="step top">
      <Library title={`Swap ${x.name}`} muscle={e[1]} onBack={() => setSwap(false)} onPick={n => {
        // Sets already done stay with the old exercise; the new one takes the remaining sets.
        const done = x.sets.filter(st => st.done), fresh = mkEx(s, n)
        fresh.sets = fresh.sets.slice(0, Math.max(1, x.sets.length - done.length))
        const ex = done.length ? [...r.ex.slice(0, r.cur), { ...x, sets: done }, fresh, ...r.ex.slice(r.cur + 1)] : r.ex.map((y, j) => j === r.cur ? fresh : y)
        save({ ex, cur: done.length ? r.cur + 1 : r.cur }); setSwap(false)
      }} />
    </div></div>
  )

  const left = rest != null ? Math.max(0, Math.ceil((rest - Date.now()) / 1000)) : 0
  return (
    <div className="flow runner">
      <div className="flow-top">
        <button className="link" onClick={() => setEnd(true)}>Finish</button>
        <span className="lab">{r.name} · {mins} min</span>
        <button className="link" onClick={() => setSwap(true)}>Swap</button>
      </div>
      <div className="exnav">{r.ex.map((y, i) => <button key={i} aria-label={y.name} className={(i === r.cur ? 'on ' : '') + (y.sets.every(st => st.done) ? 'done' : '')} onClick={() => { save({ cur: i }); setRest(null) }} />)}</div>
      {rest != null && left > 0 ? (
        <div className="step">
          <div className="lab">Rest</div>
          <div className="n resttime">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
          <p className="small">Next: {x.name}, set {si + 1} of {x.sets.length}</p>
          <div className="row center"><button className="pill ghost" onClick={() => setRest(rest + 30000)}>+30 s</button><button className="pill" onClick={() => setRest(null)}>Skip rest</button></div>
        </div>
      ) : si < 0 ? (
        <div className="step"><h1 className="cond">{x.name}</h1><p className="small">All sets done.</p><button className="pill big" onClick={() => { const n = nextIdx(); if (n >= 0) save({ cur: n }); else setEnd(true) }}>Next exercise</button></div>
      ) : (
        <div className="step">
          <div className="lab">{e[1]} · {e[3]} · Set {si + 1} of {x.sets.length}</div>
          <h1 className="cond">{x.name}</h1>
          {e[3] !== 'Bodyweight' && <Num label="lb" v={set.w} step={5} set={v => upd(si, { w: v })} />}
          <Num label={unitL(e).trim()} v={set.r} step={1} set={v => upd(si, { r: v })} />
          <div className="setdots">{x.sets.map((st, k) => <span key={k} className={st.done ? 'on' : k === si ? 'cur' : ''}>{st.done ? `${st.w ? st.w + '×' : ''}${st.r}` : k + 1}</span>)}
            <button aria-label="Add a set" onClick={() => save({ ex: r.ex.map((y, j) => j === r.cur ? { ...y, sets: [...y.sets, { ...set, done: false }] } : y) })}>+</button></div>
          <button className="pill big" onClick={doneSet}>Done set</button>
        </div>
      )}
    </div>
  )
}

const Num = ({ label, v, step, set }: { label: string; v: number; step: number; set: (v: number) => void }) => (
  <div className="num">
    <button aria-label={`Less ${label}`} onClick={() => set(Math.max(0, v - step))}>−</button>
    <span><span className="n">{v}</span><span className="small">{label}</span></span>
    <button aria-label={`More ${label}`} onClick={() => set(v + step)}>+</button>
  </div>
)
