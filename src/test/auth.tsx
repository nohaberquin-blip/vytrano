import type { ReactNode } from 'react'
import { AuthContext } from '../features/auth/AuthProvider'
import type { Profile } from '../domain/types'

export const testProfile: Profile = { user_id: 'u', username: 'moi', display_name: null, share_workouts: true, unit: 'kg' }

export function WithUser({ children, profile = testProfile }: { children: ReactNode; profile?: Profile }) {
  return (
    <AuthContext.Provider value={{
      loading: false, user: { id: profile.user_id }, profile,
      refreshProfile: async () => {}, signOut: async () => {},
    }}>
      {children}
    </AuthContext.Provider>
  )
}
