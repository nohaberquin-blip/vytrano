import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { testProfile, WithUser } from '../../test/auth'
import type { Profile } from '../../domain/types'
import { HomePage } from './HomePage'

beforeEach(async () => {
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
})

const renderHome = (home?: unknown, badges?: Record<string, number>) => {
  const profile: Profile = { ...testProfile, home }
  return render(<WithUser profile={profile}><MemoryRouter><HomePage badges={badges} /></MemoryRouter></WithUser>)
}
const grid = () => screen.getByRole('list', { name: 'Applications' })
const ids = () => [...grid().querySelectorAll<HTMLElement>('[data-app]')].map((li) => li.dataset.app)
const tile = (id: string) => grid().querySelector<HTMLElement>(`[data-app="${id}"]`)!

test('8 tuiles du bento dans l’ordre par défaut, avec leur nom, leur adresse et leur taille', () => {
  renderHome()
  expect(ids()).toEqual(['session', 'calendar', 'nutrition', 'profile', 'friends', 'programs', 'exercises', 'settings'])
  const seance = within(grid()).getByRole('link', { name: /^Séances/ })
  expect(seance).toHaveAttribute('href', '/seance')
  expect(tile('session')).toHaveClass('size-large', 'c-orange')
  expect(tile('calendar')).toHaveClass('size-tall')
  expect(tile('profile')).toHaveClass('size-small')
  expect(tile('settings')).toHaveClass('size-wide')
  expect(within(grid()).getByRole('link', { name: /^Paramètres/ })).toHaveAttribute('href', '/parametres')
})

test('disposition du profil : ordre, masquées absentes, couleur, taille', () => {
  renderHome({ apps: ['friends', 'session'], hiddenApps: ['nutrition'], colors: { session: 'green' }, sizes: { friends: 'large' } })
  expect(ids()).toEqual(['friends', 'session', 'calendar', 'profile', 'programs', 'exercises', 'settings'])
  expect(tile('session')).toHaveClass('c-green')
  expect(tile('friends')).toHaveClass('size-large')
})

test('disposition abîmée : accueil par défaut', () => {
  renderHome('{pas du json')
  expect(ids()).toHaveLength(8)
})

test('demandes d’amis sur la tuile Amis', () => {
  renderHome(undefined, { '/amis': 2 })
  expect(within(grid()).getByRole('link', { name: /^Amis/ })).toHaveTextContent('2 demandes')
})

test('plus de widgets séparés', () => {
  renderHome()
  expect(screen.queryByText('Objectifs du jour')).not.toBeInTheDocument()
  expect(screen.queryByText('Prochaine séance')).not.toBeInTheDocument()
})
