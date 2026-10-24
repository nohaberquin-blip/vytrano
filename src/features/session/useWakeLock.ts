import { useEffect } from 'react'

type WakeLockSentinel = { release(): Promise<void> }
type WakeLockNavigator = { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } }

/** Garde l'écran allumé tant que le composant est affiché (repris au retour au premier plan). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const api = (navigator as unknown as WakeLockNavigator).wakeLock
    if (!enabled || !api) return
    let lock: WakeLockSentinel | null = null
    let active = true
    const request = async () => {
      try {
        const l = await api.request('screen')
        if (active) lock = l
        else void l.release()
      } catch { /* refusé (économie d'énergie…) : sans effet */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void request() }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [enabled])
}
