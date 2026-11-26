import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { actions, getDay, MEALS, useStore, type FoodItem, type Meal, type Plan, type State } from './store'
import FoodScanner from './FoodScanner'
import { isBarcode, loadFoods, lookupBarcode, portionUnits, searchBrandedFoods, searchFoods, servingAmount, servL, shortName, tidy, type FoodRow } from './foods'
import BodyTracking from './BodyTracking'
import BodyWeek, { suggestedBodySession } from './BodyWeek'
import { Preview } from './Workout'
import { addDays, fromHHMM, fromKey, toHHMM } from './date'
import { useNow } from './useNow'
import { avg, bodyStats, muscleMap, TIER, type MStat } from './body'
import { FIG_SVG } from './muscles'
import { LIB } from './exercises'

type Sheet = 'log' | 'weigh' | 'food' | 'plan' | 'edit' | 'workout' | 'sleep' | null
const f1 = (n: number) => Number.isNaN(n) ? '–' : n.toFixed(1)
const monthYear = (k: string) => fromKey(k).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const ST: Record<MStat, [string, string]> = { p: ["Today's plan", 'var(--ember)'], s: ['Sore', '#A8201A'], n: ['Ready', '#8f897f'] }
const FILL: Record<MStat, string> = { p: 'var(--ember)', s: '#A8201A', n: '#E6E0D8' }
const agoL = (d?: number) => d == null ? 'Not trained yet' : d === 0 ? 'Last trained today' : d === 1 ? 'Last trained yesterday' : `Last trained ${d} days ago`
const sleepH = (sl?: { bed: number; wake: number }) => sl ? ((sl.wake - sl.bed + 1440) % 1440) / 60 : NaN
const hm = (h: number) => Number.isNaN(h) ? '–' : `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`

