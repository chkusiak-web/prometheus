import { useRef, useState } from 'react'
import { actions, getDay, HERO_QUESTS, HERO_SPOILS, PILLARS, pillarOf, uid, useStore, type Goal, type Pillar } from './store'
import { useNow } from './useNow'
import { addDays, weekOf, dayLetter, lenLab } from './date'
import { heroOf, monday, scores } from './hero'
import { nextSlot } from './Today'

type Sheet = 'hero' | 'settings' | { goal: Goal | null } | null
const pc = (x: number) => Math.round(x * 100) + '%'
/** Flame height in px at full size, and its scale for a score. */
const FH = 264
const fs = (x: number) => 0.55 + 0.45 * x

export default function HeroTab() {
  const { today, mins } = useNow()
  const s = useStore(x => x)
  const sc = scores(s, today)
  const h = heroOf(s, today)
  const last = scores(s, addDays(monday(today), -1))
  const delta = Math.round((sc.overall - last.overall) * 100)
  const [sheet, setSheet] = useState<Sheet>(null)
  const wk = weekOf(today)
  const goals = s.goals || []
  const goalDone = (g: Goal) => wk.filter(k => k <= today).reduce((t, k) => t + getDay(s, k).blocks.filter(b => b.done && b.goalId === g.id).length, 0)
  const toggleDay = (i: number) => actions.setHero(monday(today), { ...h, done: h.done.map((d, j) => j === i ? !d : d) })

  return (
    <main className="screen hero">
      <div className="row between"><h1 className="cond pageh">Hero</h1><button className="pill" aria-label="Settings" onClick={() => setSheet('settings')}>⚙</button></div>

      <div className="tiles">
        {([['Mind', sc.mind, 'var(--cobalt)', pc(sc.mind)], ['Body', sc.body, 'var(--ember)', pc(sc.body)], ['Soul', sc.soul, 'var(--gold)', pc(sc.soul)], ['Hero', sc.hero, 'var(--green)', `${sc.heroDays}/7`]] as const).map(([n, v, c, badge]) => {
          const inner = <><i className="hfill" style={{ height: `${Math.max(v, 0.06) * 100}%` }} /><span className="badge">{badge}</span><span className="cond nm">{n}</span></>
          const st = { ['--c' as string]: c }
          return n === 'Hero'
            ? <button key={n} className="htile" style={st} aria-label={`Hero ${badge}`} onClick={() => setSheet('hero')}>{inner}</button>
            : <div key={n} className="htile" style={st} aria-label={`${n} ${badge}`}>{inner}</div>
        })}
      </div>

      <section className="fire" aria-label={`Overall ${pc(sc.overall)}`}>
        <div className="fire-h">
          <span className="n big">{Math.round(sc.overall * 100)}</span>
          <span className="fire-m"><span className="lab">Overall this week</span><span className={'delta' + (delta < 0 ? ' down' : '')}>{delta >= 0 ? '+' : ''}{delta}% vs last week</span></span>
        </div>
        <div className="fire-stage">
          <i className="lastwk" style={{ bottom: `${FH * fs(last.overall)}px` }} aria-hidden />
          <div className="flame" style={{ ['--s' as string]: String(fs(sc.overall)) }} />
        </div>
      </section>

      <section className="panel">
        <div className="lab">Weekly Hero Quest</div>
        <button className="cond hq" onClick={() => setSheet('hero')}>{h.name}</button>
        <div className="hdays">{wk.map((k, i) => <button key={k} disabled={k > today} className={h.done[i] ? 'on' : k === today ? 'now' : ''} aria-label={`${dayLetter(k)}: ${h.done[i] ? 'done' : 'not done'}`} onClick={() => toggleDay(i)}>{h.done[i] ? '✓' : dayLetter(k)}</button>)}</div>
        <div className="small">Spoil: {h.spoil}{sc.heroDays === 7 ? ' · earned!' : ''}</div>
      </section>

      <section className="panel">
        <div className="row between"><div className="lab">Long-term goals</div><button className="pill" onClick={() => setSheet({ goal: null })}>New goal</button></div>
        {!goals.length && <p className="small">Add things you want to do every week, like "Chinese, 30 min, daily".</p>}
        {goals.map(g => {
          const n = goalDone(g), on = getDay(s, today).blocks.some(b => b.goalId === g.id)
          return (
            <div key={g.id} className="goal" style={{ ['--c' as string]: pillarOf(g.pillar).color }}>
              <button className="goal-main" onClick={() => setSheet({ goal: g })}><b>{g.name}</b><span className="small">{pillarOf(g.pillar).name} · {lenLab(g.len)} · {n}/{g.freq} this week</span></button>
              {on ? <span className="added" aria-label="On today">✓</span> : <button className="mini dark" aria-label={`Add ${g.name} to today`} onClick={() => actions.addBlock(today, { name: g.name, pillar: g.pillar, goalId: g.id, start: nextSlot(getDay(s, today).blocks, mins), len: g.len })}>+</button>}
            </div>
          )
        })}
      </section>

      {sheet && (
        <div className="scrim" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            {sheet === 'hero' && <HeroSheet today={today} close={() => setSheet(null)} />}
            {sheet === 'settings' && <Settings />}
            {typeof sheet === 'object' && sheet && 'goal' in sheet && <GoalForm goal={sheet.goal} close={() => setSheet(null)} />}
          </div>
        </div>
      )}
    </main>
  )
}

