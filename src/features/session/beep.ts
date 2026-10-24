let ctx: AudioContext | null = null

/** À appeler pendant un toucher : iOS n'autorise le son qu'après une action de l'utilisateur. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* son indisponible */ }
}

/** Triple bip de fin de repos. */
export function playBeeps() {
  try {
    unlockAudio()
    if (!ctx) return
    const t0 = ctx.currentTime + 0.05
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      const t = t0 + i * 0.25
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.16)
    }
  } catch { /* son indisponible */ }
}
