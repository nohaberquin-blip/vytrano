import { useRestSettings, type RestSettings } from '../session/restSettings'

const SWITCHES: Record<keyof RestSettings, { label: string; hint?: string }> = {
  auto: { label: 'Repos automatique', hint: 'Le minuteur démarre quand tu valides une série.' },
  sound: { label: 'Son' },
  vibrate: { label: 'Vibration', hint: 'Sur Android ; l’iPhone ne vibre qu’avec les alertes.' },
  wakeLock: { label: "Garder l'écran allumé", hint: 'Pendant la séance.' },
}

/** Un réglage du repos, propre à cet appareil. */
export function RestSwitch({ id }: { id: keyof RestSettings }) {
  const [settings, save] = useRestSettings()
  const { label, hint } = SWITCHES[id]
  return (
    <div>
      <label className="switch">
        <span>{label}</span>
        <input type="checkbox" checked={settings[id]} onChange={(e) => save({ ...settings, [id]: e.target.checked })} />
      </label>
      {hint && <p className="muted small" style={{ marginTop: 0 }}>{hint}</p>}
    </div>
  )
}
