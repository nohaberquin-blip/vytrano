export type Theme = 'system' | 'light' | 'dark'

const KEY = 'vytrano.theme'
const BAR = { light: '#f4f3ef', dark: '#111315' }

/** Thème choisi sur cet appareil ('system' si rien, valeur inconnue ou stockage indisponible). */
export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch { return 'system' }
}

/** `data-theme` sur <html> (absent : on suit le téléphone) et couleur de la barre du navigateur. */
export function applyTheme(t: Theme): void {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  const dark = t === 'dark' || (t === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? BAR.dark : BAR.light)
}

export function saveTheme(t: Theme): void {
  try { localStorage.setItem(KEY, t) } catch { /* stockage indisponible : appliqué jusqu'au prochain lancement */ }
  applyTheme(t)
}
