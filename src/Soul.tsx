import { useState } from 'react'
import { actions, getDay, useStore } from './store'
import { useNow } from './useNow'
import { ARCH, short, TRAITS } from './quests'
import { LEN, rotation, suggestion, traitScores, type Quest } from './soul'
import { scores } from './hero'
import { tlab } from './date'
import { nextSlot } from './Today'

const SIZE = { S: 'Small', M: 'Medium', L: 'Large' }

export default function Soul() {
  const { today, mins } = useNow()
  const s = useStore(x => x)
  const day = getDay(s, today)
  const quests = day.blocks.filter(b => b.pillar === 'soul')
  const [trait, setTrait] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<string[]>([])
  const sc = traitScores(s, today)
  const sug = suggestion(s, today)

  const add = (t: string, q: Quest) => actions.addBlock(today, { name: q.text, pillar: 'soul', trait: t, start: nextSlot(day.blocks, mins), len: LEN[q.size] })

  const open = quests.filter(b => !b.done && !skipped.includes(b.id))
  const cur = open[0]
  const soulPct = Math.round(scores(s, today).soul * 100)
  const v = Object.fromEntries(TRAITS.map(t => [t, Math.min(1, (sc[t] || 0) / 3)]))

  return (
    <main className="screen soul">
      <h1 className="cond pageh">Soul</h1>

      {cur ? (
        <section className="quest" key={cur.id}>
          <span className="lab">Quest {quests.indexOf(cur) + 1} of {quests.length}{cur.trait ? ` · ${archOf(cur.trait)} · ${cur.trait}` : ''} · {tlab(cur.start, true)}</span>
          <div className="q">{cur.name}</div>
          <div className="qbtns"><button className="btn" onClick={() => actions.toggle(today, cur.id)}>Done</button><button className="btn ghost" onClick={() => setSkipped([...skipped, cur.id])}>Skip</button></div>
        </section>
      ) : quests.length ? (
        <section className="quest won">
          <span className="lab">Today's quests</span>
          <div className="q">{quests.every(b => b.done) ? "All done. The fire's fed." : 'Nothing else on today.'}</div>
          <span className="small">{quests.filter(b => b.done).length} of {quests.length} done{skipped.length ? <> · <button className="tlink" onClick={() => setSkipped([])}>Show skipped</button></> : ''}</span>
        </section>
      ) : (
        <section className="quest">
          <span className="lab">Today's quest · {archOf(sug.trait)} · {sug.trait}</span>
          <div className="q">{sug.quest.text}</div>
          <div className="qbtns"><button className="btn" onClick={() => add(sug.trait, sug.quest)}>+ Add to today</button><button className="btn ghost" onClick={() => setTrait(sug.trait)}>Other quests</button></div>
        </section>
      )}

      <section className="hearth">
        <div className="soulpct"><div className="n"><span>{soulPct}</span><small>%</small></div><div className="lab">Soul</div></div>
        <SoulSky v={v} weakest={sug.trait} onTap={setTrait} />
      </section>

      {trait && <TraitSheet trait={trait} score={sc[trait]} today={today} add={q => add(trait, q)} close={() => setTrait(null)} />}
    </main>
  )
}

const archOf = (t: string) => ARCH.find(a => a.traits.includes(t))?.n || 'Soul'
const SKR = 118
const sp = (i: number) => { const a = (i * 30 - 90 + 15) * Math.PI / 180; return [SKR * Math.cos(a), SKR * Math.sin(a)] }

