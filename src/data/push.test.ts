import { cancelRestAlarm, pushEnabledFlag, pushSupport, scheduleRestAlarm } from './push'
import { supabaseUrl } from './supabase'

const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  const ref = new URL(supabaseUrl).hostname.split('.')[0]
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: 'jeton' }))
})
afterEach(() => vi.unstubAllGlobals())

test('programmer une alarme : upsert avec keepalive et le jeton de l’utilisateur', () => {
  scheduleRestAlarm('u', Date.UTC(2026, 9, 25, 18, 2, 30), 'Squat · série 3')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe(`${supabaseUrl}/rest/v1/rest_alarms`)
  expect(init).toMatchObject({ method: 'POST', keepalive: true })
  expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton', Prefer: 'resolution=merge-duplicates,return=minimal' })
  expect(JSON.parse(init.body)).toEqual({ user_id: 'u', fire_at: '2026-10-25T18:02:30.000Z', title: 'Repos terminé', body: 'Squat · série 3' })
})

test('annuler une alarme : DELETE de la ligne de l’utilisateur', () => {
  cancelRestAlarm('u')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe(`${supabaseUrl}/rest/v1/rest_alarms?user_id=eq.u`)
  expect(init).toMatchObject({ method: 'DELETE', keepalive: true })
})

test('sans session : rien n’est envoyé', () => {
  localStorage.clear()
  scheduleRestAlarm('u', Date.now(), 'x')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('prise en charge : iPhone hors écran d’accueil, navigateur sans push', () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', serviceWorker: {} })
  expect(pushSupport()).toBe('ios-home-screen')
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux)' })
  expect(pushSupport()).toBe('unsupported')
  expect(pushEnabledFlag()).toBe(false)
})
