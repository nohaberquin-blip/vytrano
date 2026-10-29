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
const names = () => within(grid()).getAllByRole('link').map((a) => a.getAttribute('aria-label'))

test('8 icônes dans l’ordre par défaut, avec leur nom et leur adresse', () => {
  renderHome()
  expect(names()).toEqual(['Séances', 'Calendrier', 'Programmes', 'Exercices', 'Nutrition', 'Amis', 'Profil', 'Paramètres'])
  const seance = within(grid()).getByRole('link', { name: 'Séances' })
  expect(seance).toHaveAttribute('href', '/seance')
  expect(seance).toHaveTextContent('Séances')
  expect(seance.querySelector('.app-icon')).toHaveClass('c-orange')
  expect(within(grid()).getByRole('link', { name: 'Paramètres' })).toHaveAttribute('href', '/parametres')
})

test('disposition du profil : ordre, masqués absents, couleur', () => {
  renderHome({ apps: ['friends', 'session'], hiddenApps: ['nutrition'], colors: { session: 'green' }, hiddenWidgets: ['progress'] })
  expect(names()).toEqual(['Amis', 'Séances', 'Calendrier', 'Programmes', 'Exercices', 'Profil', 'Paramètres'])
  expect(within(grid()).getByRole('link', { name: 'Séances' }).querySelector('.app-icon')).toHaveClass('c-green')
  expect(screen.queryByRole('link', { name: /^Progression/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /^Calories/ })).toBeInTheDocument()
})

test('disposition abîmée : accueil par défaut', () => {
  renderHome('{pas du json')
  expect(names()).toHaveLength(8)
})

test('badge des demandes d’amis', () => {
  renderHome(undefined, { '/amis': 2 })
  const amis = within(grid()).getByRole('link', { name: 'Amis, 2 demandes' })
  expect(amis).toHaveTextContent('2')
})
