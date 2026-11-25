// The day rolls over at 4 AM, so closing the day after midnight still closes "today".
export const ROLLOVER_MIN = 4 * 60

const pad = (n: number) => String(n).padStart(2, '0')
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (k: string, n: number) => { const d = fromKey(k); d.setDate(d.getDate() + n); return keyOf(d) }

/** Minutes since midnight of the app day (can exceed 1440 between midnight and 4 AM). */
export function nowInfo(at = new Date()) {
  const mins = at.getHours() * 60 + at.getMinutes()
  if (mins < ROLLOVER_MIN) {
    const y = new Date(at); y.setDate(y.getDate() - 1)
    return { today: keyOf(y), mins: mins + 1440 }
  }
  return { today: keyOf(at), mins }
}

/** Monday-first week containing the day. */
export function weekOf(k: string) {
  const d = fromKey(k)
  const back = (d.getDay() + 6) % 7
  const mon = addDays(k, -back)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

export const headDate = (k: string) => {
  const d = fromKey(k)
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`
}
export const dayLetter = (k: string) => fromKey(k).toLocaleDateString('en-US', { weekday: 'short' })[0]

export function tlab(m: number, short = false) {
  m = ((m % 1440) + 1440) % 1440
  const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'AM' : 'PM'
  if (short && mm === 0) return `${h % 12 || 12} ${ap}`
  return `${h % 12 || 12}:${pad(mm)} ${ap}`
}
export const toHHMM = (m: number) => `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`
export const fromHHMM = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
export const lenLab = (m: number) => m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`) : `${m} min`
