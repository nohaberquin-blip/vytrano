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

test('programmer une alarme : upsert avec keepalive et le jeton de l’utilisateur', async () => {
  scheduleRestAlarm('u', Date.UTC(2026, 9, 25, 18, 2, 30), 'Squat · série 3', true)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe(`${supabaseUrl}/rest/v1/rest_alarms`)
  expect(init).toMatchObject({ method: 'POST', keepalive: true })
  expect(init.headers).toMatchObject({ Authorization: 'Bearer jeton', Prefer: 'resolution=merge-duplicates,return=minimal' })
  expect(JSON.parse(init.body)).toEqual({ user_id: 'u', fire_at: '2026-10-25T18:02:30.000Z', title: 'Repos terminé', body: 'Squat · série 3' })
})

test('annuler une alarme : DELETE de la ligne de l’utilisateur', async () => {
  cancelRestAlarm('u', true)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe(`${supabaseUrl}/rest/v1/rest_alarms?user_id=eq.u`)
  expect(init).toMatchObject({ method: 'DELETE', keepalive: true })
})

test('sans session : rien n’est envoyé', async () => {
  localStorage.clear()
  scheduleRestAlarm('u', Date.now(), 'x')
  await new Promise((r) => setTimeout(r, 10))
  expect(fetchMock).not.toHaveBeenCalled()
})

test('prise en charge : iPhone hors écran d’accueil, navigateur sans push', () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', serviceWorker: {} })
  expect(pushSupport()).toBe('ios-home-screen')
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux)' })
  expect(pushSupport()).toBe('unsupported')
  expect(pushEnabledFlag()).toBe(false)
})

test('les requêtes partent dans l’ordre : l’annulation attend la programmation', async () => {
  let release!: () => void
  fetchMock.mockImplementationOnce(() => new Promise((r) => { release = () => r(new Response(null, { status: 201 })) }))
  scheduleRestAlarm('u', Date.now(), 'x')
  cancelRestAlarm('u')
  await Promise.resolve()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  release()
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
})

test('texte de notification limité à 200 caractères', async () => {
  scheduleRestAlarm('u', Date.now(), 'x'.repeat(300))
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body).body).toHaveLength(200)
})

test('app ouverte : requête normale, sans keepalive', async () => {
  scheduleRestAlarm('u', Date.now(), 'x', false)
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
  expect(fetchMock.mock.calls.at(-1)![1].keepalive).toBe(false)
})
