import { keepLocalHome } from './profile'
import { testProfile } from '../test/auth'

test('profil relu du serveur : la disposition modifiée sur cet appareil est gardée', () => {
  const fetched = { ...testProfile, home: { apps: ['session'] } }
  expect(keepLocalHome(fetched, undefined)).toBe(fetched)
  expect(keepLocalHome(fetched, { local: { apps: ['friends'] } })?.home).toEqual({ apps: ['friends'] })
  expect(keepLocalHome(null, { local: { apps: ['friends'] } })).toBeNull()
})