/** The prototype's constellation: gold archetype arcs, a glowing shape of the week, and the weakest trait called out in ember. */
function SoulSky({ v, weakest, onTap }: { v: Record<string, number>; weakest: string; onTap: (t: string) => void }) {
  const vals = TRAITS.map(t => v[t] || 0)
  const lo = TRAITS.indexOf(weakest)
  const shape = vals.map((x, i) => { const [px, py] = sp(i), f = 0.15 + 0.85 * x; return `${(px * f).toFixed(1)},${(py * f).toFixed(1)}` }).join(' ')
  return (
    <svg className="soulsky" viewBox="-174 -174 348 348" role="group" aria-label="Your week's constellation. Tap a trait.">
      <defs>
        <filter id="sglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="sglow2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      {ARCH.map((a, k) => {
        const r = 160, a0 = (k * 90 - 90 + 8) * Math.PI / 180, a1 = ((k + 1) * 90 - 90 - 8) * Math.PI / 180, bot = k === 1 || k === 2, [b0, b1] = bot ? [a1, a0] : [a0, a1]
        return (
          <g key={a.n}>
            <path id={`sarc${k}`} d={`M${r * Math.cos(b0)} ${r * Math.sin(b0)}A${r} ${r} 0 0 ${bot ? 0 : 1} ${r * Math.cos(b1)} ${r * Math.sin(b1)}`} fill="none" stroke="#2c2c32" strokeWidth="1.2" />
            <text className="arch" dy={bot ? 10 : -5}><textPath href={`#sarc${k}`} startOffset="50%" textAnchor="middle">{a.n.toUpperCase()}</textPath></text>
          </g>
        )
      })}
      <polygon points={shape} fill="rgba(255,176,0,.10)" stroke="#FFD27A" strokeWidth="1.6" strokeLinejoin="round" filter="url(#sglow)" />
      {TRAITS.map((t, i) => {
        const [x, y] = sp(i), val = vals[i], weak = i === lo, f = 0.15 + 0.85 * val
        return (
          <g key={t} className="st" role="button" tabIndex={0} aria-label={`${t}${weak ? ', weakest this week' : ''}`} onClick={() => onTap(t)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(t) } }}>
            <circle cx={x} cy={y} r="10" fill={weak ? 'var(--ember)' : '#FFB000'} opacity={weak ? 0.5 : 0} filter="url(#sglow2)" />
            <circle cx={x} cy={y} r={1.8 + 2.4 * val} fill={weak ? 'var(--ember)' : '#EDE6D8'} opacity={0.45 + 0.55 * val} />
            <circle cx={x * f} cy={y * f} r="2.4" fill="#FFE7A8" />
            {weak && <text x={x * 0.84} y={y * 0.84 + 4} textAnchor={Math.abs(x) < 16 ? 'middle' : x > 0 ? 'end' : 'start'} className="weak">{short(t)}</text>}
            <circle cx={x} cy={y} r="20" fill="transparent" />
          </g>
        )
      })}
    </svg>
  )
}

function TraitSheet({ trait, score, today, add, close }: { trait: string; score: number; today: string; add: (q: Quest) => void; close: () => void }) {
  const s = useStore(x => x)
  const list = rotation(s, trait)
  const onToday = new Set(getDay(s, today).blocks.filter(b => b.pillar === 'soul').map(b => b.name))
  const [own, setOwn] = useState('')
  const arch = ARCH.find(a => a.traits.includes(trait))!.n
  const row = (q: Quest) => (
    <div key={q.text} className="qrow">
      <span><b>{q.text}</b><span className="small">{q.mine ? 'Yours' : SIZE[q.size]} · {LEN[q.size]} min</span></span>
      {onToday.has(q.text) ? <span className="added" aria-label="On today">✓</span> : <button className="mini dark" aria-label={`Add ${q.text} to today`} onClick={() => add(q)}>+</button>}
    </div>
  )
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div className="lab">{arch} · {score ? `${score} this week` : 'Not yet this week'}</div>
        <h2 className="cond">{trait}</h2>
        {list.slice(0, 4).map(row)}
        <form className="qrow own" onSubmit={e => { e.preventDefault(); const t = own.trim(); if (t) { actions.addMyQuest(trait, t); add({ size: 'M', text: t, mine: true }); setOwn('') } }}>
          <input className="name" placeholder="Add your own" value={own} onChange={e => setOwn(e.target.value)} maxLength={80} />
          <button className="mini dark" aria-label="Add your own quest" disabled={!own.trim()}>+</button>
        </form>
        {list.slice(4).map(row)}
      </div>
    </div>
  )
}
