import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readRestSettings } from '../session/restSettings'
import { WithUser } from '../../test/auth'
import { RestSettingsSection } from './RestSettingsSection'

beforeEach(() => localStorage.clear())

test('4 interrupteurs, activés par défaut et mémorisés sur l’appareil', async () => {
  render(<WithUser><RestSettingsSection /></WithUser>)
  for (const name of ['Repos automatique', 'Son', 'Vibration', "Garder l'écran allumé"]) {
    expect(screen.getByRole('checkbox', { name })).toBeChecked()
  }
  await userEvent.click(screen.getByRole('checkbox', { name: 'Son' }))
  expect(screen.getByRole('checkbox', { name: 'Son' })).not.toBeChecked()
  expect(readRestSettings()).toEqual({ auto: true, sound: false, vibrate: true, wakeLock: true })
})
