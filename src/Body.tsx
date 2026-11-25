import { useEffect, useMemo, useState } from 'react'
import { actions, getDay, MEALS, useStore, type FoodItem, type Meal, type Plan, type State } from './store'
import { loadFoods, searchFoods, servG, servL, shortName, tidy, type FoodRow } from './foods'
import { Preview } from './Workout'
import { addDays, fromHHMM, fromKey, toHHMM } from './date'
import { useNow } from './useNow'
import { bodyStats, TIER } from './body'

type Sheet = 'weigh' | 'food' | 'plan' | 'edit' | 'workout' | 'sleep' | null
const f1 = (n: number) => Number.isNaN(n) ? '–' : n.toFixed(1)
const monthYear = (k: string) => fromKey(k).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export default function Body() {
  const { today } = useNow()
  const s = useStore(x => x)
  const st = bodyStats(s, today)
  const [sheet, setSheet] = useState<Sheet>(null)
  const eaten = st.kcal(today)
  const w = s.weights?.[today]
  const d = getDay(s, today), water = d.water ?? 0, sl = d.sleep

  return (
    <main className="screen body">
      <h1 className="cond pageh">Body</h1>
      <section className="strip">
        <div><div className="n">{f1(st.cur)}</div><div className="lab">7-day avg</div></div>
        <div><div className="n">{Number.isNaN(st.toGo) ? '–' : Math.max(0, st.toGo).toFixed(1)}</div><div className="lab">lb to go</div></div>
        <div><div className="n">{st.workouts}/{st.plan.workouts}</div><div className="lab">Workouts</div></div>
      </section>

      <button className="plancard" onClick={() => setSheet('plan')}>
        <span className="lab">Weight plan · {st.plan.pace} lb/week</span>
        <span className="pc-row">
          <span className="tierpill" style={{ background: TIER[st.tier].color }}>{TIER[st.tier].label}</span>
          <span className="small">{st.eta ? `Goal ${st.plan.goal} lb · ${monthYear(st.eta)}` : `Goal ${st.plan.goal} lb`}</span>
          <span aria-hidden>›</span>
        </span>
      </button>

      <button className="pill big" onClick={() => setSheet('workout')}>Start workout</button>

      <div className="tiles">
        <button className="tile" onClick={() => setSheet('weigh')}>
          <span className="lab">Weigh-in</span>
          <span className="n">{w != null ? f1(w) : 'Log'}</span>
          <span className="small">{w != null ? 'lb today' : 'Not yet today'}</span>
        </button>
        <button className="tile" onClick={() => setSheet('food')}>
          <span className="lab">Food</span>
          <span className="n">{eaten || 'Log'}</span>
          <span className="small">{eaten ? `of ${st.target.toLocaleString()} kcal` : `Target ${st.target.toLocaleString()}`}</span>
        </button>
        <div className="tile">
          <span className="lab">Water</span>
          <span className="glass" aria-label={`${water} of 8 glasses`}>{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < water ? 'f' : ''} />)}</span>
          <span className="row between"><span className="small">{water}/8{water >= 8 ? ' · Body ✓' : ''}</span>
            <span className="row"><button className="mini" aria-label="One less glass" onClick={() => actions.setWater(today, water - 1)}>−</button><button className="mini dark" aria-label="Add a glass" onClick={() => actions.setWater(today, water + 1)}>+</button></span></span>
        </div>
        <button className="tile" onClick={() => setSheet('sleep')}>
          <span className="lab">Sleep</span>
          <span className="n">{sl ? durL(sl.bed, sl.wake) : 'Log'}</span>
          <span className="small">{sl ? `Quality ${sl.quality}/5` : 'Last night'}</span>
        </button>
      </div>

      {sheet && (
        <div className="scrim" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            {sheet === 'weigh' && <WeighIn today={today} current={w} close={() => setSheet(null)} />}
            {sheet === 'food' && <Food today={today} s={s} target={st.target} />}
            {sheet === 'plan' && <PlanSheet s={s} today={today} edit={() => setSheet('edit')} />}
            {sheet === 'workout' && <Preview close={() => setSheet(null)} />}
            {sheet === 'sleep' && <SleepSheet today={today} close={() => setSheet(null)} />}
            {sheet === 'edit' && <EditPlan plan={st.plan} close={() => setSheet('plan')} />}
          </div>
        </div>
      )}
    </main>
  )
}

