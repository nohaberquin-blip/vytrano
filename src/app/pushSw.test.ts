import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Exécute public/push-sw.js avec un faux `self` et renvoie le gestionnaire de clic sur la notification. */
function load(clients: { matchAll(): Promise<unknown[]>; openWindow: ReturnType<typeof vi.fn> }) {
  const handlers: Record<string, (e: unknown) => void> = {}
  const self = { addEventListener: (t: string, h: (e: unknown) => void) => { handlers[t] = h }, clients, registration: {} }
  new Function('self', readFileSync(resolve(__dirname, '../../public/push-sw.js'), 'utf8'))(self)
  return async () => {
    let wait: Promise<unknown> = Promise.resolve()
    handlers.notificationclick({ notification: { close() {} }, waitUntil: (p: Promise<unknown>) => { wait = p } })
    await wait
  }
}

test('toucher « Repos terminé » sans app ouverte ouvre la Séance', async () => {
  const openWindow = vi.fn()
  await load({ matchAll: async () => [], openWindow })()
  expect(openWindow).toHaveBeenCalledWith('/seance')
})

test('app déjà ouverte : elle passe au premier plan sur la Séance', async () => {
  const navigate = vi.fn()
  const client = { focus: vi.fn(async () => client), navigate }
  await load({ matchAll: async () => [client], openWindow: vi.fn() })()
  expect(client.focus).toHaveBeenCalled()
  expect(navigate).toHaveBeenCalledWith('/seance')
})
