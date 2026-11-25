import { useState } from 'react'
import { actions, getDay, useStore } from './store'
import { useNow } from './useNow'
import { ARCH } from './quests'
import { LEN, rotation, suggestion, traitScores, full, type Quest } from './soul'
import { nextSlot } from './Today'
import Sky from './Sky'

const SIZE = { S: 'Small', M: 'Medium', L: 'Large' }

export default function Soul() {
  const { today, mins } = useNow()
  const s = useStore(x => x)
  const day = getDay(s, today)
  const quests = day.blocks.filter(b => b.pillar === 'soul')
  const [qi, setQi] = useState(0)
  const [trait, setTrait] = useState<string | null>(null)
  const [tracing, setTracing] = useState(false)
  const sc = traitScores(s, today)
  const sug = suggestion(s, today)
  const tri = (day.triangle || []).map(full)

  const add = (t: string, q: Quest) => actions.addBlock(today, { name: q.text, pillar: 'soul', trait: t, start: nextSlot(day.blocks, mins), len: LEN[q.size] })
  const cur = quests[Math.min(qi, quests.length - 1)]

  return (
    <main className="screen soul">
      <h1 className="cond pageh">Soul</h1>

      {cur ? (
        <section className="quest">
          <div className="row between"><span className="lab">{cur.trait || 'Soul'} · Quest {Math.min(qi, quests.length - 1) + 1} of {quests.length}</span>
            {quests.length > 1 && <span className="row"><button className="mini" aria-label="Previous quest" onClick={() => setQi((qi - 1 + quests.length) % quests.length)}>‹</button><button className="mini" aria-label="Next quest" onClick={() => setQi((qi + 1) % quests.length)}>›</button></span>}</div>
          <div className={'cond qtext' + (cur.name.length > 22 ? ' long' : '') + (cur.done ? ' done' : '')}>{cur.name}</div>
          <button className="pill" onClick={() => actions.toggle(today, cur.id)}>{cur.done ? 'Undo' : 'Done'}</button>
        </section>
      ) : (
        <section className="quest">
          <span className="lab">Today's quest · {sug.trait}</span>
          <div className={"cond qtext" + (sug.quest.text.length > 22 ? " long" : "")}>{sug.quest.text}</div>
          <div className="row"><button className="pill" onClick={() => add(sug.trait, sug.quest)}>+ Add to today</button><button className="pill ghost" onClick={() => setTrait(sug.trait)}>Other quests</button></div>
        </section>
      )}

      <section className="skycard">
        <div className="row between">
          <span className="lab">{tracing ? 'Tap the traits you lived today' : 'Last 7 days · tap a trait for quests'}</span>
          <button className="pill light" onClick={() => setTracing(!tracing)}>{tracing ? 'Done' : tri.length >= 3 ? 'Edit triangle' : 'Trace today'}</button>
        </div>
        <Sky picks={tri} glow={sc} onTap={t => tracing ? actions.setTriangle(today, tri.includes(t) ? tri.filter(x => x !== t) : [...tri, t]) : setTrait(t)} />
        <p className="small">{tri.length >= 3 ? `Today's triangle: ${tri.length} traits` : tri.length ? 'Pick 3 or more to count' : 'Brighter stars = more lived this week'}</p>
      </section>

      {trait && <TraitSheet trait={trait} score={sc[trait]} today={today} add={q => add(trait, q)} close={() => setTrait(null)} />}
    </main>
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