function WeighIn({ today, current, close }: { today: string; current?: number; close: () => void }) {
  const last = useStore(s => { const k = Object.keys(s.weights || {}).filter(x => x < today).sort().pop(); return k ? s.weights![k] : undefined })
  const [v, setV] = useState(current != null ? String(current) : '')
  const n = parseFloat(v), ok = n > 50 && n < 1000
  return (
    <form onSubmit={e => { e.preventDefault(); if (ok) { actions.setWeight(today, n); close() } }}>
      <h2 className="cond">Weigh-in</h2>
      <div className="bignum"><input inputMode="decimal" placeholder={last != null ? String(last) : '0.0'} value={v} onChange={e => setV(e.target.value.replace(',', '.'))} autoFocus aria-label="Weight in pounds" /><span>lb</span></div>
      {last != null && <p className="small">Last: {last} lb</p>}
      <button className="pill big" disabled={!ok}>Save</button>
      {current != null && <button type="button" className="link" onClick={() => { actions.setWeight(today, null); close() }}>Remove today's weigh-in</button>}
    </form>
  )
}

function Food({ today, s, target }: { today: string; s: State; target: number }) {
  const items = s.food?.[today] || []
  const total = items.reduce((t, f) => t + f.kcal, 0)
  const [meal, setMeal] = useState<Meal>(() => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack' })
  const [q, setQ] = useState('')
  const [hit, setHit] = useState<FoodRow | null>(null)
  const [ready, setReady] = useState(false)
  const [quick, setQuick] = useState(false)
  const [name, setName] = useState(''), [k, setK] = useState('')
  useEffect(() => { loadFoods().then(() => setReady(true)).catch(() => setReady(false)) }, [])
  const results = useMemo(() => ready && q.trim() ? searchFoods(q) : [], [q, ready])
  const kn = parseInt(k, 10)
  // Recent: the last distinct foods you logged, newest first.
  const recent = useMemo(() => {
    const seen = new Set<string>(), out: FoodItem[] = []
    for (const d of Object.keys(s.food || {}).sort().reverse()) for (const f of [...(s.food![d] || [])].reverse()) { if (!seen.has(f.name)) { seen.add(f.name); out.push(f) } if (out.length >= 8) return out }
    return out
  }, [s.food])

  if (hit) return <Portion row={hit} meal={meal} back={() => setHit(null)} add={(kcal, extra) => { actions.addFood(today, meal, shortName(hit[0]), kcal, extra); setHit(null); setQ('') }} />

  return (
    <>
      <div className="lab">Food · today</div>
      <h2 className="cond">{total.toLocaleString()} <span className="dim">/ {target.toLocaleString()} kcal</span></h2>
      <div className="bar"><i style={{ width: `${Math.min(100, total / target * 100)}%`, background: total > target + 50 ? 'var(--ember)' : 'var(--green)' }} /></div>
      {MEALS.map(m => {
        const its = items.filter(f => f.meal === m)
        return its.length ? (
          <div key={m} className="meal">
            <div className="lab">{m} · {its.reduce((t, f) => t + f.kcal, 0)}</div>
            {its.map(f => <div key={f.id} className="fitem"><span>{f.name}</span><span className="small">{f.kcal}</span><button aria-label={`Remove ${f.name}`} onClick={() => actions.removeFood(today, f.id)}>✕</button></div>)}
          </div>
        ) : null
      })}
      <div className="seg" role="radiogroup" aria-label="Meal">
        {MEALS.map(m => <button type="button" key={m} role="radio" aria-checked={meal === m} className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>{m}</button>)}
      </div>
      <input className="name" type="search" placeholder={ready ? 'Search 7,448 foods: oatmeal, eggs, banana…' : 'Loading foods…'} value={q} onChange={e => setQ(e.target.value)} autoComplete="off" autoCorrect="off" aria-label="Search foods" />
      <div className="flist">
        {q.trim() ? (results.length ? results.map((r, i) => (
          <button key={i} className="frow" onClick={() => setHit(r)}><span><b>{tidy(r[0])}</b><span className="small">{servL(r)} · {Math.round(r[1] * servG(r) / 100)} kcal</span></span><span aria-hidden>›</span></button>
        )) : <p className="small">{ready ? 'No matches. Try fewer words, or use Quick add.' : 'Loading…'}</p>) : recent.length ? (
          <>
            <div className="lab">Recent · tap to add to {meal}</div>
            {recent.map(f => <button key={f.id} className="frow" onClick={() => actions.addFood(today, meal, f.name, f.kcal, { p: f.p, c: f.c, f: f.f, grams: f.grams })}><span><b>{f.name}</b><span className="small">{f.kcal} kcal</span></span><span aria-hidden>+</span></button>)}
          </>
        ) : null}
      </div>
      {quick ? (
        <form className="addfood" onSubmit={e => { e.preventDefault(); if (kn > 0) { actions.addFood(today, meal, name.trim() || meal, kn); setName(''); setK(''); setQuick(false) } }}>
          <div className="formrow2">
            <input className="name" placeholder="What (optional)" value={name} onChange={e => setName(e.target.value)} autoComplete="off" maxLength={60} />
            <input className="name kc" inputMode="numeric" placeholder="kcal" value={k} onChange={e => setK(e.target.value.replace(/\D/g, ''))} aria-label="Calories" autoFocus />
          </div>
          <button className="pill big" disabled={!(kn > 0)}>Add</button>
        </form>
      ) : <button className="link" onClick={() => setQuick(true)}>Quick add calories</button>}
    </>
  )
}

function Portion({ row, meal, back, add }: { row: FoodRow; meal: Meal; back: () => void; add: (kcal: number, extra: { p: number; c: number; f: number; grams: number }) => void }) {
  const [q, setQ] = useState(1)
  const g = servG(row) * q, at = (x: number) => Math.round(x * g / 100)
  return (
    <>
      <div className="row between"><div className="lab">{meal}</div><button className="link" onClick={back}>Back</button></div>
      <h2 className="cond">{shortName(row[0])}</h2>
      <div className="strip light">
        <div><div className="n">{at(row[1])}</div><div className="lab">kcal</div></div>
        <div><div className="n">{at(row[2])}g</div><div className="lab">Protein</div></div>
        <div><div className="n">{at(row[3])}g</div><div className="lab">Carbs</div></div>
      </div>
      <div className="stepper"><span>{q} × {servL(row)} <span className="small">({Math.round(g)} g)</span></span>
        <span className="st-c"><button type="button" aria-label="Less" onClick={() => setQ(Math.max(0.5, q - 0.5))}>−</button><button type="button" aria-label="More" onClick={() => setQ(q + 0.5)}>+</button></span></div>
      <button className="pill big" onClick={() => add(at(row[1]), { p: at(row[2]), c: at(row[3]), f: at(row[4]), grams: Math.round(g) })}>Add {at(row[1])} kcal</button>
    </>
  )
}

function PlanSheet({ s, today, edit }: { s: State; today: string; edit: () => void }) {
  const st = bodyStats(s, today)
  const p = st.plan
  return (
    <>
      <div className="lab">Weight plan</div>
      <h2 className="cond">{f1(st.cur)} → {p.goal} lb</h2>
      <div className="strip light">
        <div><div className="n">{Number.isNaN(st.toGo) ? '–' : Math.max(0, st.toGo).toFixed(1)}</div><div className="lab">To go</div></div>
        <div><div className="n">{Number.isNaN(st.drop) ? '–' : st.drop.toFixed(1)}</div><div className="lab">Lost vs last wk</div></div>
        <div><div className="n">{st.eta ? monthYear(st.eta) : '–'}</div><div className="lab">At this pace</div></div>
      </div>
      <Chart s={s} today={today} plan={p} />
      <div className="pc-row"><span className="tierpill" style={{ background: TIER[st.tier].color }}>{TIER[st.tier].label}</span><span className="small">Goal pace {p.pace} lb/week</span></div>

      <div className="lab">This week</div>
      <div className="beh">
        <Beh label="Weigh-ins" n={st.weighIns} of={6} />
        <Beh label="Food logged" n={st.foodDays} of={6} />
        <Beh label="Workouts" n={st.workouts} of={p.workouts} />
      </div>

      <div className="lab">Rewards</div>
      <div className={'reward' + (st.small ? ' on' : '')}><span>{st.small ? '✓' : '○'}</span><span><b>{p.small}</b><span className="small">Weigh-in and food 6 of 7 days, plus {p.workouts} workouts</span></span></div>
      <div className={'reward' + (st.big ? ' on' : '')}><span>{st.big ? '✓' : '○'}</span><span><b>{p.big}</b><span className="small">Stay on pace this week</span></span></div>
      <p className="small">Missing a reward costs nothing. Missing a log (weigh-in or calories) means a quick Do it now task the next morning.</p>
      <div className="lab">Daily food target · {st.target.toLocaleString()} kcal</div>
      <button className="pill big ghost" onClick={edit}>Edit plan</button>
    </>
  )
}

const Beh = ({ label, n, of }: { label: string; n: number; of: number }) => (
  <div className={'behi' + (n >= of ? ' on' : '')}><div className="n">{n}<span className="dim">/{of}</span></div><div className="small">{label}</div></div>
)

function Chart({ s, today, plan }: { s: State; today: string; plan: Plan }) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(today, i - 41))
  const pts = days.map((k, i) => ({ i, w: s.weights?.[k] })).filter((p): p is { i: number; w: number } => p.w != null)
  if (pts.length < 2) return <div className="chart empty small">Weigh in a few days to see your chart.</div>
  const avg7 = days.map((_, i) => { const a = pts.filter(p => p.i <= i && p.i > i - 7); return a.length && pts[0].i <= i ? { i, w: a.reduce((t, p) => t + p.w, 0) / a.length } : null }).filter(Boolean) as { i: number; w: number }[]
  const start = avg7[0]
  const planPts = [start, { i: 41, w: start.w - plan.pace * (41 - start.i) / 7 }]
  const all = [...pts.map(p => p.w), ...planPts.map(p => p.w)]
  const lo = Math.floor(Math.min(...all) - 1), hi = Math.ceil(Math.max(...all) + 1)
  const W = 320, H = 140, X = (i: number) => i / 41 * W, Y = (w: number) => (hi - w) / (hi - lo) * H
  const line = (a: { i: number; w: number }[]) => a.map((p, j) => `${j ? 'L' : 'M'}${X(p.i).toFixed(1)},${Y(p.w).toFixed(1)}`).join('')
  return (
    <svg className="chart" viewBox={`-30 -6 ${W + 36} ${H + 12}`} role="img" aria-label="Weight chart, last 6 weeks">
      <text x={-6} y={4} textAnchor="end">{hi}</text><text x={-6} y={H} textAnchor="end">{lo}</text>
      <line x1={0} x2={W} y1={0} y2={0} className="grid" /><line x1={0} x2={W} y1={H} y2={H} className="grid" />
      <path d={line(planPts)} className="planl" />
      {pts.map(p => <circle key={p.i} cx={X(p.i)} cy={Y(p.w)} r={2.5} className="dot" />)}
      <path d={line(avg7)} className="avgl" />
    </svg>
  )
}

