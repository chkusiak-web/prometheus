import { useState } from 'react'
import { actions, getDay, PILLARS, useStore, type Pillar } from './store'
import { fromHHMM, lenLab, tlab, toHHMM } from './date'

export type SheetMode =
  | { kind: 'add'; day: string; start: number }
  | { kind: 'edit'; id: string }
  | { kind: 'actions'; id: string }

const LENS = [15, 30, 45, 60, 90, 120]

export default function BlockSheet({ day, mode, setMode }: { day: string; mode: SheetMode; setMode: (m: SheetMode | null) => void }) {
  const close = () => setMode(null)
  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        {mode.kind === 'actions' ? <Actions day={day} id={mode.id} setMode={setMode} /> : <Form day={mode.kind === 'add' ? mode.day : day} mode={mode} close={close} />}
      </div>
    </div>
  )
}

function Actions({ day, id, setMode }: { day: string; id: string; setMode: (m: SheetMode | null) => void }) {
  const b = useStore(s => getDay(s, day).blocks.find(x => x.id === id))
  const [moving, setMoving] = useState(false)
  if (!b) return null
  const close = () => setMode(null)
  return (
    <>
      <div className="lab">{PILLARS.find(p => p.id === b.pillar)!.name} · {tlab(b.start, true)} · {lenLab(b.len)}</div>
      <h2 className="cond">{b.name}</h2>
      {moving ? (
        <label className="field">Start time
          <input type="time" step={900} defaultValue={toHHMM(b.start)} autoFocus onChange={e => e.target.value && actions.updateBlock(day, id, { start: fromHHMM(e.target.value) })} />
          <button className="pill" onClick={close}>Done</button>
        </label>
      ) : (
        <div className="acts">
          <button className="pill big" onClick={() => { actions.toggle(day, id); close() }}>{b.done ? 'Undo' : 'Done'}</button>
          <div className="grid3">
            <button onClick={() => setMoving(true)}>Move</button>
            <button onClick={() => actions.extend(day, id, 15)}>Extend +15</button>
            <button onClick={() => { actions.duplicate(day, id); close() }}>Duplicate</button>
            <button onClick={() => setMode({ kind: 'edit', id })}>Edit</button>
            <button className="danger" onClick={() => { actions.remove(day, id); close() }}>Delete</button>
          </div>
        </div>
      )}
    </>
  )
}

function Form({ day, mode, close }: { day: string; mode: SheetMode; close: () => void }) {
  const existing = useStore(s => mode.kind === 'edit' ? getDay(s, day).blocks.find(x => x.id === mode.id) : undefined)
  const [name, setName] = useState(existing?.name ?? '')
  const [pillar, setPillar] = useState<Pillar>(existing?.pillar ?? 'mind')
  const [start, setStart] = useState(existing?.start ?? (mode.kind === 'add' ? mode.start : 9 * 60))
  const [len, setLen] = useState(existing?.len ?? 30)
  const save = () => {
    const n = name.trim(); if (!n) return
    if (existing) actions.updateBlock(day, existing.id, { name: n, pillar, start, len })
    else actions.addBlock(day, { name: n, pillar, start, len })
    close()
  }
  return (
    <form onSubmit={e => { e.preventDefault(); save() }}>
      <h2 className="cond">{existing ? 'Edit block' : 'Add block'}</h2>
      <input className="name" placeholder="What is it? e.g. Read 20 pages" value={name} onChange={e => setName(e.target.value)} autoFocus autoComplete="off" autoCorrect="off" maxLength={80} />
      <div className="seg" role="radiogroup" aria-label="Pillar">
        {PILLARS.map(p => (
          <button type="button" key={p.id} role="radio" aria-checked={pillar === p.id} className={pillar === p.id ? 'on' : ''} style={{ ['--c' as string]: p.color }} onClick={() => setPillar(p.id)}>{p.name}</button>
        ))}
      </div>
      <div className="formrow">
        <label className="field">Start<input type="time" step={900} value={toHHMM(start)} onChange={e => e.target.value && setStart(fromHHMM(e.target.value))} /></label>
      </div>
      <div className="seg lens" role="radiogroup" aria-label="Length">
        {LENS.map(l => <button type="button" key={l} role="radio" aria-checked={len === l} className={len === l ? 'on' : ''} onClick={() => setLen(l)}>{lenLab(l).replace(' min', 'm')}</button>)}
      </div>
      <button className="pill big" type="submit" disabled={!name.trim()}>{existing ? 'Save' : 'Add'}</button>
    </form>
  )
}