function HeroSheet({ today, close }: { today: string; close: () => void }) {
  const s = useStore(x => x)
  const h = heroOf(s, today), wk = monday(today)
  const [own, setOwn] = useState('')
  const started = !!s.hero?.[wk]
  // 1 free swap a week, no paid swaps. Picking before you've started the week doesn't count.
  const canSwap = !started || h.swaps < 1
  const pick = (name: string) => { actions.setHero(wk, { ...h, name, swaps: started && name !== h.name ? h.swaps + 1 : h.swaps }); close() }
  const list = HERO_QUESTS.filter(q => q !== h.name)
  return (
    <>
      <div className="lab">Weekly Hero Quest · {canSwap ? (started ? '1 free swap left' : 'Pick this week') : 'Swap used this week'}</div>
      <h2 className="cond">{h.name}</h2>
      <label className="field col">Spoil
        <select value={h.spoil} onChange={e => actions.setHero(wk, { ...h, spoil: e.target.value })}>{[...new Set([h.spoil, ...HERO_SPOILS])].map(x => <option key={x}>{x}</option>)}</select>
      </label>
      {canSwap && <>
        {list.slice(0, 4).map(q => <button key={q} className="qrow" onClick={() => pick(q)}><b>{q}</b><span aria-hidden>›</span></button>)}
        <form className="qrow own" onSubmit={e => { e.preventDefault(); if (own.trim()) pick(own.trim()) }}>
          <input className="name" placeholder="Type your own" value={own} onChange={e => setOwn(e.target.value)} maxLength={60} />
          <button className="mini dark" aria-label="Use my own quest" disabled={!own.trim()}>›</button>
        </form>
        {list.slice(4).map(q => <button key={q} className="qrow" onClick={() => pick(q)}><b>{q}</b><span aria-hidden>›</span></button>)}
      </>}
    </>
  )
}

function GoalForm({ goal, close }: { goal: Goal | null; close: () => void }) {
  const [name, setName] = useState(goal?.name ?? '')
  const [pillar, setPillar] = useState<Pillar>(goal?.pillar ?? 'mind')
  const [len, setLen] = useState(goal?.len ?? 30)
  const [freq, setFreq] = useState(goal?.freq ?? 3)
  return (
    <form onSubmit={e => { e.preventDefault(); if (name.trim()) { actions.saveGoal({ id: goal?.id ?? uid(), name: name.trim(), pillar, len, freq }); close() } }}>
      <h2 className="cond">{goal ? 'Edit goal' : 'New goal'}</h2>
      <input className="name" placeholder="e.g. Chinese" value={name} onChange={e => setName(e.target.value)} autoFocus={!goal} maxLength={60} />
      <div className="seg" role="radiogroup" aria-label="Pillar">{PILLARS.map(p => <button type="button" key={p.id} role="radio" aria-checked={pillar === p.id} className={pillar === p.id ? 'on' : ''} style={{ ['--c' as string]: p.color }} onClick={() => setPillar(p.id)}>{p.name}</button>)}</div>
      <div className="seg lens" role="radiogroup" aria-label="Length">{[15, 30, 45, 60, 90, 120].map(l => <button type="button" key={l} role="radio" aria-checked={len === l} className={len === l ? 'on' : ''} onClick={() => setLen(l)}>{lenLab(l).replace(' min', 'm')}</button>)}</div>
      <div className="stepper"><span>Times a week</span><span className="st-c"><button type="button" aria-label="Fewer" onClick={() => setFreq(Math.max(1, freq - 1))}>−</button><b>{freq >= 7 ? 'Daily' : freq}</b><button type="button" aria-label="More" onClick={() => setFreq(Math.min(7, freq + 1))}>+</button></span></div>
      <button className="pill big" disabled={!name.trim()}>Save</button>
      {goal && <button type="button" className="link" onClick={() => { if (confirm(`Delete "${goal.name}"?`)) { actions.removeGoal(goal.id); close() } }}>Delete goal</button>}
    </form>
  )
}

function Settings() {
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const exp = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([actions.exportAll()], { type: 'application/json' }))
    a.download = `prometheus-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const imp = async (f?: File) => {
    if (!f) return
    if (!confirm('Replace everything in the app with this backup?')) return
    try { actions.importAll(await f.text()); setMsg('Backup restored.') } catch { setMsg("That file isn't a Prometheus backup.") }
  }
  return (
    <>
      <h2 className="cond">Settings</h2>
      <div className="lab">Back up</div>
      <p className="small">Your data lives on this device only (sync comes later). Save a copy now and then.</p>
      <div className="row"><button className="pill" onClick={exp}>Save backup</button><button className="pill ghost" onClick={() => file.current?.click()}>Restore</button></div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => imp(e.target.files?.[0])} />
      {msg && <p className="small">{msg}</p>}
      <div className="lab">Weight plan</div>
      <p className="small">Goal, pace, rewards and the Do it now list are on Body › Weight plan › Edit plan.</p>
      <a className="link" href="./prototype/">Open the design prototype ›</a>
    </>
  )
}
