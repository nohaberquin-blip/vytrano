import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { saveWeekdays } from '../../data/calendar'
import { db } from '../../data/db'
import { createProgram, addDay } from '../../data/programs'
import { WithUser } from '../../test/auth'
import { UnitContext } from '../../app/units'
import { CalendarPage } from './CalendarPage'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 21, 10)) // mercredi 21 octobre 2026
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  const p = await createProgram('u', 'Prog')
  await addDay(p.id, 'Jour A')
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  await db.user_exercises.put({ id: 'f', user_id: 'u', exercise_id: 'squat', current_weight: 100, sets: 3, target_reps: 5, increment: 2.5 })
  for (const [id, day, weight] of [['a', 5, 100], ['b', 7, 105], ['c', 19, 110]] as const) {
    await db.workouts.put({ id, user_id: 'u', program_day_id: null, name: 'S', started_at: new Date(2026, 9, day, 12).toISOString(), finished_at: new Date(2026, 9, day, 13).toISOString(), status: 'done' })
    await db.workout_sets.put({ id: `${id}1`, workout_id: id, exercise_id: 'squat', position: 0, target_reps: 5, reps: 5, weight, done: true })
  }
})
afterEach(() => vi.useRealTimers())

const renderPage = () => render(<MemoryRouter><WithUser><CalendarPage /></WithUser></MemoryRouter>)

test('objectif du mois : proposé, modifié, remis par défaut', async () => {
  renderPage()
  const goal = await screen.findByRole('button', { name: 'Objectif d’octobre : 3 / 13 séances' })
  await userEvent.click(goal)
  await userEvent.click(screen.getByRole('button', { name: 'Diminuer l’objectif du mois' }))
  expect(await screen.findByRole('button', { name: 'Objectif d’octobre : 3 / 12 séances' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Par défaut' }))
  expect(await screen.findByRole('button', { name: 'Objectif d’octobre : 3 / 13 séances' })).toBeInTheDocument()
})

test('nouveau défi de séances puis de charge ; erreurs ; statut et suppression', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '＋ Nouveau défi' }))
  let sheet = await screen.findByRole('dialog', { name: 'Nouveau défi' })
  const count = within(sheet).getByRole('spinbutton', { name: 'Nombre de séances' })
  await userEvent.clear(count)
  await userEvent.type(count, '0')
  expect(within(sheet).getByText('Entre 1 et 200 séances')).toBeInTheDocument()
  await userEvent.clear(count)
  await userEvent.type(count, '2')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Créer le défi' }))
  const list = await screen.findByRole('region', { name: 'Mes défis' })
  expect(await within(list).findByText('Faire 2 séances')).toBeInTheDocument()
  expect(within(list).getByText(/^0 \/ 2 séances · jusqu’au 31 oct/)).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: '＋ Nouveau défi' }))
  sheet = await screen.findByRole('dialog', { name: 'Nouveau défi' })
  await userEvent.click(within(sheet).getByRole('button', { name: 'Charge' }))
  await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Exercice' }), 'squat')
  const kg = within(sheet).getByRole('spinbutton', { name: 'Charge visée (kg)' })
  await userEvent.clear(kg)
  await userEvent.type(kg, '100')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Créer le défi' }))
  // Les séances d'avant la création ne comptent pas.
  expect(await within(list).findByText('Squat à 100 kg')).toBeInTheDocument()
  expect(within(list).getByText(/^0 \/ 100 kg/)).toBeInTheDocument()

  vi.spyOn(window, 'confirm').mockReturnValue(true)
  await userEvent.click(within(list).getByRole('button', { name: 'Supprimer le défi « Faire 2 séances »' }))
  await vi.waitFor(() => expect(within(list).queryByText('Faire 2 séances')).not.toBeInTheDocument())
})

test('bilan du mois depuis le Calendrier', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Bilan du mois' }))
  const sheet = await screen.findByRole('dialog', { name: 'Ton bilan d’octobre' })
  expect(within(sheet).getByText('3 séances')).toBeInTheDocument()
  expect(within(sheet).getByText('Objectif : 13')).toBeInTheDocument()
  expect(within(sheet).getByText('+3 séances par rapport à septembre')).toBeInTheDocument()
  expect(within(sheet).getByText(/Records battus : Squat/)).toBeInTheDocument()
})

test('calendrier jamais réglé : défis et bilan restent accessibles', async () => {
  await db.training_schedules.clear()
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: '＋ Nouveau défi' }))
  const sheet = await screen.findByRole('dialog', { name: 'Nouveau défi' })
  await userEvent.click(within(sheet).getByRole('button', { name: 'Créer le défi' }))
  expect(await within(await screen.findByRole('region', { name: 'Mes défis' })).findByText(/^Faire \d+ séances$/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bilan du mois' }))
  expect(await screen.findByRole('dialog', { name: 'Ton bilan d’octobre' })).toBeInTheDocument()
})

test('en livres, l’erreur de charge est donnée en livres', async () => {
  render(<MemoryRouter><WithUser><UnitContext.Provider value="lb"><CalendarPage /></UnitContext.Provider></WithUser></MemoryRouter>)
  await userEvent.click(await screen.findByRole('button', { name: '＋ Nouveau défi' }))
  const sheet = await screen.findByRole('dialog', { name: 'Nouveau défi' })
  await userEvent.click(within(sheet).getByRole('button', { name: 'Charge' }))
  const lb = within(sheet).getByRole('spinbutton', { name: 'Charge visée (lb)' })
  await userEvent.clear(lb)
  await userEvent.type(lb, '2500')
  expect(within(sheet).getByText(/^Entre 2,2 lb et 2.202,4 lb$/)).toBeInTheDocument()
})
