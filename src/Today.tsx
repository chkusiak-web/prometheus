import { useEffect, useRef, useState } from 'react'
import { actions, dayStatus, getDay, pillarOf, useStore, type Block } from './store'
import { dayLetter, headDate, lenLab, tlab, weekOf } from './date'
import { useNow } from './useNow'
import BlockSheet, { type SheetMode } from './BlockSheet'
import { TodayBodySession } from './BodyWeek'
import DoItNow from './DoItNow'
import { heroOf, monday } from './hero'

const HOUR = 96 // px per hour on the agenda, as in the prototype

const Check = () => <svg width="18" height="18" viewBox="0 0 12 12"><path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>

export default function Today({ onClose }: { onClose: () => void }) {
  const { today, mins } = useNow()
  const days = useStore(s => s.days)
  const day = getDay({ v: 1, days }, today)
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
            return <div key={k} className={'wd ' + cls} aria-label={`${headDate(k)}${won ? ', won' : cls === 'lost' ? ', missed' : ''}`}>{won ? <Check /> : cls === 'lost' ? '✕' : dayLetter(k)}</div>
          })}
        </div>
        <HeroStrip today={today} />
      </header>

      <DoItNow today={today} />
      <TodayBodySession today={today} />

      {upNext ? (
        <section className="upnext" style={{ background: pillarOf(upNext.pillar).color, color: upNext.pillar === 'soul' ? 'var(--ink)' : '#fff' }}>
          <button className="un-main" onClick={() => setSheet({ kind: 'actions', id: upNext.id })}>
            <div className="lab">Up next · {tlab(upNext.start, true)} · {lenLab(upNext.len)}</div>
            <FitName text={upNext.name} />
          </button>
          <button className="un-check" style={{ color: pillarOf(upNext.pillar).color }} aria-label={`Mark ${upNext.name} done`} onClick={() => actions.toggle(today, upNext.id)}><Check /></button>
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
        <Timeline blocks={day.blocks} mins={mins} onTap={b => setSheet({ kind: 'actions', id: b.id })} />
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

function Timeline({ blocks, mins, onTap }: { blocks: Block[]; mins: number; onTap: (b: Block) => void }) {
  const first = Math.min(7 * 60, ...blocks.map(b => b.start), mins - 60)
  const last = Math.max(22 * 60, ...blocks.map(b => b.start + b.len), mins + 60)
  const h0 = Math.max(0, Math.floor(first / 60)), h1 = Math.min(28, Math.ceil(last / 60))
  const y = (m: number) => (m - h0 * 60) / 60 * HOUR
  const ref = useRef<HTMLDivElement>(null)
  // Open scrolled to an hour before now.
  useEffect(() => { ref.current?.scrollTo({ top: Math.max(0, y(mins - 60) - 6) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            <button key={b.id} className={'blk' + (b.done ? ' done' : '') + (b.len < 30 ? ' slim' : '')} onClick={() => onTap(b)} aria-label={`${b.name}, ${tlab(b.start)}, ${lenLab(b.len)}${b.done ? ', done' : ''}`}
              style={{ top: y(b.start) + 1.5, height: Math.max(22, b.len / 60 * HOUR - 3), left: `calc(40px + (100% - 40px) * ${lane / of})`, width: `calc((100% - 40px) / ${of} - ${of > 1 ? 4 : 0}px)`, ['--c' as string]: c, color: b.pillar === 'soul' ? 'var(--ink)' : undefined }}>
              <span className="blk-name">{b.name}</span><span className="blk-len">{lenLab(b.len)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HeroStrip({ today }: { today: string }) {
  const s = useStore(x => x)
  const h = heroOf(s, today), i = weekOf(today).indexOf(today), n = h.done.filter(Boolean).length
  return (
    <button className={'herostrip' + (h.done[i] ? ' on' : '')} onClick={() => actions.setHero(monday(today), { ...h, done: h.done.map((d, j) => j === i ? !d : d) })} aria-label={`Hero: ${h.name}, ${n} of 7. Tap to mark today ${h.done[i] ? 'not done' : 'done'}`}>
      <span className="hs-c">{h.done[i] ? '✓' : ''}</span><b>Hero</b><span className="hs-n">{h.name}</span><span className="hs-k">{n} of 7</span>
    </button>
  )
}

/** Up next title in condensed caps: 46px, shrinking (to 30px) until it fits on two lines, as in the prototype. */
function FitName({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const n = ref.current; if (!n) return
    let f = 46; n.style.fontSize = f + 'px'
    while (n.scrollHeight > f * 0.9 * 2 + 4 && f > 30) { f -= 2; n.style.fontSize = f + 'px' }
  }, [text])
  return <div ref={ref} className="cond un-name">{text}</div>
}
