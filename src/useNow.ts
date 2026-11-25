import { useEffect, useState } from 'react'
import { nowInfo } from './date'

/** Current app day + minutes, refreshed every 30 s and when the app comes back to the front. */
export function useNow() {
  const [n, setN] = useState(nowInfo)
  useEffect(() => {
    const tick = () => setN(nowInfo())
    const iv = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', tick) }
  }, [])
  return n
}
