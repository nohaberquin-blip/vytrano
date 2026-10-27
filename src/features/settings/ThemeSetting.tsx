import { useState } from 'react'
import { readTheme, saveTheme, type Theme } from '../../app/theme'

const CHOICES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

/** Thème de l'app sur cet appareil. */
export function ThemeSetting() {
  const [theme, setTheme] = useState(readTheme)
  return (
    <div className="field">
      <span>Thème</span>
      <div className="segmented three" role="group" aria-label="Thème">
        {CHOICES.map((c) => (
          <button key={c.value} type="button" aria-pressed={theme === c.value}
            onClick={() => { saveTheme(c.value); setTheme(c.value) }}>{c.label}</button>
        ))}
      </div>
    </div>
  )
}
