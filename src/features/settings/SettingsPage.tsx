import { useState, type ReactNode } from 'react'
import { RestAlerts } from '../profile/RestAlerts'
import { CATEGORIES, SETTINGS, searchSettings, type SettingId } from './catalog'
import {
  DeleteAccountSetting, ShareProgressSetting, ShareWorkoutsSetting, SignOutSetting, UnitSetting, UsernameSetting,
} from './ProfileSettings'
import { RestSwitch } from './RestSwitch'
import { ThemeSetting } from './ThemeSetting'

const RENDER: Record<SettingId, () => ReactNode> = {
  theme: () => <ThemeSetting />,
  restAlerts: () => <RestAlerts />,
  sound: () => <RestSwitch id="sound" />,
  vibrate: () => <RestSwitch id="vibrate" />,
  shareWorkouts: () => <ShareWorkoutsSetting />,
  shareProgress: () => <ShareProgressSetting />,
  unit: () => <UnitSetting />,
  auto: () => <RestSwitch id="auto" />,
  wakeLock: () => <RestSwitch id="wakeLock" />,
  username: () => <UsernameSetting />,
  signOut: () => <SignOutSetting />,
  deleteAccount: () => <DeleteAccountSetting />,
}

/** Tous les réglages, par catégorie, avec une recherche. */
export function SettingsPage() {
  const [query, setQuery] = useState('')
  const visible = new Set(searchSettings(query))
  const sections = CATEGORIES
    .map((c) => ({ ...c, items: SETTINGS.filter((s) => s.category === c.id && visible.has(s.id)) }))
    .filter((c) => c.items.length > 0)
  return (
    <section className="page settings">
      <h1>Paramètres</h1>
      <input className="input settings-search" type="search" aria-label="Rechercher un paramètre"
        placeholder="Rechercher un paramètre" value={query} onChange={(e) => setQuery(e.target.value)} />
      {sections.length === 0 && <p className="muted">Aucun paramètre trouvé</p>}
      {sections.map((c) => (
        <section key={c.id} aria-label={c.label}>
          <h2>{c.label}</h2>
          <div className="card settings-card">
            {c.items.map((s) => <div key={s.id} className="settings-item">{RENDER[s.id]()}</div>)}
          </div>
        </section>
      ))}
    </section>
  )
}
