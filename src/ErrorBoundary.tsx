import { Component, type ReactNode } from 'react'

/** Shows what broke instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    const e = this.state.err
    if (!e) return this.props.children
    return (
      <main className="screen later" style={{ paddingTop: 60 }}>
        <h1 className="cond" style={{ fontSize: 40 }}>Something broke</h1>
        <p>Screenshot this and send it to Claude. Your data is safe.</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 12, borderRadius: 10, fontSize: 12 }}>{e.message}{'\n'}{(e.stack || '').split('\n').slice(0, 4).join('\n')}{'\n\n'}{navigator.userAgent}</pre>
        <button className="pill big" onClick={() => location.reload()}>Try again</button>
      </main>
    )
  }
}
