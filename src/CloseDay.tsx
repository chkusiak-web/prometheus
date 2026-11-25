import { useState } from 'react'
import { actions, getDay, pillarOf, useStore } from './store'
import { addDays, headDate, lenLab, tlab } from './date'
import BlockSheet, { type SheetMode } from './BlockSheet'

// The 12 Soul traits, in their 4 archetype groups (from the prototype's sky).
const TRAITS = ['Order', 'Purpose', 'Blessing', 'Discipline', 'Courage', 'Decisive', 'Learning', 'Self-aware', 'Mastery', 'Connection', 'Presence', 'Creativity']
const R = 120
const pos = (i: number) => { const a = (i * 30 - 90 + 15) * Math.PI / 180; return [R * Math.cos(a), R * Math.sin(a)] }

export default function CloseDay({ day, onDone }: { day: string; onDone: () => void }) {
  const saved = useStore(s => getDay(s, day))
  const [step, setStep] = useState(0)
  const [rating, setRating] = useState(saved.rating ?? 0)
  const [picks, setPicks] = useState<string[]>(saved.triangle ?? [])
  const tomorrow = addDays(day, 1)
  const tBlocks = useStore(s => getDay(s, tomorrow).blocks)
  const [sheet, setSheet] = useState<SheetMode | null>(null)
  const undone = saved.blocks.filter(b => !b.done)

  const finish = () => { actions.closeDay(day, rating, picks); setStep(3) }
  const carry = () => undone.forEach(b => actions.addBlock(tomorrow, { name: b.name, pillar: b.pillar, start: b.start, len: b.len }))

  return (
    <div className="flow" role="dialog" aria-modal="true" aria-label="Close the day">
      <div className="flow-top">
        <button className="x" aria-label="Close" onClick={onDone}>✕</button>
        <div className="dots">{[0, 1, 2].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      </div>

      {step === 0 && (
        <div className="step">
          <div className="lab">Close the day · {headDate(day)}</div>
          <h1 className="cond">Did you live fully?</h1>
          <div className="rate">
            {[1, 2, 3, 4, 5].map(n => <button key={n} className={rating === n ? 'on' : ''} aria-pressed={rating === n} onClick={() => setRating(n)}>{n}</button>)}
          </div>
          <div className="rate-l small"><span>Not really</span><span>Fully</span></div>
          <button className="pill big" disabled={!rating} onClick={() => setStep(1)}>Next</button>
        </div>
      )}

      {step === 1 && (
        <div className="step">
          <div className="lab">Soul triangle</div>
          <h1 className="cond">Where did you show up?</h1>
          <p className="small">Tap 3 or more traits you lived today.</p>
          <svg className="sky" viewBox="-170 -170 340 340" role="group" aria-label="Traits">
            {picks.length > 1 && <polygon points={TRAITS.filter(t => picks.includes(t)).map(t => pos(TRAITS.indexOf(t)).join(',')).join(' ')} fill="rgba(255,176,0,.18)" stroke="var(--gold)" strokeWidth="3" strokeLinejoin="round" />}
            {TRAITS.map((t, i) => {
              const [x, y] = pos(i), on = picks.includes(t)
              return (
                <g key={t} role="checkbox" aria-checked={on} aria-label={t} tabIndex={0} className="star"
                  onClick={() => setPicks(p => on ? p.filter(q => q !== t) : [...p, t])}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicks(p => on ? p.filter(q => q !== t) : [...p, t]) } }}>
                  <circle cx={x} cy={y} r="26" fill="transparent" />
                  <circle cx={x} cy={y} r={on ? 10 : 6} fill={on ? 'var(--gold)' : '#6F6A63'} />
                  <text x={x} y={y + (y > 0 ? 28 : -18)} textAnchor="middle" className={on ? 'on' : ''}>{t}</text>
                </g>
              )
            })}
          </svg>
          <button className="pill big" disabled={picks.length < 3} onClick={() => setStep(2)}>Next</button>
          <button className="link" onClick={() => setStep(2)}>Skip</button>
        </div>
      )}

      {step === 2 && (
        <div className="step">
          <div className="lab">Tomorrow · {headDate(tomorrow)}</div>
          <h1 className="cond">Plan tomorrow</h1>
          <div className="tlist">
            {tBlocks.length ? tBlocks.map(b => (
              <button key={b.id} className="titem" style={{ ['--c' as string]: pillarOf(b.pillar).color }} onClick={() => setSheet({ kind: 'actions', id: b.id })}>
                <span className="tdot" /><span className="tname">{b.name}</span><span className="small">{tlab(b.start, true)} · {lenLab(b.len)}</span>
              </button>
            )) : <p className="small">Nothing planned yet. Aim for one Mind, one Body and one Soul.</p>}
          </div>
          <div className="row">
            <button className="pill ghost" onClick={() => setSheet({ kind: 'add', day: tomorrow, start: tBlocks.length ? tBlocks[tBlocks.length - 1].start + tBlocks[tBlocks.length - 1].len : 9 * 60 })}>+ Add</button>
            {undone.length > 0 && !tBlocks.length && <button className="pill ghost" onClick={carry}>Move {undone.length} unfinished to tomorrow</button>}
          </div>
          <button className="pill big" onClick={finish}>Done</button>
          {sheet && <BlockSheet day={tomorrow} mode={sheet} setMode={setSheet} />}
        </div>
      )}

      {step === 3 && (
        <div className="step end" onClick={onDone}>
          <h1 className="cond">Sleep well.</h1>
          <button className="pill big light" onClick={onDone}>Close</button>
        </div>
      )}
    </div>
  )
}
