import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { presetTemplate, withWarmup, type SetTemplate } from '../../domain/methods'
import { MethodEditor } from './MethodEditor'

function Harness({ initial, onChange }: { initial: SetTemplate; onChange(t: SetTemplate): void }) {
  const [t, setT] = useState(initial)
  return <MethodEditor value={t} reference={120} onChange={(n) => { setT(n); onChange(n) }} />
}

function setup(initial = presetTemplate('classic')) {
  const onChange = vi.fn()
  render(<Harness initial={initial} onChange={onChange} />)
  return { onChange, last: () => onChange.mock.calls.at(-1)?.[0] as SetTemplate }
}

test('choisir une méthode remplit les séries', async () => {
  const { last } = setup()
  await userEvent.selectOptions(screen.getByLabelText('Méthode'), 'top_backoff')
  expect(last()).toEqual(presetTemplate('top_backoff'))
  expect(screen.getAllByText('102,5 kg')).toHaveLength(3)
})

test('cocher Échauffement ajoute les séries d’échauffement', async () => {
  const { last } = setup()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Échauffement' }))
  expect(last()).toEqual(withWarmup(presetTemplate('classic')))
})

test('modifier une série rend la méthode personnalisée', async () => {
  const { last } = setup(presetTemplate('top_backoff'))
  const pct = screen.getByLabelText('% série 2')
  await userEvent.clear(pct)
  await userEvent.type(pct, '80')
  expect(last().method).toBe('custom')
  expect(last().sets[1].pct).toBe(80)
})

test('un modèle sans série qui compte affiche une erreur', async () => {
  setup({ method: 'custom', sets: [{ kind: 'work', reps: 5, pct: 100 }] })
  await userEvent.selectOptions(screen.getByLabelText('Type série 1'), 'warmup')
  expect(screen.getByText('Au moins une série qui compte')).toBeInTheDocument()
})
