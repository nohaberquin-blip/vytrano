import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeSetting } from '../features/settings/ThemeSetting'
import { applyTheme, readTheme, saveTheme } from './theme'

const html = document.documentElement
beforeEach(() => { localStorage.clear(); html.removeAttribute('data-theme') })
afterEach(() => vi.restoreAllMocks())

test('par défaut : système, sans attribut', () => {
  expect(readTheme()).toBe('system')
  applyTheme(readTheme())
  expect(html.hasAttribute('data-theme')).toBe(false)
})

test('sombre enregistré et appliqué ; système retire l’attribut', () => {
  saveTheme('dark')
  expect(html.getAttribute('data-theme')).toBe('dark')
  expect(readTheme()).toBe('dark')
  saveTheme('system')
  expect(html.hasAttribute('data-theme')).toBe(false)
})

test('valeur invalide ou stockage indisponible : système, sans erreur', () => {
  localStorage.setItem('vytrano.theme', 'rose')
  expect(readTheme()).toBe('system')
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué') })
  expect(readTheme()).toBe('system')
  expect(() => saveTheme('light')).not.toThrow()
  expect(html.getAttribute('data-theme')).toBe('light')
})

test('sélecteur : Sombre pressé et appliqué', async () => {
  render(<ThemeSetting />)
  expect(screen.getByRole('button', { name: 'Système' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Sombre' }))
  expect(screen.getByRole('button', { name: 'Sombre' })).toHaveAttribute('aria-pressed', 'true')
  expect(html.getAttribute('data-theme')).toBe('dark')
})
