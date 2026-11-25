import { useState } from 'react'
import { actions, MEALS, useStore, type Meal, type Plan, type State } from './store'
import { addDays, fromKey } from './date'
import { useNow } from './useNow'
import { bodyStats, TIER } from './body'

type Sheet = 'weigh' | 'food' | 'plan' | 'edit' | null
const f1 = (n: number) => Number.isNaN(n) ? '–' : n.toFixed(1)
const monthYear = (k: string) => fromKey(k).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

export default function Body() {
  const { today } = useNow()
  const s = useStore(x => x)
  const st = bodyStats(s, today)
  const [sheet, setSheet] = useState<Sheet>(null)
  const eaten = st.kcal(today)
  const w = s.weights?.[today]

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
      </div>
      <a className="link" href="./prototype/">Workouts, water and sleep are next. See the design ›</a>

      {sheet && (
        <div className="scrim" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            {sheet === 'weigh' && <WeighIn today={today} current={w} close={() => setSheet(null)} />}
            {sheet === 'food' && <Food today={today} s={s} target={st.target} />}
            {sheet === 'plan' && <PlanSheet s={s} today={today} edit={() => setSheet('edit')} />}
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
  const [name, setName] = useState(''), [k, setK] = useState('')
  const kn = parseInt(k, 10)
  const add = () => { if (kn > 0) { actions.addFood(today, meal, name.trim() || meal, kn); setName(''); setK('') } }
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
      <form className="addfood" onSubmit={e => { e.preventDefault(); add() }}>
        <div className="seg" role="radiogroup" aria-label="Meal">
          {MEALS.map(m => <button type="button" key={m} role="radio" aria-checked={meal === m} className={meal === m ? 'on' : ''} onClick={() => setMeal(m)}>{m}</button>)}
        </div>
        <div className="formrow2">
          <input className="name" placeholder="What (optional)" value={name} onChange={e => setName(e.target.value)} autoComplete="off" maxLength={60} />
          <input className="name kc" inputMode="numeric" placeholder="kcal" value={k} onChange={e => setK(e.target.value.replace(/\D/g, ''))} aria-label="Calories" />
        </div>
        <button className="pill big" disabled={!(kn > 0)}>Add</button>
      </form>
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

