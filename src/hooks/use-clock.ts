import { useEffect, useState } from 'react'

export function useClock(active = true) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [active])

  return now
}
