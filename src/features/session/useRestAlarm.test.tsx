import { act, render } from '@testing-library/react'
import { useRestAlarm } from './useRestAlarm'
import { cancelRestAlarm, pushEnabledFlag, scheduleRestAlarm } from '../../data/push'
import type { RestState } from './useRestTimer'

vi.mock('../../data/push', () => ({ scheduleRestAlarm: vi.fn(), cancelRestAlarm: vi.fn(), pushEnabledFlag: vi.fn(() => true) }))

function Host({ rest }: { rest: RestState | null }) {
  useRestAlarm('u', rest)
  return null
}

let visibility: DocumentVisibilityState = 'visible'
Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true })
const setVisibility = (v: DocumentVisibilityState) => act(() => {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
})
const rest = (endsIn: number): RestState => ({ workoutId: 'w', setId: 's', endsAt: Date.now() + endsIn, total: 90, next: 'Squat · série 2' })

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(scheduleRestAlarm).mockClear()
  vi.mocked(cancelRestAlarm).mockClear()
  vi.mocked(pushEnabledFlag).mockReturnValue(true)
  visibility = 'visible'
})
afterEach(() => vi.useRealTimers())

test('dès le début du repos, app ouverte : alarme programmée (le verrouillage peut couper tout envoi)', () => {
  const r = rest(60_000)
  render(<Host rest={r} />)
  expect(scheduleRestAlarm).toHaveBeenCalledWith('u', r.endsAt, 'Squat · série 2', false)
  setVisibility('hidden')
  setVisibility('visible')
  expect(scheduleRestAlarm).toHaveBeenCalledTimes(1)
  expect(cancelRestAlarm).not.toHaveBeenCalled()
})

test('ajustement : alarme déplacée ; Passer : alarme annulée', () => {
  const r = rest(60_000)
  const { rerender } = render(<Host rest={r} />)
  const later = { ...r, endsAt: r.endsAt + 30_000 }
  rerender(<Host rest={later} />)
  expect(scheduleRestAlarm).toHaveBeenLastCalledWith('u', later.endsAt, 'Squat · série 2', false)
  rerender(<Host rest={null} />)
  expect(cancelRestAlarm).toHaveBeenCalledTimes(1)
})

test('app au premier plan à l’approche de la fin : annulation, le bip de l’app suffit', () => {
  render(<Host rest={rest(20_000)} />)
  act(() => { vi.advanceTimersByTime(13_000) })
  expect(cancelRestAlarm).not.toHaveBeenCalled()
  act(() => { vi.advanceTimersByTime(1_500) })
  expect(cancelRestAlarm).toHaveBeenCalledTimes(1)
})

test('mise en arrière-plan dans les dernières secondes : alarme reprogrammée', () => {
  const r = rest(20_000)
  render(<Host rest={r} />)
  act(() => { vi.advanceTimersByTime(16_000) })
  setVisibility('hidden')
  expect(scheduleRestAlarm).toHaveBeenLastCalledWith('u', r.endsAt, 'Squat · série 2', true)
})

test('au montage sans repos : annulation d’une éventuelle alarme d’une visite précédente', () => {
  render(<Host rest={null} />)
  expect(cancelRestAlarm).toHaveBeenCalledTimes(1)
})

test('alertes non activées : aucune requête', () => {
  vi.mocked(pushEnabledFlag).mockReturnValue(false)
  const { rerender } = render(<Host rest={rest(60_000)} />)
  setVisibility('hidden')
  rerender(<Host rest={null} />)
  expect(scheduleRestAlarm).not.toHaveBeenCalled()
  expect(cancelRestAlarm).not.toHaveBeenCalled()
})
