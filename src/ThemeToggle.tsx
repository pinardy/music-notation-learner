import { useEffect } from 'react'
import { usePersistentFlag } from './usePersistentFlag'

/**
 * Light/dark switcher. Defaults to the system preference; the choice persists
 * and is applied via [data-theme] on <html> (index.html sets it pre-React to
 * avoid a flash of the wrong theme).
 */
export function ThemeToggle() {
  const [dark, toggleDark] = usePersistentFlag(
    'note-game-dark',
    typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#232a4d' : '#4f7cff')
  }, [dark])

  return (
    <button
      className="theme-toggle"
      onClick={toggleDark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Dark mode' : 'Light mode'}
    >
      {dark ? '🌙' : '☀️'}
    </button>
  )
}
