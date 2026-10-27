import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { updateProfile } from '../../data/profile'
import { setShareProgress } from '../../data/progress'
import { supabase } from '../../data/supabase'
import { AuthContext } from '../auth/AuthProvider'
import { WithUser, testProfile } from '../../test/auth'
import { readRestSettings } from '../session/restSettings'
import { SettingsPage } from './SettingsPage'

vi.mock('../../data/profile', async (orig) => ({
  ...(await orig<typeof import('../../data/profile')>()),
  updateProfile: vi.fn().mockResolvedValue({ error: null }),
}))
vi.mock('../../data/progress', async (orig) => ({
  ...(await orig<typeof import('../../data/progress')>()),
  setShareProgress: vi.fn().mockResolvedValue({ error: null }),
  publishCard: vi.fn().mockResolvedValue({ error: null }),
}))

beforeEach(async () => {
  localStorage.clear()
  vi.mocked(updateProfile).mockClear()
  vi.mocked(setShareProgress).mockClear()
  await Promise.all(db.tables.map((t) => t.clear()))
})

const renderPage = (profile = testProfile) =>
  render(<MemoryRouter><WithUser profile={profile}><SettingsPage /></WithUser></MemoryRouter>)

const authValue = {
  loading: false, user: { id: 'u' }, profile: testProfile, recovering: false, endRecovery: () => {},
  refreshProfile: async () => {}, signOut: async () => {},
}

const CATS = ['Apparence', 'Notifications', 'Confidentialité', 'Préférences d’entraînement', 'Compte']

test('5 catégories avec leurs réglages', async () => {
  renderPage()
  for (const name of CATS) expect(screen.getByRole('region', { name })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Apparence' })).getByRole('button', { name: 'Sombre' })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Notifications' })).getByRole('checkbox', { name: 'Vibration' })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Préférences d’entraînement' })).getByRole('combobox', { name: 'Unité' })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Compte' })).getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  expect(await within(screen.getByRole('region', { name: 'Confidentialité' })).findByRole('checkbox', { name: 'Montrer mon niveau et mes badges à mes amis' })).toBeInTheDocument()
})

test('recherche : mot-clé, nom partiel, aucun résultat', async () => {
  renderPage()
  const search = screen.getByRole('searchbox', { name: 'Rechercher un paramètre' })
  await userEvent.type(search, 'sombre')
  expect(screen.getByRole('region', { name: 'Apparence' })).toBeInTheDocument()
  expect(screen.getAllByRole('region')).toHaveLength(1)
  await userEvent.clear(search)
  await userEvent.type(search, 'VIB')
  expect(screen.getByRole('checkbox', { name: 'Vibration' })).toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Son' })).not.toBeInTheDocument()
  await userEvent.clear(search)
  await userEvent.type(search, 'zzz')
  expect(screen.queryAllByRole('region')).toHaveLength(0)
  expect(screen.getByText('Aucun paramètre trouvé')).toBeInTheDocument()
})

test('partage des séances et de la progression', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Partager mes séances avec mes amis' }))
  expect(updateProfile).toHaveBeenCalledWith('u', { share_workouts: false })
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Montrer mon niveau et mes badges à mes amis' }))
  expect(setShareProgress).toHaveBeenCalledWith('u', true, expect.objectContaining({ level: 1 }))
})

test('interrupteurs du repos mémorisés sur l’appareil ; unité enregistrée', async () => {
  renderPage()
  for (const name of ['Repos automatique', 'Son', 'Vibration', "Garder l'écran allumé"]) {
    expect(screen.getByRole('checkbox', { name })).toBeChecked()
  }
  await userEvent.click(screen.getByRole('checkbox', { name: 'Son' }))
  expect(readRestSettings()).toEqual({ auto: true, sound: false, vibrate: true, wakeLock: true })
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Unité' }), 'lb')
  expect(updateProfile).toHaveBeenCalledWith('u', { unit: 'lb' })
})

test('pseudo modifié ; suppression du compte après avoir tapé son pseudo', async () => {
  const rpc = vi.spyOn(supabase, 'rpc').mockResolvedValue({ error: null } as never)
  renderPage()
  const pseudo = screen.getByRole('textbox', { name: 'Pseudo' })
  await userEvent.clear(pseudo)
  await userEvent.type(pseudo, 'nouveau')
  await userEvent.click(screen.getByRole('button', { name: 'OK' }))
  expect(updateProfile).toHaveBeenCalledWith('u', { username: 'nouveau' })
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
  const confirmBtn = screen.getByRole('button', { name: 'Supprimer définitivement' })
  expect(confirmBtn).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Tape ton pseudo pour confirmer'), 'moi')
  await userEvent.click(confirmBtn)
  expect(rpc).toHaveBeenCalledWith('delete_my_account')
  rpc.mockRestore()
})

test('pseudo : le champ se remplit quand le profil arrive après l’ouverture', async () => {
  const { rerender } = render(<MemoryRouter><AuthContext.Provider value={{ ...authValue, profile: null }}><SettingsPage /></AuthContext.Provider></MemoryRouter>)
  rerender(<MemoryRouter><AuthContext.Provider value={{ ...authValue, profile: testProfile }}><SettingsPage /></AuthContext.Provider></MemoryRouter>)
  expect(await screen.findByRole('textbox', { name: 'Pseudo' })).toHaveValue('moi')
  expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled()
})

test('partage de la progression activé : le désactiver retire la carte', async () => {
  renderPage({ ...testProfile, share_progress: true })
  const toggle = await screen.findByRole('checkbox', { name: 'Montrer mon niveau et mes badges à mes amis' })
  expect(toggle).toBeChecked()
  await userEvent.click(toggle)
  expect(setShareProgress).toHaveBeenCalledWith('u', false, expect.anything())
})

test('thème : trois choix sur une ligne ; recherche avec l’apostrophe de l’iPhone', async () => {
  renderPage()
  expect(screen.getByRole('group', { name: 'Thème' })).toHaveClass('three')
  await userEvent.type(screen.getByRole('searchbox', { name: 'Rechercher un paramètre' }), 'l’écran')
  expect(screen.getByRole('checkbox', { name: "Garder l'écran allumé" })).toBeInTheDocument()
})