function EditPlan({ plan, close }: { plan: Plan; close: () => void }) {
  const [p, setP] = useState(plan)
  const [wh, setWh] = useState(plan.wh.join('\n'))
  const step = (k: 'goal' | 'pace' | 'workouts', d: number, lo: number, hi: number) => setP(x => ({ ...x, [k]: Math.min(hi, Math.max(lo, Math.round((x[k] + d) * 100) / 100)) }))
  const save = () => { const list = wh.split('\n').map(x => x.trim()).filter(Boolean); actions.setPlan({ ...p, wh: list.length ? list : plan.wh }); close() }
  return (
    <form onSubmit={e => { e.preventDefault(); save() }}>
      <h2 className="cond">Edit plan</h2>
      <Stepper label="Goal weight" value={`${p.goal} lb`} dec={() => step('goal', -5, 80, 600)} inc={() => step('goal', 5, 80, 600)} />
      <Stepper label="Pace" value={`${p.pace} lb/week`} dec={() => step('pace', -0.25, 0.25, 3)} inc={() => step('pace', 0.25, 0.25, 3)} />
      <Stepper label="Workouts per week" value={String(p.workouts)} dec={() => step('workouts', -1, 0, 7)} inc={() => step('workouts', 1, 0, 7)} />
      <label className="field col">Small reward (behaviors)<input value={p.small} onChange={e => setP({ ...p, small: e.target.value })} maxLength={60} /></label>
      <label className="field col">Big reward (on pace)<input value={p.big} onChange={e => setP({ ...p, big: e.target.value })} maxLength={60} /></label>
      <label className="field col">Do it now list (one per line)<textarea rows={6} value={wh} onChange={e => setWh(e.target.value)} /></label>
      <p className="small">Food target: {Math.max(p.floor, Math.round(p.maint - p.pace * 500)).toLocaleString()} kcal a day (maintenance {p.maint.toLocaleString()} minus pace × 500, never under {p.floor.toLocaleString()}).</p>
      <button className="pill big">Save</button>
    </form>
  )
}

