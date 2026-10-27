import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'
import { WithUser } from '../test/auth'

test('affiche les 5 onglets et navigue vers Mes exercices et le Calendrier', async () => {
  render(<WithUser><MemoryRouter><AppRoutes /></MemoryRouter></WithUser>)
  for (const label of ['Séance', 'Calendrier', 'Programmes', 'Exercices', 'Amis']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
  await userEvent.click(screen.getByRole('link', { name: 'Exercices' }))
  expect(screen.getByRole('heading', { name: 'Mes exercices' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Calendrier' }))
  expect(await screen.findByRole('heading', { name: 'Calendrier' })).toBeInTheDocument()
})

test('⚙️ dans l’en-tête ouvre les Paramètres ; le Profil n’a plus de réglages', async () => {
  render(<WithUser><MemoryRouter initialEntries={['/profil']}><AppRoutes /></MemoryRouter></WithUser>)
  await screen.findByRole('heading', { name: 'moi' })
  expect(screen.queryByRole('heading', { name: 'Repos' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Paramètres' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Supprimer mon compte' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Paramètres' }))
  expect(await screen.findByRole('heading', { name: 'Paramètres', level: 1 })).toBeInTheDocument()
})
