import { useEffect, useRef, useState } from 'react'
import Today from './Today'
import CloseDay from './CloseDay'
import Body from './Body'
import Soul from './Soul'
import Mind from './Mind'
import HeroTab from './Hero'
import { Runner } from './Workout'
import { useNow } from './useNow'
import { dayStatus, getDay, useStore } from './store'

type Tab = 'today' | 'mind' | 'body' | 'soul' | 'hero'
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <svg viewBox="0 0 24 24"><path d="M4 6h16L12 20z" /></svg> },
  { id: 'mind', label: 'Mind', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5" /></svg> },
  { id: 'body', label: 'Body', icon: <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" /></svg> },
  { id: 'soul', label: 'Soul', icon: <svg viewBox="0 0 24 24"><path d="M12 3.5 20.5 12 12 20.5 3.5 12z" /></svg> },
  { id: 'hero', label: 'Hero', icon: <svg viewBox="0 0 24 24"><path d="M12 4 20.5 19h-17z" /></svg> },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [closing, setClosing] = useState(false)
  const { today } = useNow()
  const won = useStore(s => dayStatus(getDay(s, today)).won)

  // Day won moment: only when the day flips to won, and cancelled if it's undone in the meantime.
  const [moment, setMoment] = useState(false)
  const prev = useRef(won), timer = useRef<number>(undefined)
  useEffect(() => {
    if (won && !prev.current) timer.current = window.setTimeout(() => setMoment(true), 500)
    if (!won) { clearTimeout(timer.current); setMoment(false) }
    prev.current = won
  }, [won])
  useEffect(() => { if (moment) { const t = setTimeout(() => setMoment(false), 2200); return () => clearTimeout(t) } }, [moment])

  return (
    <div className="app">
      {tab === 'today' ? <Today onClose={() => setClosing(true)} /> : tab === 'body' ? <Body /> : tab === 'soul' ? <Soul /> : tab === 'mind' ? <Mind /> : <HeroTab />}
      <nav className={'tabs' + (tab === 'soul' || tab === 'hero' ? ' dark' : '')} aria-label="Tabs">
        {TABS.map(t => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} aria-label={t.label} aria-current={tab === t.id} onClick={() => setTab(t.id)}>{t.icon}</button>
        ))}
      </nav>
      <Runner />
      {closing && <CloseDay day={today} onDone={() => setClosing(false)} />}
      {moment && <div className="wonmoment" role="status" onClick={() => setMoment(false)}><div className="cond">Day won</div></div>}
    </div>
  )
}
