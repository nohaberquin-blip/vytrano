import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../../data/db'
import { addDay, addDayExercise, createProgram } from '../../data/programs'
import { WithUser } from '../../test/auth'
import { ProgramEditor } from './ProgramEditor'

test('étoile « Prioritaire » : bascule et enregistrement', async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  const p = await createProgram('u', 'Prog')
  const day = await addDay(p.id, 'Jour A')
  await db.exercises.put({ id: 'squat', owner_id: null, name: 'Squat', muscle_group: 'Jambes' })
  const item = await addDayExercise('u', day.id, 'squat')
  render(<WithUser><ProgramEditor programId={p.id} onBack={() => {}} /></WithUser>)
  const star = await screen.findByRole('button', { name: 'Prioritaire' })
  expect(star).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(star)
  expect(await screen.findByRole('button', { name: 'Prioritaire', pressed: true })).toBeInTheDocument()
  expect((await db.program_day_exercises.get(item.id))!.priority).toBe(true)
})
