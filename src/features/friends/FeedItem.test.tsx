import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedItem } from './FeedItem'
import type { FeedEntry } from '../../data/social'

const entry: FeedEntry = {
  id: 'w1', user_id: 'b', username: 'lea', display_name: null, day_name: 'Push',
  started_at: '2026-10-20T18:00:00Z', finished_at: '2026-10-20T18:42:00Z',
  exercise_count: 5, duration_min: 42, reaction_count: 3, reacted_by_me: false,
}

test('affiche la séance et réagit de façon optimiste', async () => {
  const onReact = vi.fn().mockResolvedValue({ error: null })
  render(<FeedItem entry={entry} onReact={onReact} onOpen={() => {}} />)
  expect(screen.getByText('lea')).toBeInTheDocument()
  expect(screen.getByText('Push')).toBeInTheDocument()
  expect(screen.getByText('5 exercices · 42 min')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /💪 3/ }))
  expect(screen.getByRole('button', { name: /💪 4/ })).toHaveAttribute('aria-pressed', 'true')
  expect(onReact).toHaveBeenCalledWith('w1', true)
})

test('échec de la réaction → retour à l’état initial', async () => {
  const onReact = vi.fn().mockResolvedValue({ error: { message: 'Failed to fetch' } })
  render(<FeedItem entry={entry} onReact={onReact} onOpen={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /💪 3/ }))
  expect(await screen.findByRole('button', { name: /💪 3/ })).toHaveAttribute('aria-pressed', 'false')
})
