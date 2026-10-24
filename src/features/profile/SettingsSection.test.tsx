import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsSection } from './SettingsSection'
import { testProfile } from '../../test/auth'

function setup() {
  const update = vi.fn().mockResolvedValue({ error: null })
  const onDelete = vi.fn().mockResolvedValue(undefined)
  render(<SettingsSection profile={testProfile} update={update} onSignOut={() => {}} onDelete={onDelete} pending={0} />)
  return { update, onDelete }
}

test('le partage est activé, le décocher l’enregistre', async () => {
  const { update } = setup()
  const toggle = screen.getByRole('checkbox', { name: 'Partager mes séances avec mes amis' })
  expect(toggle).toBeChecked()
  await userEvent.click(toggle)
  expect(update).toHaveBeenCalledWith({ share_workouts: false })
})

test('suppression du compte : il faut taper son pseudo', async () => {
  const { onDelete } = setup()
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
  const confirmBtn = screen.getByRole('button', { name: 'Supprimer définitivement' })
  expect(confirmBtn).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Tape ton pseudo pour confirmer'), 'moi')
  expect(confirmBtn).toBeEnabled()
  await userEvent.click(confirmBtn)
  expect(onDelete).toHaveBeenCalled()
})
