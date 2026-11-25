import { useRef, useState } from 'react'
import { actions } from './store'

export default function Later({ tab }: { tab: string }) {
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
    <main className="screen later">
      <h1 className="cond">{tab}</h1>
      <p>This tab is coming in the next build. Today works now, and everything you do there is saved on this device.</p>
      <a className="link" href="./prototype/">See the full design in the prototype ›</a>
      {tab === 'Hero' && (
        <section className="card">
          <div className="lab">Back up</div>
          <p className="small">Your data lives on this device only (sync comes later). Save a copy now and then.</p>
          <div className="row">
            <button className="pill" onClick={exp}>Save backup</button>
            <button className="pill ghost" onClick={() => file.current?.click()}>Restore</button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => imp(e.target.files?.[0])} />
          {msg && <p className="small">{msg}</p>}
        </section>
      )}
    </main>
  )
}
