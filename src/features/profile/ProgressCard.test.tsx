import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/db'
import { publishCard, setShareProgress } from '../../data/progress'
import { WithUser, testProfile } from '../../test/auth'
import { ProgressCard } from './ProgressCard'

vi.mock('../../data/progress', async (orig) => ({
  ...(await orig<typeof import('../../data/progress')>()),
  setShareProgress: vi.fn().mockResolvedValue({ error: null }),
  publishCard: vi.fn().mockResolvedValue({ error: null }),
}))

beforeEach(async () => {
  localStorage.clear()
  vi.mocked(setShareProgress).mockClear()
  vi.mocked(publishCard).mockClear()
  await Promise.all(db.tables.map((t) => t.clear()))
})

const done = (id: string, date: string) => db.workouts.put({
  id, user_id: 'u', program_day_id: null, name: 'S', started_at: `${date}T10:00:00.000Z`, finished_at: `${date}T11:00:00.000Z`, status: 'done',
})

test('niveau, barre d’XP et badges (débloqués et grisés), pas de série à 0', async () => {
  await done('a', '2026-09-01')
  await done('b', '2026-09-03')
  render(<WithUser><ProgressCard /></WithUser>)
  const card = await screen.findByRole('region', { name: 'Régularité' })
  expect(await within(card).findByText('Niveau 1 · Débutant')).toBeInTheDocument()
  expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '200')
  expect(within(card).getByText('200 / 1 500 XP')).toBeInTheDocument()
  expect(within(card).queryByText(/🔥/)).not.toBeInTheDocument()
  expect(within(card).getByRole('listitem', { name: /1re séance, obtenu le/ })).toBeInTheDocument()
  expect(within(card).getByRole('listitem', { name: '10 séances, à débloquer : Terminer 10 séances' })).toBeInTheDocument()
})

test('interrupteur de partage : désactivé par défaut, l’activer partage la carte', async () => {
  render(<WithUser><ProgressCard /></WithUser>)
  const toggle = await screen.findByRole('checkbox', { name: 'Montrer mon niveau et mes badges à mes amis' })
  expect(toggle).not.toBeChecked()
  await userEvent.click(toggle)
  expect(setShareProgress).toHaveBeenCalledWith('u', true, expect.objectContaining({ level: 1 }))
})

test('partage activé : le désactiver retire la carte', async () => {
  render(<WithUser profile={{ ...testProfile, share_progress: true }}><ProgressCard /></WithUser>)
  const toggle = await screen.findByRole('checkbox', { name: 'Montrer mon niveau et mes badges à mes amis' })
  expect(toggle).toBeChecked()
  await userEvent.click(toggle)
  expect(setShareProgress).toHaveBeenCalledWith('u', false, expect.anything())
})

test('partage activé : la carte périmée est republiée à l’ouverture du Profil, une seule fois', async () => {
  await done('a', '2026-09-01')
  const profile = { ...testProfile, share_progress: true }
  const { unmount } = render(<WithUser profile={profile}><ProgressCard /></WithUser>)
  await screen.findByText('Niveau 1 · Débutant')
  await vi.waitFor(() => expect(publishCard).toHaveBeenCalledTimes(1))
  unmount()
  render(<WithUser profile={profile}><ProgressCard /></WithUser>)
  await screen.findByText('Niveau 1 · Débutant')
  await new Promise((r) => setTimeout(r, 50))
  expect(publishCard).toHaveBeenCalledTimes(1)
})

test('partage désactivé : rien n’est publié à l’ouverture', async () => {
  render(<WithUser><ProgressCard /></WithUser>)
  await screen.findByText('Niveau 1 · Débutant')
  await new Promise((r) => setTimeout(r, 50))
  expect(publishCard).not.toHaveBeenCalled()
})

test('disques colorés : le poids monte avec la rareté ; grisés tant qu’ils ne sont pas obtenus', async () => {
  await done('a', '2026-09-01')
  render(<WithUser><ProgressCard /></WithUser>)
  const card = await screen.findByRole('region', { name: 'Régularité' })
  const first = await within(card).findByRole('listitem', { name: /1re séance, obtenu le/ })
  const icon = first.querySelector('svg.badge-icon')!
  expect(icon).toHaveClass('kg-5')
  expect(icon).not.toHaveClass('locked')
  expect(icon).toHaveTextContent('5 kg')
  const rare = within(card).getByRole('listitem', { name: /^500 séances, à débloquer/ }).querySelector('svg.badge-icon')!
  expect(rare).toHaveClass('kg-25', 'locked')
  expect(rare).toHaveTextContent('25 kg')
  expect(card.querySelectorAll('svg.badge-icon')).toHaveLength(17)
})