const Stepper = ({ label, value, dec, inc }: { label: string; value: string; dec: () => void; inc: () => void }) => (
  <div className="stepper"><span>{label}</span><span className="st-c"><button type="button" aria-label={`Less ${label}`} onClick={dec}>−</button><b>{value}</b><button type="button" aria-label={`More ${label}`} onClick={inc}>+</button></span></div>
)


const durL = (bed: number, wake: number) => { const m = ((wake - bed) % 1440 + 1440) % 1440; return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` }

function SleepSheet({ today, close }: { today: string; close: () => void }) {
  const cur = useStore(s => getDay(s, today).sleep)
  const prev = useStore(s => getDay(s, addDays(today, -1)).sleep)
  const [bed, setBed] = useState(cur?.bed ?? prev?.bed ?? 23 * 60)
  const [wake, setWake] = useState(cur?.wake ?? prev?.wake ?? 7 * 60)
  const [q, setQ] = useState(cur?.quality ?? 3)
  return (
    <form onSubmit={e => { e.preventDefault(); actions.setSleep(today, { bed, wake, quality: q }); close() }}>
      <div className="lab">Last night</div>
      <h2 className="cond">{durL(bed, wake)}</h2>
      <label className="field">Bed<input type="time" step={600} value={toHHMM(bed)} onChange={e => e.target.value && setBed(fromHHMM(e.target.value))} /></label>
      <label className="field">Wake<input type="time" step={600} value={toHHMM(wake)} onChange={e => e.target.value && setWake(fromHHMM(e.target.value))} /></label>
      <div className="lab">Quality</div>
      <div className="seg" role="radiogroup" aria-label="Quality">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={q === n} className={q === n ? 'on' : ''} onClick={() => setQ(n)}>{n}</button>)}</div>
      <button className="pill big">Save</button>
      {cur && <button type="button" className="link" onClick={() => { actions.setSleep(today, undefined); close() }}>Remove</button>}
    </form>
  )
}
