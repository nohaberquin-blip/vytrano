import { useState, type ReactNode } from 'react'
import { AuthContext } from '../features/auth/AuthProvider'
import type { Profile } from '../domain/types'

export const testProfile: Profile = { user_id: 'u', username: 'moi', display_name: null, share_workouts: true, unit: 'kg' }

export function WithUser({ children, profile = testProfile }: { children: ReactNode; profile?: Profile }) {
  // Comme le vrai fournisseur : `patchProfile` met à jour le profil vu par toute l'app.
  const [current, setCurrent] = useState(profile)
  return (
    <AuthContext.Provider value={{
      loading: false, user: { id: profile.user_id }, profile: current, recovering: false, endRecovery: () => {},
      refreshProfile: async () => {}, signOut: async () => {},
      patchProfile: (changes) => setCurrent((p) => ({ ...p, ...changes })),
    }}>
      {children}
    </AuthContext.Provider>
  )
}
