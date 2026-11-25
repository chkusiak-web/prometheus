import { useState } from 'react'
import { actions, getDay, pillarOf, useStore } from './store'
import { addDays, headDate, lenLab, tlab } from './date'
import BlockSheet, { type SheetMode } from './BlockSheet'
import Sky from './Sky'
import { full } from './soul'

export default function CloseDay({ day, onDone }: { day: string; onDone: () => void }) {
  const saved = useStore(s => getDay(s, day))
  const [step, setStep] = useState(0)
  const [rating, setRating] = useState(saved.rating ?? 0)
  const [picks, setPicks] = useState<string[]>((saved.triangle ?? []).map(full))
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
          <Sky picks={picks} onTap={t => setPicks(p => p.includes(t) ? p.filter(q => q !== t) : [...p, t])} />
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
