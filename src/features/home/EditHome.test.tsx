import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../data/db'
import { saveHome } from '../../data/profile'
import { DEFAULT_LAYOUT } from '../../domain/home'
import { WithUser } from '../../test/auth'
import { HomePage } from './HomePage'

vi.mock('../../data/profile', async (orig) => ({
  ...(await orig<typeof import('../../data/profile')>()),
  saveHome: vi.fn().mockResolvedValue({ error: null }),
}))

beforeEach(async () => {
  localStorage.clear()
  vi.mocked(saveHome).mockClear()
  vi.mocked(saveHome).mockResolvedValue({ error: null })
  await Promise.all(db.tables.map((t) => t.clear()))
})

function renderHome() {
  return render(
    <WithUser>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Link to="/">retour</Link>} />
        </Routes>
      </MemoryRouter>
    </WithUser>,
  )
}
const grid = () => screen.getByRole('list', { name: 'Applications' })
const LABELS: Record<string, string> = { session: 'Séances', calendar: 'Calendrier', nutrition: 'Nutrition', profile: 'Profil', friends: 'Amis', programs: 'Programmes', exercises: 'Exercices', settings: 'Paramètres' }
const names = () => [...grid().querySelectorAll<HTMLElement>('[data-app]')].map((li) => LABELS[li.dataset.app!])
const icon = (name: string) => within(grid()).getByRole('link', { name: new RegExp(`^${name}`) })
const lastSaved = () => vi.mocked(saveHome).mock.calls.at(-1)![1]

async function edit() {
  await userEvent.click(screen.getByRole('button', { name: 'Modifier l’accueil' }))
  expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument()
}

test('déplacer une icône depuis sa feuille : ordre changé et enregistré', async () => {
  renderHome()
  await edit()
  await userEvent.click(icon('Amis'))
  const sheet = screen.getByRole('dialog', { name: 'Amis' })
  await userEvent.click(within(sheet).getByRole('button', { name: 'Déplacer Amis vers la gauche' }))
  expect(names().slice(2, 5)).toEqual(['Nutrition', 'Amis', 'Profil'])
  expect(saveHome).toHaveBeenCalledWith('u', expect.objectContaining({ apps: expect.arrayContaining(['friends']) }))
  expect(lastSaved().apps.indexOf('friends')).toBe(3)
})

test('en mode Modifier, toucher une icône ne l’ouvre pas', async () => {
  renderHome()
  await edit()
  await userEvent.click(icon('Calendrier'))
  expect(screen.queryByRole('link', { name: 'retour' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'Calendrier' })).toBeInTheDocument()
})

test('couleur d’une icône', async () => {
  renderHome()
  await edit()
  await userEvent.click(icon('Séances'))
  const vert = within(screen.getByRole('dialog', { name: 'Séances' })).getByRole('button', { name: 'Vert' })
  await userEvent.click(vert)
  expect(vert).toHaveAttribute('aria-pressed', 'true')
  expect(grid().querySelector('[data-app="session"]')).toHaveClass('c-green')
  expect(lastSaved().colors).toEqual({ session: 'green' })
})

test('masquer puis réafficher une icône ; Paramètres ne se masque pas', async () => {
  renderHome()
  await edit()
  await userEvent.click(icon('Nutrition'))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Nutrition' })).getByRole('button', { name: 'Masquer' }))
  expect(names()).not.toContain('Nutrition')
  const hidden = screen.getByRole('region', { name: 'Masqués' })
  await userEvent.click(within(hidden).getByRole('button', { name: 'Afficher Nutrition' }))
  expect(names()).toContain('Nutrition')
  await userEvent.click(icon('Paramètres'))
  expect(within(screen.getByRole('dialog', { name: 'Paramètres' })).queryByRole('button', { name: 'Masquer' })).not.toBeInTheDocument()
})

test('taille d’une tuile', async () => {
  renderHome()
  await edit()
  await userEvent.click(icon('Amis'))
  const large = within(screen.getByRole('dialog', { name: 'Amis' })).getByRole('button', { name: 'Grande' })
  expect(within(screen.getByRole('dialog', { name: 'Amis' })).getByRole('button', { name: 'Petite' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(large)
  expect(large).toHaveAttribute('aria-pressed', 'true')
  expect(grid().querySelector('[data-app="friends"]')).toHaveClass('size-large')
  expect(lastSaved().sizes).toEqual({ friends: 'large' })
})

test('réinitialiser après confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  renderHome()
  await edit()
  await userEvent.click(icon('Amis'))
  await userEvent.click(screen.getByRole('button', { name: 'Masquer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))
  expect(names()).toHaveLength(8)
  expect(lastSaved()).toEqual(DEFAULT_LAYOUT)
  vi.mocked(window.confirm).mockRestore()
})

test('échec d’enregistrement : message, la disposition reste à l’écran', async () => {
  vi.mocked(saveHome).mockResolvedValue({ error: new Error('hors ligne') } as never)
  renderHome()
  await edit()
  await userEvent.click(icon('Nutrition'))
  await userEvent.click(screen.getByRole('button', { name: 'Masquer' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Accueil non enregistré, réessaie plus tard.')
  expect(names()).not.toContain('Nutrition')
})

test('Terminé, puis une autre page et retour : la disposition est gardée', async () => {
  renderHome()
  await edit()
  await userEvent.click(icon('Nutrition'))
  await userEvent.click(screen.getByRole('button', { name: 'Masquer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Terminé' }))
  await userEvent.click(icon('Amis'))
  await userEvent.click(screen.getByRole('link', { name: 'retour' }))
  expect(names()).not.toContain('Nutrition')
})

test('appui long sur une icône : passe en mode Modifier sans ouvrir la page', async () => {
  renderHome()
  const amis = icon('Amis')
  fireEvent.pointerDown(amis, { clientX: 10, clientY: 10, pointerId: 1 })
  await new Promise((r) => setTimeout(r, 600))
  fireEvent.pointerUp(amis, { clientX: 10, clientY: 10, pointerId: 1 })
  fireEvent.click(amis)
  expect(await screen.findByRole('button', { name: 'Terminé' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'retour' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('glisser une icône sur une autre : un seul enregistrement, même en StrictMode', async () => {
  const { StrictMode } = await import('react')
  render(
    <StrictMode>
      <WithUser><MemoryRouter><HomePage /></MemoryRouter></WithUser>
    </StrictMode>,
  )
  await edit()
  const target = grid().querySelector('[data-app="session"]')!
  document.elementFromPoint = () => target
  fireEvent.pointerDown(icon('Amis'), { clientX: 200, clientY: 200, pointerId: 1 })
  fireEvent.pointerMove(window, { clientX: 20, clientY: 20, pointerId: 1 })
  fireEvent.pointerUp(window, { clientX: 20, clientY: 20, pointerId: 1 })
  expect(names()[0]).toBe('Amis')
  await new Promise((r) => setTimeout(r, 20))
  expect(saveHome).toHaveBeenCalledTimes(1)
  expect(lastSaved().apps[0]).toBe('friends')
})
