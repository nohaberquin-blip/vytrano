/**
 * Où garder la session de connexion :
 * - « Rester connecté » coché → localStorage (survit à la fermeture de l'app) ;
 * - décoché → sessionStorage (disparaît à la fermeture de l'onglet / de l'app).
 */
const REMEMBER_KEY = 'vytrano.remember'

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

export function getRemember(): boolean {
  return safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true)
}

export function setRemember(remember: boolean) {
  safe(() => localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'), undefined)
}

export const authStorage = {
  getItem(key: string): string | null {
    return safe(() => localStorage.getItem(key) ?? sessionStorage.getItem(key), null)
  },
  setItem(key: string, value: string) {
    const [keep, drop] = getRemember() ? [localStorage, sessionStorage] : [sessionStorage, localStorage]
    safe(() => { drop.removeItem(key); keep.setItem(key, value) }, undefined)
  },
  removeItem(key: string) {
    safe(() => { localStorage.removeItem(key); sessionStorage.removeItem(key) }, undefined)
  },
}
