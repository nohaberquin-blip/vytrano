import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'

test('affiche les 4 onglets et navigue vers Mes exercices', async () => {
  render(<MemoryRouter><AppRoutes /></MemoryRouter>)
  for (const label of ['Séance', 'Programmes', 'Mes exercices', 'Amis']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
  await userEvent.click(screen.getByRole('link', { name: 'Mes exercices' }))
  expect(screen.getByRole('heading', { name: 'Mes exercices' })).toBeInTheDocument()
})
