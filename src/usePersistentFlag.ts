import { useState } from 'react'

/**
 * A boolean flag backed by localStorage (stored as 'on'/'off'). Returns the
 * current value and a toggle function. Falls back to `defaultValue` when the
 * key is unset or storage is unavailable.
 */
export function usePersistentFlag(key: string, defaultValue: boolean) {
  const [on, setOn] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? defaultValue : raw === 'on'
    } catch {
      return defaultValue
    }
  })

  const toggle = () =>
    setOn((prev) => {
      const next = !prev
      try {
        localStorage.setItem(key, next ? 'on' : 'off')
      } catch {
        // preference just won't persist
      }
      return next
    })

  return [on, toggle] as const
}
