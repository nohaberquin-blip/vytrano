import { render, screen } from '@testing-library/react'
import { listFriendships } from '../../data/social'
import { fetchFriendCards } from '../../data/progress'
import { WithUser } from '../../test/auth'
import { FriendsManager } from './FriendsManager'

vi.mock('../../data/social', async (orig) => ({
  ...(await orig<typeof import('../../data/social')>()),
  listFriendships: vi.fn(),
}))
vi.mock('../../data/progress', async (orig) => ({
  ...(await orig<typeof import('../../data/progress')>()),
  fetchFriendCards: vi.fn(),
}))

test('un ami qui partage : niveau, titre, série et badges', async () => {
  vi.mocked(listFriendships).mockResolvedValue({
    incoming: [], outgoing: [],
    friends: [
      { id: 'f1', status: 'accepted', mine: true, other: { user_id: 'a', username: 'lea', display_name: null } },
      { id: 'f2', status: 'accepted', mine: true, other: { user_id: 'b', username: 'tom', display_name: null } },
    ],
  })
  vi.mocked(fetchFriendCards).mockResolvedValue(new Map([['a', { level: 4, title: 'Débutant', streak: 6, badges: ['sessions-1', 'sessions-10', 'goal-1', 'streak-4'] }]]))
  render(<WithUser><FriendsManager onChange={() => {}} /></WithUser>)
  expect(await screen.findByText('Niv. 4 · Débutant · 🔥 6')).toBeInTheDocument()
  expect(screen.getByText('4 badges · 10 séances, Premier objectif atteint, 4 semaines de suite')).toBeInTheDocument()
  expect(fetchFriendCards).toHaveBeenCalledWith(['a', 'b'])
  expect(screen.getAllByText(/Niv\./)).toHaveLength(1)
})
