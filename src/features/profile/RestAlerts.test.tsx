import { render, screen } from '@testing-library/react'
import { WithUser } from '../../test/auth'
import { RestAlerts } from './RestAlerts'
import { pushSupport } from '../../data/push'

vi.mock('../../data/push', () => ({
  pushSupport: vi.fn(), pushEnabledFlag: vi.fn(() => false), enablePush: vi.fn(), disablePush: vi.fn(),
}))

test('iPhone hors écran d’accueil : guide', () => {
  vi.mocked(pushSupport).mockReturnValue('ios-home-screen')
  render(<WithUser><RestAlerts /></WithUser>)
  expect(screen.getByText(/Ajoute Vytrano à l'écran d'accueil/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Activer les alertes de repos' })).toBeNull()
})

test('navigateur compatible : bouton d’activation', () => {
  vi.mocked(pushSupport).mockReturnValue('ok')
  render(<WithUser><RestAlerts /></WithUser>)
  expect(screen.getByRole('button', { name: 'Activer les alertes de repos' })).toBeInTheDocument()
})

test('navigateur sans prise en charge : message', () => {
  vi.mocked(pushSupport).mockReturnValue('unsupported')
  render(<WithUser><RestAlerts /></WithUser>)
  expect(screen.getByText('Ton navigateur ne permet pas les alertes.')).toBeInTheDocument()
})
