import { useRestSettings, type RestSettings } from '../session/restSettings'
import { RestAlerts } from './RestAlerts'

const SWITCHES: { key: keyof RestSettings; label: string; hint?: string }[] = [
  { key: 'auto', label: 'Repos automatique', hint: 'Le minuteur démarre quand tu valides une série.' },
  { key: 'sound', label: 'Son' },
  { key: 'vibrate', label: 'Vibration', hint: 'Sur Android ; l’iPhone ne vibre qu’avec les alertes.' },
  { key: 'wakeLock', label: "Garder l'écran allumé", hint: 'Pendant la séance.' },
]

/** Réglages du repos, propres à cet appareil. */
export function RestSettingsSection() {
  const [settings, save] = useRestSettings()
  return (
    <section aria-label="Repos">
      <h2>Repos</h2>
      <RestAlerts />
      {SWITCHES.map(({ key, label, hint }) => (
        <div key={key}>
          <label className="switch">
            <span>{label}</span>
            <input type="checkbox" checked={settings[key]} onChange={(e) => save({ ...settings, [key]: e.target.checked })} />
          </label>
          {hint && <p className="muted small" style={{ marginTop: 0 }}>{hint}</p>}
        </div>
      ))}
    </section>
  )
}
