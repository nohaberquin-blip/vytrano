import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'
import { db } from '../data/db'
import { WithUser } from '../test/auth'

beforeEach(async () => {
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
})

const renderAt = (path: string) => render(<WithUser><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></WithUser>)

test('plus de barre du bas ; « ‹ Accueil » ramène à l’accueil', async () => {
  renderAt('/exercices')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mes exercices' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Paramètres' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: '‹ Accueil' }))
  expect(screen.queryByRole('link', { name: '‹ Accueil' })).not.toBeInTheDocument()
  expect(screen.getByText('Vytrano')).toBeInTheDocument()
})

test('/seance affiche la Séance', async () => {
  renderAt('/seance')
  expect(await screen.findByRole('heading', { name: 'Séance' })).toBeInTheDocument()
})

test('Nutrition affiche Mes besoins ; le Profil ne l’a plus', async () => {
  renderAt('/nutrition')
  expect(screen.getByRole('heading', { name: 'Nutrition', level: 1 })).toBeInTheDocument()
  expect(await screen.findByRole('region', { name: 'Mes besoins' })).toBeInTheDocument()
})

test('Profil : ni réglages ni besoins ; liens historique et records', async () => {
  renderAt('/profil')
  await screen.findByRole('heading', { name: 'moi' })
  expect(screen.queryByRole('region', { name: 'Mes besoins' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Repos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Supprimer mon compte' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: '🏆 Mes records' })).toHaveAttribute('href', '/records')
  await userEvent.click(screen.getByRole('link', { name: '📅 Mon historique' }))
  expect(await screen.findByRole('heading', { name: 'Mon historique', level: 1 })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: '‹ Profil' }))
  await screen.findByRole('heading', { name: 'moi' })
})

async function inProgress(minutesAgo: number) {
  await db.workouts.put({
    id: 'w1', user_id: 'u', program_day_id: null, name: 'Libre',
    started_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(), finished_at: null, status: 'in_progress',
  })
}

test('bouton flottant : séance en cours ailleurs que sur la Séance, mène à la Séance', async () => {
  await inProgress(32)
  renderAt('/exercices')
  const fab = await screen.findByRole('link', { name: 'Reprendre la séance, 32 min' })
  await userEvent.click(fab)
  expect(await screen.findByRole('heading', { name: 'Libre' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Reprendre la séance/ })).not.toBeInTheDocument()
})

test('bouton flottant : absent sans séance en cours', async () => {
  renderAt('/exercices')
  await screen.findByRole('heading', { name: 'Mes exercices' })
  await new Promise((r) => setTimeout(r, 50))
  expect(screen.queryByRole('link', { name: /Reprendre la séance/ })).not.toBeInTheDocument()
})

test('bouton flottant : absent sur l’accueil quand la tuile Séances est visible', async () => {
  await inProgress(5)
  renderAt('/')
  await screen.findByText('Reprendre')
  await new Promise((r) => setTimeout(r, 100))
  expect(screen.queryByRole('link', { name: /Reprendre la séance/ })).not.toBeInTheDocument()
})
