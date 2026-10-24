import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { saveWeekdays } from '../../data/calendar'
import { addDay, createProgram } from '../../data/programs'
import { WithUser } from '../../test/auth'
import { CalendarPage } from './CalendarPage'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 10)) // mercredi 21 octobre 2026
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.useRealTimers())

async function seed() {
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  const p = await createProgram('u', 'Prog')
  for (const name of ['Jour A', 'Jour B', 'Jour C']) await addDay(p.id, name)
  await db.workouts.put({
    id: 'w1', user_id: 'u', program_day_id: null, name: 'Libre',
    started_at: new Date(2026, 9, 19, 18).toISOString(), finished_at: new Date(2026, 9, 19, 19).toISOString(), status: 'done',
  })
}

const renderPage = () => render(<MemoryRouter><WithUser><CalendarPage /></WithUser></MemoryRouter>)

test('sans réglage : choix des jours, Valider désactivé tant que rien n’est coché', async () => {
  renderPage()
  expect(await screen.findByText("Quels jours tu t'entraînes ?")).toBeInTheDocument()
  const valider = screen.getByRole('button', { name: 'Valider' })
  expect(valider).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Lundi' }))
  await userEvent.click(screen.getByRole('button', { name: 'Mercredi' }))
  await userEvent.click(valider)
  expect(await screen.findByText('Octobre 2026')).toBeInTheDocument()
  expect(await db.training_schedules.get('u')).toMatchObject({ weekdays: [1, 3], since: '2026-10-21' })
})

test('vue mois : pastilles et progression de la semaine', async () => {
  await seed()
  renderPage()
  expect(await screen.findByRole('button', { name: '19 octobre, fait' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '21 octobre, prévu' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '20 octobre, repos' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '16 octobre, manqué' })).toBeInTheDocument()
  expect(screen.getByText('1/3')).toBeInTheDocument()
})

test('bascule Semaine : 7 lignes avec la séance prévue et l’objectif', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Semaine' }))
  expect(await screen.findByRole('button', { name: 'Objectif : 1/3 séances' })).toBeInTheDocument()
  expect(within(screen.getByRole('button', { name: /mercredi 21 octobre/ })).getByText('Jour A')).toBeInTheDocument()
  expect(within(screen.getByRole('button', { name: /vendredi 23 octobre/ })).getByText('Jour B')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /octobre, (fait|prévu|repos|manqué|reporté)$/ })).toHaveLength(7)
})

test('détail d’un jour prévu futur : Déplacer puis Annuler le report', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '23 octobre, prévu' }))
  const sheet = screen.getByRole('dialog')
  expect(within(sheet).getByText('Jour B')).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'Commencer' })).toBeNull()
  await userEvent.click(within(sheet).getByRole('button', { name: 'Déplacer' }))
  expect(within(sheet).queryByRole('button', { name: 'lundi 26 octobre' })).toBeNull() // déjà prévu
  expect(within(sheet).getByRole('button', { name: 'jeudi 22 octobre' })).toBeInTheDocument()
  await userEvent.click(within(sheet).getByRole('button', { name: 'samedi 24 octobre' }))
  expect(await screen.findByRole('button', { name: '23 octobre, reporté' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '24 octobre, prévu' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '23 octobre, reporté' }))
  expect(screen.getByText(/Séance déplacée au samedi 24 octobre/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Annuler le report' }))
  expect(await screen.findByRole('button', { name: '23 octobre, prévu' })).toBeInTheDocument()
})

test('aujourd’hui prévu : Commencer ; Passer en repos', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '21 octobre, prévu' }))
  expect(screen.getByRole('button', { name: 'Commencer' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Passer en repos' }))
  expect(await screen.findByRole('button', { name: '21 octobre, repos' })).toBeInTheDocument()
})

test('détail d’un jour de repos futur : Ajouter une séance ce jour', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '22 octobre, repos' }))
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter une séance ce jour' }))
  expect(await screen.findByRole('button', { name: '22 octobre, prévu' })).toBeInTheDocument()
})

test('jour manqué et jour fait', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '16 octobre, manqué' }))
  expect(screen.getByText("Séance manquée — elle a glissé au prochain jour d'entraînement")).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  await userEvent.click(screen.getByRole('button', { name: '19 octobre, fait' }))
  expect(within(screen.getByRole('dialog')).getByText('Libre')).toBeInTheDocument()
})

test('objectif modifiable depuis la vue semaine (−, +, Par défaut)', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Semaine' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Objectif : 1/3 séances' }))
  await userEvent.click(screen.getByRole('button', { name: "Augmenter l'objectif" }))
  expect(await screen.findByRole('button', { name: 'Objectif : 1/4 séances' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: "Diminuer l'objectif" }))
  await userEvent.click(screen.getByRole('button', { name: "Diminuer l'objectif" }))
  expect(await screen.findByRole('button', { name: 'Objectif : 1/2 séances' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Par défaut' }))
  expect(await screen.findByRole('button', { name: 'Objectif : 1/3 séances' })).toBeInTheDocument()
})

test('‹ › changent de période ; « Aujourd’hui » revient ; la vue est mémorisée', async () => {
  await seed()
  const { unmount } = renderPage()
  expect(await screen.findByText('Octobre 2026')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Suivant' }))
  expect(screen.getByText('Novembre 2026')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Précédent' }))
  await userEvent.click(screen.getByRole('button', { name: 'Précédent' }))
  expect(screen.getByText('Septembre 2026')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }))
  expect(screen.getByText('Octobre 2026')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Semaine' }))
  expect(screen.getByText('19 – 25 oct.')).toBeInTheDocument()
  unmount()
  renderPage()
  expect(await screen.findByText('19 – 25 oct.')).toBeInTheDocument()
})

test('⚙︎ rouvre le réglage des jours, déjà cochés', async () => {
  await seed()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: "Jours d'entraînement" }))
  expect(screen.getByRole('button', { name: 'Lundi' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Mardi' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
  expect(await screen.findByText('Octobre 2026')).toBeInTheDocument()
})
