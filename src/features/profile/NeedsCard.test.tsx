import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/db'
import { addWeight, getBodyProfile, saveBodyProfile } from '../../data/body'
import { saveWeekdays } from '../../data/calendar'
import { WithUser } from '../../test/auth'
import { NeedsCard } from './NeedsCard'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 25, 10))
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.useRealTimers())

const full = { sex: 'male', birth_date: '1996-10-25', height_cm: 180, activity: 'sedentary', sessions_per_week: 4, goal: 'cut' } as const
const card = () => screen.findByRole('region', { name: 'Mes besoins' })
const renderCard = () => render(<WithUser><NeedsCard /></WithUser>)

test('fiche complète et pesée : calories, macros, IMC', async () => {
  await saveBodyProfile('u', full)
  await addWeight('u', '2026-10-25', 75)
  renderCard()
  const c = await card()
  expect(await within(c).findByText(/1\s940 kcal/)).toBeInTheDocument()
  expect(c).toHaveTextContent('Protéines 165 g')
  expect(c).toHaveTextContent('Glucides 199 g')
  expect(c).toHaveTextContent('Lipides 54 g')
  expect(c).toHaveTextContent('IMC 23,1 (normal)')
  expect(c).toHaveTextContent('Sèche')
  expect(c).toHaveTextContent('Repères moyens, pas un avis médical.')
})

test('fiche vide : message, manques et ouverture de Ma fiche', async () => {
  renderCard()
  const c = await card()
  expect(c).toHaveTextContent('Complète ta fiche pour voir tes besoins')
  expect(c).toHaveTextContent('ta pesée')
  await userEvent.click(within(c).getByRole('button', { name: 'Ma fiche' }))
  expect(screen.getByRole('dialog', { name: 'Ma fiche' })).toBeInTheDocument()
})

test('Ma fiche : contrôle de l’âge, séances pré-remplies par le calendrier, enregistrement', async () => {
  await saveWeekdays('u', [1, 3, 5], '2026-10-01')
  renderCard()
  await userEvent.click(within(await card()).getByRole('button', { name: 'Ma fiche' }))
  const sheet = screen.getByRole('dialog', { name: 'Ma fiche' })
  expect(within(sheet).getByLabelText('Séances par semaine')).toHaveValue('3')
  const birth = within(sheet).getByLabelText('Date de naissance')
  await userEvent.type(birth, '2016-01-01')
  expect(within(sheet).getByText('Âge : 13 à 100 ans')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await userEvent.clear(birth)
  await userEvent.type(birth, '1996-10-25')
  expect(within(sheet).getByText('30 ans')).toBeInTheDocument()
  await userEvent.selectOptions(within(sheet).getByLabelText('Sexe'), 'female')
  await userEvent.type(within(sheet).getByLabelText('Taille (cm)'), '165')
  await userEvent.click(within(sheet).getByRole('radio', { name: /Peu actif/ }))
  await userEvent.selectOptions(within(sheet).getByLabelText('Objectif'), 'maintain')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
  expect(await getBodyProfile('u')).toMatchObject({
    sex: 'female', birth_date: '1996-10-25', height_cm: 165, activity: 'light', sessions_per_week: 3, goal: 'maintain',
  })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Ma fiche : taille hors limites refusée', async () => {
  renderCard()
  await userEvent.click(within(await card()).getByRole('button', { name: 'Ma fiche' }))
  await userEvent.type(screen.getByLabelText('Taille (cm)'), '300')
  expect(screen.getByText('Taille : 120 à 230 cm')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
})

test('Ajuster : glucides recalculés en direct, valeur perso, retour aux valeurs conseillées', async () => {
  await saveBodyProfile('u', full)
  await addWeight('u', '2026-10-25', 75)
  renderCard()
  const c = await card()
  await within(c).findByText(/1\s940 kcal/)
  await userEvent.click(within(c).getByRole('button', { name: 'Ajuster' }))
  const sheet = screen.getByRole('dialog', { name: 'Ajuster mes besoins' })
  expect(sheet).toHaveTextContent('Glucides : 199 g')
  await userEvent.type(within(sheet).getByLabelText('Calories par jour'), '2500')
  expect(sheet).toHaveTextContent('Glucides : 305 g')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await within(c).findByText(/2\s500 kcal/)).toBeInTheDocument()
  expect(c).toHaveTextContent('(perso)')
  await userEvent.click(within(c).getByRole('button', { name: 'Ajuster' }))
  await userEvent.click(screen.getByRole('button', { name: 'Revenir aux valeurs conseillées' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await within(c).findByText(/1\s940 kcal/)).toBeInTheDocument()
  expect(c).not.toHaveTextContent('(perso)')
})

test('glucides épuisés : avertissement', async () => {
  await saveBodyProfile('u', { ...full, kcal_override: 1200, protein_per_kg: 3 })
  await addWeight('u', '2026-10-25', 75)
  renderCard()
  expect(await within(await card()).findByText('0 g de glucides : baisse les protéines ou les lipides')).toBeInTheDocument()
})

test('Ajuster : décimales refusées pour calories et lipides, espaces acceptés', async () => {
  await saveBodyProfile('u', full)
  await addWeight('u', '2026-10-25', 75)
  renderCard()
  const c = await card()
  await within(c).findByText(/1\s940 kcal/)
  await userEvent.click(within(c).getByRole('button', { name: 'Ajuster' }))
  const sheet = screen.getByRole('dialog', { name: 'Ajuster mes besoins' })
  const kcal = within(sheet).getByLabelText('Calories par jour')
  await userEvent.type(kcal, '2500,5')
  expect(within(sheet).getByText('Calories : nombre entier de 1 000 à 6 000')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await userEvent.clear(kcal)
  await userEvent.type(kcal, '2 500')
  expect(sheet).toHaveTextContent('Glucides : 305 g')
  await userEvent.type(within(sheet).getByLabelText('Lipides (% des calories)'), '22,5')
  expect(within(sheet).getByText('Lipides : nombre entier de 15 à 40 %')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
})
