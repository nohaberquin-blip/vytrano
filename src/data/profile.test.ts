import { fetchProfile } from './profile'

let columns = ''
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: (cols: string) => {
        columns = cols
        const known = ['*', 'user_id', 'username', 'display_name', 'share_workouts', 'unit']
        const bad = cols.split(',').map((c) => c.trim()).some((c) => !known.includes(c))
        const result = bad
          ? { data: null, error: { code: '42703', message: 'column does not exist' } }
          : { data: { user_id: 'u', username: 'moi', display_name: null, share_workouts: true, unit: 'kg' }, error: null }
        return { eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }
      },
    }),
  },
}))

test('profil lu même si une colonne récente n’existe pas encore sur le serveur', async () => {
  localStorage.clear()
  expect(await fetchProfile('u')).toMatchObject({ username: 'moi' })
  expect(columns).toBe('*')
})
