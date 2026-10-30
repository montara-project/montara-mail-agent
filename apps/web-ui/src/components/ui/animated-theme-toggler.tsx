import { Moon, Sun } from 'lucide-react'
import { useRef } from 'react'
import { flushSync } from 'react-dom'

const DURATION = 400

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<'button'> {
  theme: 'light' | 'dark'
  /** Called on toggle; the parent owns persistence (e.g. `next-themes`). */
  onThemeChange: (theme: 'light' | 'dark') => void
}

/**
 * A theme button that reveals the new theme as a circle growing from the
 * button, through the View Transitions API; browsers without it just switch.
 */
export const AnimatedThemeToggler = ({
  theme,
  onThemeChange,
  ...props
}: AnimatedThemeTogglerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const transitioning = useRef(false)
  const isDark = theme === 'dark'

  const toggleTheme = () => {
    const button = buttonRef.current
    if (!button || transitioning.current) return

    const applyTheme = () => {
      // Toggle the class synchronously so the transition snapshots the new theme.
      document.documentElement.classList.toggle('dark')
      onThemeChange(isDark ? 'light' : 'dark')
    }
    if (typeof document.startViewTransition !== 'function') {
      applyTheme()
      return
    }

    // innerWidth/innerHeight (not visualViewport): percentages must resolve
    // against the snapshot reference box, which includes classic scrollbars.
    const width = window.innerWidth
    const height = window.innerHeight
    const { top, left, width: w, height: h } = button.getBoundingClientRect()
    const x = left + w / 2
    const y = top + h / 2
    const maxRadius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y))
    // Percentages, not px: Chrome draws px clip-paths on ::view-transition-new(root)
    // unscaled on fractional display scales for the first transition after load.
    // circle() percentage radii resolve against hypot(w, h) / sqrt(2).
    const at = `at ${(x / width) * 100}% ${(y / height) * 100}%`
    const radius = (maxRadius / (Math.hypot(width, height) / Math.SQRT2)) * 100

    transitioning.current = true
    const transition = document.startViewTransition(() => flushSync(applyTheme))
    transition.finished.finally(() => (transitioning.current = false)).catch(() => {})
    transition.ready
      .then(() =>
        document.documentElement.animate(
          { clipPath: [`circle(0% ${at})`, `circle(${radius}% ${at})`] },
          {
            duration: DURATION,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      )
      .catch(() => {})
  }

  return (
    <button type="button" ref={buttonRef} onClick={toggleTheme} {...props}>
      {isDark ? <Sun /> : <Moon />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
