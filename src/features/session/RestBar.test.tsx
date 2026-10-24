import { act, fireEvent, render, screen } from '@testing-library/react'
import { RestBar } from './RestBar'
import { readRest, useRestTimer, writeRest } from './useRestTimer'
import { writeRestSettings } from './restSettings'
import { playBeeps } from './beep'

vi.mock('./beep', () => ({ playBeeps: vi.fn(), unlockAudio: vi.fn() }))

function Host({ start }: { start?: number }) {
  const timer = useRestTimer('w1')
  return (
    <>
      {start !== undefined && <button onClick={() => timer.start('s1', start, 'Squat · série 2 · 100 kg × 5')}>go</button>}
      {timer.rest && <RestBar {...timer} />}
    </>
  )
}

const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 25, 18))
  localStorage.clear()
  vi.mocked(playBeeps).mockClear()
  Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true })
})
afterEach(() => vi.useRealTimers())

test('démarrage, ajustements, fin unique, dépassement', () => {
  render(<Host start={90} />)
  fireEvent.click(screen.getByText('go'))
  const bar = screen.getByRole('timer', { name: 'Repos' })
  expect(bar).toHaveTextContent('1:30')
  expect(bar).toHaveTextContent('Ensuite : Squat · série 2 · 100 kg × 5')
  fireEvent.click(screen.getByRole('button', { name: '+30 s' }))
  expect(bar).toHaveTextContent('2:00')
  fireEvent.click(screen.getByRole('button', { name: '−15 s' }))
  expect(bar).toHaveTextContent('1:45')
  tick(105_000)
  expect(screen.getByRole('timer')).toHaveTextContent("C'est reparti !")
  tick(12_000)
  expect(screen.getByRole('timer')).toHaveTextContent('+0:12')
  expect(playBeeps).toHaveBeenCalledTimes(1)
  expect(navigator.vibrate).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(screen.queryByRole('timer')).toBeNull()
  expect(readRest()).toBeNull()
})

test('−15 s ne descend jamais sous 5 s restantes', () => {
  render(<Host start={20} />)
  fireEvent.click(screen.getByText('go'))
  fireEvent.click(screen.getByRole('button', { name: '−15 s' }))
  fireEvent.click(screen.getByRole('button', { name: '−15 s' }))
  expect(screen.getByRole('timer')).toHaveTextContent('0:05')
})

test('Passer efface le repos', () => {
  render(<Host start={90} />)
  fireEvent.click(screen.getByText('go'))
  fireEvent.click(screen.getByRole('button', { name: 'Passer' }))
  expect(screen.queryByRole('timer')).toBeNull()
  expect(readRest()).toBeNull()
})

test('reprise depuis le stockage ; autre séance ignorée et effacée', () => {
  writeRest({ workoutId: 'w1', setId: 's1', endsAt: Date.now() + 61_000, total: 90, next: 'x' })
  const { unmount } = render(<Host />)
  expect(screen.getByRole('timer')).toHaveTextContent('1:01')
  unmount()
  writeRest({ workoutId: 'autre', setId: 's1', endsAt: Date.now() + 61_000, total: 90, next: 'x' })
  render(<Host />)
  expect(screen.queryByRole('timer')).toBeNull()
  expect(readRest()).toBeNull()
})

test('fin ancienne au retour : pas de bip ; son et vibration désactivables', () => {
  writeRest({ workoutId: 'w1', setId: 's1', endsAt: Date.now() - 10_000, total: 90, next: 'x' })
  const { unmount } = render(<Host />)
  tick(1000)
  expect(screen.getByRole('timer')).toHaveTextContent('+0:11')
  expect(playBeeps).not.toHaveBeenCalled()
  unmount()
  writeRestSettings({ auto: true, sound: false, vibrate: false, wakeLock: true })
  render(<Host start={10} />)
  fireEvent.click(screen.getByText('go'))
  tick(10_000)
  expect(screen.getByRole('timer')).toHaveTextContent("C'est reparti !")
  expect(playBeeps).not.toHaveBeenCalled()
  expect(navigator.vibrate).not.toHaveBeenCalled()
})
