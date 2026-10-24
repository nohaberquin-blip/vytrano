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
  vi.mocked(scheduleRestAlarm).mockClear()
  vi.mocked(cancelRestAlarm).mockClear()
  vi.mocked(pushEnabledFlag).mockReturnValue(true)
  visibility = 'visible'
})

test('arrière-plan pendant un repos : alarme programmée ; retour : annulée', () => {
  const r = rest(60_000)
  render(<Host rest={r} />)
  setVisibility('hidden')
  expect(scheduleRestAlarm).toHaveBeenCalledWith('u', r.endsAt, 'Squat · série 2')
  setVisibility('visible')
  expect(cancelRestAlarm).toHaveBeenLastCalledWith('u')
})

test('repos presque fini, sans repos ou sans alertes : rien', () => {
  const { rerender } = render(<Host rest={rest(2000)} />)
  setVisibility('hidden')
  rerender(<Host rest={null} />)
  setVisibility('visible')
  setVisibility('hidden')
  vi.mocked(pushEnabledFlag).mockReturnValue(false)
  rerender(<Host rest={rest(60_000)} />)
  setVisibility('visible')
  setVisibility('hidden')
  expect(scheduleRestAlarm).not.toHaveBeenCalled()
})

test('au montage et à chaque retour au premier plan : annulation, même sans programmation dans cette page', () => {
  render(<Host rest={null} />)
  expect(cancelRestAlarm).toHaveBeenCalledTimes(1)
  setVisibility('hidden')
  setVisibility('visible')
  expect(cancelRestAlarm).toHaveBeenCalledTimes(2)
})