export default function Body() {
  const { today } = useNow()
  const s = useStore(x => x)
  const st = bodyStats(s, today)
  const suggested = suggestedBodySession(s, today)
  const mm = muscleMap(s, today, suggested?.lifts.map(([name]) => name))
  const [sheet, setSheet] = useState<Sheet>(null)
  const [muscle, setMuscle] = useState<string | null>(null)
  const [back, setBack] = useState(false)
  const eaten = st.kcal(today)
  const w = s.weights?.[today]
  const d = getDay(s, today), water = d.water ?? 0, sl = d.sleep
  const slAvg = avg(Array.from({ length: 7 }, (_, i) => sleepH(getDay(s, addDays(today, -i)).sleep)).filter(x => !Number.isNaN(x)))
  const delta = st.drop
  const close = () => setSheet(null)
  // Muscle colors as one stylesheet keyed by data-m, so the SVG stays static.
  const css = useMemo(() => Array.from(new Set(Array.from(FIG_SVG.matchAll(/data-m="([^"]+)"/g), m => m[1])))
    .map(m => `.figs [data-m="${m}"]{fill:${muscle === m ? 'var(--ink)' : FILL[mm.stat(m)]}}`).join(''), [mm, muscle])

  return (
    <main className="screen body">
      <h1 className="cond pageh">Body</h1>
      <section className="bcard">
        <button className="bstat" onClick={() => setSheet('plan')} aria-label="Weight plan">
          <span className="lab">Weight</span><span className="n">{f1(st.cur)}</span>
          <span className="d" style={{ color: TIER[st.tier].color }}>{Number.isNaN(delta) ? TIER[st.tier].label : `${delta >= 0 ? '↓' : '↑'} ${Math.abs(delta).toFixed(1)} lb · ${TIER[st.tier].label}`}</span>
        </button>
        <button className="bstat" onClick={() => setSheet('sleep')} aria-label="Log sleep">
          <span className="lab">Sleep</span><span className="n">{hm(sleepH(sl))}</span>
          <span className="d" style={{ color: '#C98A00' }}>{Number.isNaN(slAvg) ? 'Last night' : `avg ${hm(slAvg)}`}</span>
        </button>
        <button className="bstat" onClick={() => setSheet('workout')} aria-label="Start workout">
          <span className="lab">Lifting days</span><span className="n">{st.workouts}/{st.plan.workouts}</span>
          <span className="d" style={{ color: st.workouts >= st.plan.workouts ? 'var(--green)' : 'var(--muted)' }}>this week</span>
        </button>
      </section>

      <BodyWeek today={today} />
      <BodyTracking today={today} />

      <div className="figwrap">
        <style>{css}</style>
        <svg className="figs" width={495} height={1050} viewBox={back ? '653 5 495 1050' : '160 5 495 1050'} role="group" aria-label="Muscle map. Tap a muscle."
          onClick={e => { const m = (e.target as Element).closest('[data-m]')?.getAttribute('data-m'); if (m) setMuscle(m) }}
          dangerouslySetInnerHTML={{ __html: FIG_SVG }} />
        <div className={'figseg' + (back ? ' bk' : '')} role="group" aria-label="Side"><i className="fsth" /><button className={back ? '' : 'on'} aria-pressed={!back} onClick={() => setBack(false)}>Front</button><button className={back ? 'on' : ''} aria-pressed={back} onClick={() => setBack(true)}>Back</button></div>
      </div>
      <div className="mlegend"><span><i style={{ background: 'var(--ember)' }} />Today's plan</span><span><i style={{ background: '#A8201A' }} />Sore</span><span><i style={{ background: '#E6E0D8', boxShadow: 'inset 0 0 0 1.5px #B3A99D' }} />Ready</span></div>
      <button className="pill big" onClick={() => setSheet('log')}>+ Log</button>

      {sheet === 'food' && <FoodSheet today={today} s={s} target={st.target} close={close} />}

      {sheet !== 'food' && (sheet || muscle) && (
        <div className="scrim body-scrim" onClick={() => { setSheet(null); setMuscle(null) }}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            {muscle && !sheet && <MuscleSheet name={muscle} stat={mm.stat(muscle)} ago={mm.ago[muscle]} />}
            {sheet === 'log' && (
              <>
                <h2 className="cond">Log</h2>
                <button className="lgo" onClick={() => setSheet('workout')}><span className="cond">Start workout</span><small>{suggested?.name ?? mm.next} · up next</small></button>
                <div className="lgrid">
                  <button className="lgx" style={{ ['--c' as string]: 'var(--green)' }} onClick={() => setSheet('food')}><i className="fill" style={{ height: `${Math.min(100, eaten / st.target * 100)}%` }} /><span className="lab">Food</span><span className="lgn"><b className="cond">{Math.max(0, st.target - eaten).toLocaleString()}</b><small>kcal left</small></span></button>
                  <button className="lgx" style={{ ['--c' as string]: 'var(--cobalt)' }} onClick={() => actions.setWater(today, water >= 8 ? 0 : water + 1)} aria-label={`Water ${water} of 8. Tap to add a glass.`}><i className="fill" style={{ height: `${water / 8 * 100}%` }} /><span className="lab">Water · tap +1</span><span className="lgn"><b className="cond">{water}/8</b><small>glasses</small></span></button>
                  <button className="lgx" style={{ ['--c' as string]: 'var(--gold)' }} onClick={() => setSheet('weigh')}><i className="fill" style={{ height: w != null ? '100%' : '0' }} /><span className="lab">Weight</span><span className="lgn"><b className="cond">{w != null ? f1(w) : '–'}</b><small>{w != null ? 'lb today' : 'Not yet today'}</small></span></button>
                  <button className="lgx" style={{ ['--c' as string]: 'var(--navy)' }} onClick={() => setSheet('sleep')}><i className="fill" style={{ height: `${Math.min(100, (sleepH(sl) || 0) / 8 * 100)}%` }} /><span className="lab">Sleep</span><span className="lgn"><b className="cond">{sl ? durL(sl.bed, sl.wake) : '–'}</b><small>{sl ? `Quality ${sl.quality}/5` : 'Last night'}</small></span></button>
                </div>
              </>
            )}
            {sheet === 'weigh' && <WeighIn today={today} current={w} close={close} />}
            {sheet === 'plan' && <PlanSheet s={s} today={today} edit={() => setSheet('edit')} />}
            {sheet === 'workout' && <Preview first={mm.next} close={close} />}
            {sheet === 'sleep' && <SleepSheet today={today} close={close} />}
            {sheet === 'edit' && <EditPlan plan={st.plan} close={() => setSheet('plan')} />}
          </div>
        </div>
      )}
    </main>
  )
}

function MuscleSheet({ name, stat, ago }: { name: string; stat: MStat; ago?: number }) {
  const ex = LIB.filter(x => x[1] === name).slice(0, 4).map(x => x[0])
  return (
    <>
      <div className="row"><h2 className="cond">{name}</h2><span className="mtag" style={{ background: ST[stat][1] }}>{ST[stat][0]}</span></div>
      <p className="small">{agoL(ago)}</p>
      <div><div className="lab" style={{ marginBottom: 4 }}>Exercises</div>{(ex.length ? ex : ['Bodyweight circuit']).map(x => <div key={x} className="exr">{x}</div>)}</div>
    </>
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

function FoodSheet({ today, s, target, close }: { today: string; s: State; target: number; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startY: number } | null>(null)
  const closing = useRef(false)
  const dragged = useRef(false)

  function movePanel(offset: number) {
    if (panel.current) panel.current.style.transform = offset > 0 ? `translateY(${offset}px)` : ''
  }

  function dismiss() {
    if (closing.current) return
    closing.current = true
    const el = panel.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      close()
      return
    }
    el.animate(
      [{ transform: el.style.transform || 'translateY(0)' }, { transform: 'translateY(100%)' }],
      { duration: 220, easing: 'ease-in', fill: 'forwards' },
    ).finished.then(close, close)
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (closing.current || !event.isPrimary || event.button !== 0) return
    dragged.current = false
    drag.current = { pointerId: event.pointerId, startY: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    const offset = event.clientY - drag.current.startY
    if (Math.abs(offset) > 8) dragged.current = true
    movePanel(offset)
  }

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    movePanel(0)
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    const offset = event.clientY - drag.current.startY
    drag.current = null
    if (offset >= 64) dismiss()
    else movePanel(0)
  }

  return (
    <div className="scrim body-scrim" onClick={dismiss}>
      <div ref={panel} className="sheet food-sheet" role="dialog" aria-modal="true" aria-label="Food log"
        onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') dismiss() }}>
        <button className="food-sheet-handle" type="button" aria-label="Close food log"
          onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}
          onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
          onClick={event => { if (event.detail === 0 || !dragged.current) dismiss() }}>
          <span className="grab" aria-hidden="true" />
        </button>
        <div className="food-sheet-content">
          <Food today={today} s={s} target={target} />
        </div>
      </div>
    </div>
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
  const [scanning, setScanning] = useState(false)
  const [branded, setBranded] = useState<{ query: string; rows: FoodRow[]; failed?: boolean }>()
  const scanCode = useCallback((code: string) => {
    setQ(code)
    setScanning(false)
  }, [])
  const [name, setName] = useState(''), [k, setK] = useState('')
  useEffect(() => { loadFoods().then(() => setReady(true)).catch(() => setReady(false)) }, [])
  const results = useMemo(() => ready && q.trim() ? searchFoods(q) : [], [q, ready])
  const kn = parseInt(k, 10)
  const query = q.trim()
  const barcode = isBarcode(query)
  useEffect(() => {
    if (scanning || query.length < 2) return
    let current = true
    const timer = window.setTimeout(async () => {
      try {
        const rows = barcode ? [await lookupBarcode(query)].filter((row): row is FoodRow => row !== undefined)
          : await searchBrandedFoods(query)
        if (current) {
          setBranded({ query, rows })
          if (barcode && rows[0]) setHit(rows[0])
        }
      } catch {
        if (current) setBranded({ query, rows: [], failed: true })
      }
    }, barcode ? 0 : 220)
    return () => { current = false; window.clearTimeout(timer) }
  }, [barcode, query, scanning])
  const catalogProducts = branded?.query === query ? branded.rows : []
  const legacyProducts = ready && query && !barcode ? searchFoods(query, true) : []
  const productResults = [...catalogProducts, ...legacyProducts]
  const productsPending = query.length >= 2 && branded?.query !== query
  const searchKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const key = searchKey(query)
  // Recent: the last distinct foods you logged, newest first.
  const recent = useMemo(() => {
    const seen = new Set<string>(), out: FoodItem[] = []
    for (const d of Object.keys(s.food || {}).sort().reverse()) for (const f of [...(s.food![d] || [])].reverse()) { if (!seen.has(f.name)) { seen.add(f.name); out.push(f) } }
    return out
  }, [s.food])

  const matchingRecent = (key ? recent.filter(item => searchKey(item.name).includes(key)) : recent).slice(0, 8)

  if (scanning) return <FoodScanner onCode={scanCode} onBack={() => setScanning(false)} />

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
      <button className="pill ghost" onClick={() => setScanning(true)}>Scan barcode</button>
      <input className="name" type="search" placeholder={ready ? 'Search a food or enter a barcode' : 'Loading foods…'} value={q} onChange={e => setQ(e.target.value)} autoComplete="off" autoCorrect="off" aria-label="Search foods" enterKeyHint="search" />
      <div className="flist">
        {matchingRecent.length > 0 && (
          <>
            <div className="lab">Recent · tap to repeat in {meal}</div>
            {matchingRecent.map(f => <button key={f.id} className="frow" onClick={() => actions.addFood(today, meal, f.name, f.kcal, { p: f.p, c: f.c, f: f.f, grams: f.grams })}><span><b>{f.name}</b><span className="small">{f.kcal} kcal{f.grams != null ? ` · ${f.grams} g` : ''}</span></span><span aria-hidden>+</span></button>)}
          </>
        )}
        {query && results.length > 0 && (
          <>
            <div className="lab">Basic foods</div>
            {results.map((r, i) => (
              <button key={i} className="frow" onClick={() => setHit(r)}><span><b>{tidy(r[0])}</b><span className="small">{servL(r)} · {Math.round(r[1] * servingAmount(r) / 100)} kcal</span></span><span aria-hidden>›</span></button>
            ))}
          </>
        )}
        {productResults.length > 0 && (
          <>
            <div className="lab">Branded foods</div>
            {productResults.map((row, index) => (
              <button key={index} className="frow" onClick={() => setHit(row)}><span><b>{tidy(row[0])}</b><span className="small">{servL(row)} · {Math.round(row[1] * servingAmount(row) / 100)} kcal</span></span><span aria-hidden>›</span></button>
            ))}
          </>
        )}
        {query && !results.length && !matchingRecent.length && !productResults.length && (
          <p className="small" role="status">
            {productsPending || !ready ? 'Searching…' : branded?.query === query && branded.failed
              ? 'Barcode lookup is unavailable. Try searching by product name.'
              : barcode ? 'No product found for this barcode. Search by name or use Quick Add.'
                : 'No matches. Try fewer words, or use Quick Add.'}
          </p>
        )}
      </div>
      {quick ? (
        <form className="addfood" onSubmit={e => { e.preventDefault(); if (kn > 0) { actions.addFood(today, meal, name.trim() || meal, kn); setName(''); setK(''); setQuick(false) } }}>
          <div className="formrow2">
            <input className="name" placeholder="What (optional)" value={name} onChange={e => setName(e.target.value)} autoComplete="off" maxLength={60} />
            <input className="name kc" inputMode="numeric" placeholder="kcal" value={k} onChange={e => setK(e.target.value.replace(/\D/g, ''))} aria-label="Calories" />
          </div>
          <button className="pill big" disabled={!(kn > 0)}>Add</button>
        </form>
      ) : <button className="link" onClick={() => { setName(query.slice(0, 60)); setQuick(true) }}>Quick add calories</button>}
    </>
  )
}

function Portion({ row, meal, back, add }: { row: FoodRow; meal: Meal; back: () => void; add: (kcal: number, extra: { p: number; c: number; f: number; grams?: number }) => void }) {
  const units = portionUnits(row)
  const [unit, setUnit] = useState(0)
  const [quantity, setQuantity] = useState('1')
  const q = Number(quantity)
  const amount = q * units[unit].amount
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 100_000
  const at = (nutrient: number) => Math.round(nutrient * (valid ? amount : 0) / 100)

  function changeUnit(next: number) {
    if (valid) setQuantity((amount / units[next].amount).toFixed(6).replace(/\.?0+$/, ''))
    setUnit(next)
  }
  return (
    <>
      <div className="row between"><div className="lab">{meal}</div><button className="link" onClick={back}>Back</button></div>
      <h2 className="cond">{shortName(row[0])}</h2>
      <div className="strip light">
        <div><div className="n">{at(row[1])}</div><div className="lab">kcal</div></div>
        <div><div className="n">{at(row[2])}g</div><div className="lab">Protein</div></div>
        <div><div className="n">{at(row[3])}g</div><div className="lab">Carbs</div></div>
      </div>
      <form onSubmit={event => {
        event.preventDefault()
        if (valid) add(at(row[1]), { p: at(row[2]), c: at(row[3]), f: at(row[4]), grams: row[7] ? undefined : Math.round(amount * 100) / 100 })
      }}>
        <div className="portion-fields">
          <label className="field"><span className="lab">Quantity</span>
            <input inputMode="decimal" value={quantity} onChange={event => {
              const value = event.target.value.replace(',', '.')
              if (/^\d*\.?\d*$/.test(value)) setQuantity(value)
            }} />
          </label>
          <label className="field"><span className="lab">Unit</span>
            <select value={unit} onChange={event => changeUnit(Number(event.target.value))}>
              {units.map((measure, index) => <option key={measure.label} value={index}>{measure.label}</option>)}
            </select>
          </label>
        </div>
        <p className="small">1 serving = {servL(row)}{row[6] > 0 ? ` · ${row[6]} g` : ''}</p>
        <button className="pill big" type="submit" disabled={!valid}>{valid ? `Add ${at(row[1])} kcal` : 'Add food'}</button>
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
