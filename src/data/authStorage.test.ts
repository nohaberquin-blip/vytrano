import { authStorage, getRemember, setRemember } from './authStorage'

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

test('par défaut on reste connecté : la session va dans le stockage durable', () => {
  expect(getRemember()).toBe(true)
  authStorage.setItem('sb-token', 'abc')
  expect(localStorage.getItem('sb-token')).toBe('abc')
  expect(sessionStorage.getItem('sb-token')).toBeNull()
})

test('case décochée : la session ne vit que le temps de l’onglet', () => {
  setRemember(false)
  authStorage.setItem('sb-token', 'abc')
  expect(sessionStorage.getItem('sb-token')).toBe('abc')
  expect(localStorage.getItem('sb-token')).toBeNull()
  expect(authStorage.getItem('sb-token')).toBe('abc')
})

test('changer de choix ne laisse pas d’ancienne session dans l’autre stockage', () => {
  authStorage.setItem('sb-token', 'ancien')
  setRemember(false)
  authStorage.setItem('sb-token', 'nouveau')
  expect(localStorage.getItem('sb-token')).toBeNull()
  authStorage.removeItem('sb-token')
  expect(authStorage.getItem('sb-token')).toBeNull()
})
