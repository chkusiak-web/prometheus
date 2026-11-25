import { useEffect, useRef, useState } from 'react'
import { actions, dayStatus, getDay, pillarOf, useStore, type Block } from './store'
import { dayLetter, headDate, lenLab, tlab, weekOf } from './date'
import { useNow } from './useNow'
import BlockSheet, { type SheetMode } from './BlockSheet'
import DoItNow from './DoItNow'

const HOUR = 72 // px per hour on the agenda

const Check = () => <svg width="18" height="18" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>

export default function Today({ onClose }: { onClose: () => void }) {
  const { today, mins } = useNow()
  const days = useStore(s => s.days)
  const day = getDay({ v: 1, days }, today)
  const st = dayStatus(day)
  const [sheet, setSheet] = useState<SheetMode | null>(null)

  const upNext = day.blocks.find(b => !b.done && b.start + b.len > mins) || day.blocks.find(b => !b.done)
  const evening = mins >= 18 * 60

  return (
    <main className="screen today">
      <header className="top">
        <div className="toprow">
          <h1 className="cond">{headDate(today)}</h1>
          <button className="pill light" onClick={onClose}>{day.closedAt ? 'Closed ✓' : 'Close day'}</button>
        </div>
        <div className="week">
          {weekOf(today).map(k => {
            const d = days[k], won = d ? dayStatus(d).won : false
            const cls = k === today ? (won ? 'won' : 'now') : k > today ? 'future' : won ? 'won' : d?.blocks.length ? 'lost' : 'empty'
            return <div key={k} className={'wd ' + cls} aria-label={`${headDate(k)}${won ? ', won' : ''}`}>{won ? <Check /> : dayLetter(k)}</div>
          })}
        </div>
        <div className="pillars" aria-label="Today's progress">
          {(['mind', 'body', 'soul'] as const).map(p => (
            <span key={p} className={'pchip' + (st.has[p] ? ' on' : '')} style={{ ['--c' as string]: pillarOf(p).color }}>{pillarOf(p).name}</span>
          ))}
          <span className="pcount">{st.won ? 'Day won' : `${Math.min(st.count, 3)} of 3`}</span>
        </div>
      </header>

      <DoItNow today={today} />

      {upNext ? (
        <section className="upnext" style={{ background: pillarOf(upNext.pillar).color, color: upNext.pillar === 'soul' ? 'var(--ink)' : '#fff' }}>
          <button className="un-main" onClick={() => setSheet({ kind: 'actions', id: upNext.id })}>
            <div className="lab">Up next · {tlab(upNext.start, true)} · {lenLab(upNext.len)}</div>
            <div className="cond un-name">{upNext.name}</div>
          </button>
          <button className="un-check" aria-label={`Mark ${upNext.name} done`} onClick={() => actions.toggle(today, upNext.id)}><Check /></button>
        </section>
      ) : (
        <section className="upnext empty">
          <div className="lab">Up next</div>
          <div className="cond un-name">{day.blocks.length ? 'All done' : 'Nothing planned'}</div>
          {!day.blocks.length && <p className="small">Add a Mind, a Body and a Soul block to win the day.</p>}
        </section>
      )}

      {evening && !day.closedAt && (
        <button className="closecard" onClick={onClose}>
          <span><span className="lab">Tonight</span><span className="cond">Close the day</span></span><span aria-hidden>›</span>
        </button>
      )}

      <section className="agenda">
        <div className="ag-head"><div className="lab">Today</div><button className="pill" onClick={() => setSheet({ kind: 'add', day: today, start: nextSlot(day.blocks, mins) })}>+ Today</button></div>
        <Timeline blocks={day.blocks} mins={mins} onTap={b => setSheet({ kind: 'actions', id: b.id })} onToggle={b => actions.toggle(today, b.id)} />
      </section>

      {sheet && <BlockSheet day={today} mode={sheet} setMode={setSheet} />}
    </main>
  )
}

/** First 15-min slot after now and after the last block that's still ahead. */
export function nextSlot(blocks: Block[], mins: number) {
  let s = Math.ceil(mins / 15) * 15
  for (const b of blocks) if (b.start + b.len > s && b.start < s + 30) s = b.start + b.len
  return Math.min(s, 23 * 60 + 45)
}

function Timeline({ blocks, mins, onTap, onToggle }: { blocks: Block[]; mins: number; onTap: (b: Block) => void; onToggle: (b: Block) => void }) {
  const first = Math.min(7 * 60, ...blocks.map(b => b.start), mins - 60)
  const last = Math.max(22 * 60, ...blocks.map(b => b.start + b.len), mins + 60)
  const h0 = Math.max(0, Math.floor(first / 60)), h1 = Math.min(28, Math.ceil(last / 60))
  const y = (m: number) => (m - h0 * 60) / 60 * HOUR
  const ref = useRef<HTMLDivElement>(null)
  // Open scrolled to an hour before now.
  useEffect(() => { ref.current?.scrollTo({ top: Math.max(0, y(mins) - HOUR) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Side-by-side lanes for overlapping blocks.
  const lanes: { b: Block; lane: number; of: number }[] = []
  let group: { b: Block; lane: number }[] = [], groupEnd = -1
  const flush = () => { const of = Math.max(...group.map(g => g.lane)) + 1; group.forEach(g => lanes.push({ ...g, of })); group = [] }
  for (const b of blocks) {
    if (b.start >= groupEnd && group.length) flush()
    const used = new Set(group.filter(g => g.b.start + g.b.len > b.start).map(g => g.lane))
    let lane = 0; while (used.has(lane)) lane++
    group.push({ b, lane }); groupEnd = Math.max(groupEnd, b.start + b.len)
  }
  if (group.length) flush()

  return (
    <div className="tl" ref={ref}>
      <div className="tl-in" style={{ height: (h1 - h0) * HOUR }}>
        {Array.from({ length: h1 - h0 + 1 }, (_, i) => (
          <div key={i} className="hr" style={{ top: i * HOUR }}><span>{tlab((h0 + i) * 60, true).replace(' AM', 'a').replace(' PM', 'p')}</span></div>
        ))}
        {mins >= h0 * 60 && mins <= h1 * 60 && <div className="nowl" style={{ top: y(mins) }} />}
        {lanes.map(({ b, lane, of }) => {
          const c = pillarOf(b.pillar).color
          return (
            <div key={b.id} className={'blk' + (b.done ? ' done' : '') + (b.len < 30 ? ' slim' : '')}
              style={{ top: y(b.start) + 1, height: Math.max(22, b.len / 60 * HOUR - 3), left: `calc(48px + (100% - 52px) * ${lane / of})`, width: `calc((100% - 52px) / ${of} - 4px)`, ['--c' as string]: c, color: b.pillar === 'soul' && !b.done ? 'var(--ink)' : undefined }}>
              <button className="blk-main" onClick={() => onTap(b)}><span className="blk-name">{b.name}</span><span className="blk-len">{lenLab(b.len)}</span></button>
              <button className="blk-chk" aria-label={(b.done ? 'Undo ' : 'Done: ') + b.name} onClick={() => onToggle(b)}>{b.done ? <Check /> : <i />}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
