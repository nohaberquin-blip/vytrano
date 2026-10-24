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
