import { useEffect, useState } from 'react'

/** Réglages du repos propres à l'appareil (son, vibration, écran…). */
export interface RestSettings { auto: boolean; sound: boolean; vibrate: boolean; wakeLock: boolean }

const KEY = 'vytrano.rest.settings'
const EVENT = 'vytrano-rest-settings'
const DEFAULTS: RestSettings = { auto: true, sound: true, vibrate: true, wakeLock: true }

export function readRestSettings(): RestSettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}

export function writeRestSettings(s: RestSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* stockage indisponible : réglage non mémorisé */ }
  window.dispatchEvent(new Event(EVENT))
}

export function useRestSettings(): [RestSettings, (s: RestSettings) => void] {
  const [settings, setSettings] = useState(readRestSettings)
  useEffect(() => {
    const sync = () => setSettings(readRestSettings())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])
  return [settings, writeRestSettings]
}
