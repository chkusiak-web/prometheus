import { ARCH, short, TRAITS } from './quests'
import { full } from './soul'

const R = 120
export const pos = (i: number) => { const a = (i * 30 - 90 + 15) * Math.PI / 180; return [R * Math.cos(a), R * Math.sin(a)] }

/** The 12 traits in a ring, grouped by archetype. Picked traits are joined into the Soul triangle. */
export default function Sky({ picks, onTap, glow, dark = true }: { picks: string[]; onTap: (t: string) => void; glow?: Record<string, number>; dark?: boolean }) {
  const pk = picks.map(full)
  const poly = TRAITS.filter(t => pk.includes(t)).map(t => pos(TRAITS.indexOf(t)).join(',')).join(' ')
  return (
    <svg className={'sky' + (dark ? '' : ' light')} viewBox="-175 -175 350 350" role="group" aria-label="Traits">
      {ARCH.map((a, i) => { const [x, y] = pos(i * 3 + 1).map(v => v * 0.42); return <text key={a.n} x={x} y={y + 4} textAnchor="middle" className="arch">{a.n}</text> })}
      {pk.length > 1 && <polygon points={poly} fill="rgba(255,176,0,.18)" stroke="var(--gold)" strokeWidth="3" strokeLinejoin="round" />}
      {TRAITS.map((t, i) => {
        const [x, y] = pos(i), on = pk.includes(t), g = Math.min(1, (glow?.[t] ?? 0) / 3)
        return (
          <g key={t} role="button" aria-pressed={on} aria-label={t} tabIndex={0} className="star"
            onClick={() => onTap(t)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(t) } }}>
            <circle cx={x} cy={y} r="26" fill="transparent" />
            {g > 0 && <circle cx={x} cy={y} r={10 + g * 10} fill="var(--gold)" opacity={0.15 + g * 0.25} />}
            <circle cx={x} cy={y} r={on ? 10 : 6 + g * 3} fill={on || g > 0 ? 'var(--gold)' : '#8f8a84'} />
            <text x={x} y={y + (y > 0 ? 30 : -20)} textAnchor="middle" className={on ? 'on' : ''}>{short(t)}</text>
          </g>
        )
      })}
    </svg>
  )
}
