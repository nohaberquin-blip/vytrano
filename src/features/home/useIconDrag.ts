import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AppId } from '../../domain/home'

const LONG_PRESS_MS = 500
const MOVE_PX = 10
/** Après un déplacement, le doigt doit encore bouger de cette distance : le bento se réorganise sous un doigt immobile. */
const SETTLE_PX = 16

/**
 * Appui long (passe en mode Modifier) et glisser-déposer des icônes, au doigt comme à la souris.
 * Pendant le glisser, `onOver` reçoit l'icône survolée ; `onDrop` est appelé au relâchement.
 * Après un appui long ou un glisser, le clic qui suit est ignoré (`consumeClick`).
 */
export function useIconDrag({ editing, onLongPress, onOver, onDrop }: {
  editing: boolean; onLongPress(): void; onOver(id: AppId, target: AppId): void; onDrop(): void
}) {
  const [dragging, setDragging] = useState<AppId | null>(null)
  const state = useRef<{ id: AppId; x: number; y: number; moved: boolean; timer?: number; settle?: { x: number; y: number } } | null>(null)
  const swallow = useRef(false)
  const cbs = useRef({ onLongPress, onOver, onDrop, editing })
  cbs.current = { onLongPress, onOver, onDrop, editing }

  useEffect(() => () => window.clearTimeout(state.current?.timer), [])

  function end() {
    const s = state.current
    state.current = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.clearTimeout(s?.timer)
    return s
  }
  function move(e: PointerEvent) {
    const s = state.current
    if (!s) return
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < MOVE_PX) return
    if (!cbs.current.editing) { end(); return }
    if (!s.moved) { s.moved = true; window.clearTimeout(s.timer); setDragging(s.id) }
    if (s.settle && Math.hypot(e.clientX - s.settle.x, e.clientY - s.settle.y) < SETTLE_PX) return
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-app]')?.dataset.app as AppId | undefined
    if (over && over !== s.id) {
      s.settle = { x: e.clientX, y: e.clientY }
      cbs.current.onOver(s.id, over)
    }
  }
  function up() {
    const s = end()
    if (s?.moved) { swallow.current = true; setDragging(null); cbs.current.onDrop() }
  }
  function cancel() {
    if (end()?.moved) { setDragging(null); cbs.current.onDrop() }
  }

  function onPointerDown(id: AppId, e: ReactPointerEvent) {
    if (e.button > 0) return // clic droit ou du milieu
    end()
    swallow.current = false
    state.current = { id, x: e.clientX, y: e.clientY, moved: false }
    if (!cbs.current.editing) {
      state.current.timer = window.setTimeout(() => { swallow.current = true; end(); cbs.current.onLongPress() }, LONG_PRESS_MS)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  /** Vrai si le clic doit être ignoré (il suit un appui long ou un glisser). */
  function consumeClick() {
    const s = swallow.current
    swallow.current = false
    return s
  }

  return { dragging, onPointerDown, consumeClick }
}
