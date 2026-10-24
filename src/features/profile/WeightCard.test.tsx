import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/db'
import { addWeight, listWeights } from '../../data/body'
import { UnitContext } from '../../app/units'
import { WithUser } from '../../test/auth'
import { WeightCard } from './WeightCard'

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 25, 10)) // dimanche 25 octobre 2026
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => vi.useRealTimers())

const renderCard = (unit: 'kg' | 'lb' = 'kg') =>
  render(<WithUser><UnitContext.Provider value={unit}><WeightCard /></UnitContext.Provider></WithUser>)
const card = () => screen.findByRole('region', { name: 'Mon poids' })

async function addViaSheet(text: string, date?: string) {
  await userEvent.click(within(await card()).getByRole('button', { name: '＋ Pesée' }))
  const sheet = screen.getByRole('dialog', { name: 'Nouvelle pesée' })
  await userEvent.type(within(sheet).getByLabelText(/Poids/), text)
  if (date) {
    await userEvent.clear(within(sheet).getByLabelText('Date'))
    await userEvent.type(within(sheet).getByLabelText('Date'), date)
  }
  return sheet
}

test('sans pesée : invitation ; ajout d’une pesée', async () => {
  renderCard()
  expect(await card()).toHaveTextContent('Ajoute ta première pesée')
  const sheet = await addViaSheet('75,4')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await within(await card()).findByText('75,4 kg')).toBeInTheDocument()
  expect(await listWeights('u')).toMatchObject([{ date: '2026-10-25', weight_kg: 75.4 }])
})

test('écart sur 30 jours, sinon depuis la première pesée', async () => {
  await addWeight('u', '2026-09-15', 77)
  await addWeight('u', '2026-10-25', 75.4)
  const { unmount } = renderCard()
  expect(await within(await card()).findByText('− 1,6 kg en 30 jours')).toBeInTheDocument()
  unmount()
  await db.weight_entries.clear()
  await addWeight('u', '2026-10-15', 76)
  await addWeight('u', '2026-10-25', 75.4)
  renderCard()
  expect(await within(await card()).findByText('− 0,6 kg depuis le 15 oct.')).toBeInTheDocument()
})

test('saisie en lb : stockée en kg, affichée en lb', async () => {
  renderCard('lb')
  const sheet = await addViaSheet('166')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Enregistrer' }))
  await waitFor(async () => expect(await listWeights('u')).toMatchObject([{ weight_kg: 75.3 }]))
  expect(await within(await card()).findByText('166 lb')).toBeInTheDocument()
})

test('bornes : poids trop faible et date future refusés', async () => {
  renderCard()
  const sheet = await addViaSheet('20')
  expect(within(sheet).getByText('Poids : 30 à 300 kg')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  await userEvent.clear(within(sheet).getByLabelText(/Poids/))
  await userEvent.type(within(sheet).getByLabelText(/Poids/), '75')
  await userEvent.clear(within(sheet).getByLabelText('Date'))
  await userEvent.type(within(sheet).getByLabelText('Date'), '2026-10-26')
  expect(within(sheet).getByText('La date ne peut pas être dans le futur')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
})

test('historique : suppression d’une pesée', async () => {
  await addWeight('u', '2026-10-20', 76)
  await addWeight('u', '2026-10-25', 75.4)
  renderCard()
  await userEvent.click(within(await card()).getByRole('button', { name: 'Historique' }))
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer la pesée du mardi 20 octobre' }))
  await waitFor(async () => expect(await listWeights('u')).toHaveLength(1))
})

test('courbe : périodes et cas à une seule pesée', async () => {
  await addWeight('u', '2026-04-08', 80)
  await addWeight('u', '2026-09-15', 77)
  await addWeight('u', '2026-10-25', 75.4)
  renderCard()
  const chart = await screen.findByRole('img', { name: 'Courbe du poids' })
  expect(chart).toHaveAttribute('data-points', '2')
  await userEvent.click(screen.getByRole('button', { name: '1 mois' }))
  expect(screen.getByRole('img', { name: 'Courbe du poids' })).toHaveAttribute('data-points', '1')
  await userEvent.click(screen.getByRole('button', { name: 'Tout' }))
  expect(screen.getByRole('img', { name: 'Courbe du poids' })).toHaveAttribute('data-points', '3')
})
