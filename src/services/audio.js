let audioCtx = null

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

export function playHourlyChime() {
  try {
    const ctx = getAudioContext()
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.value = freq

      const startAt = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(0.25, startAt + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.5)

      osc.start(startAt)
      osc.stop(startAt + 0.5)
    })
  } catch {}
}

export function playConfirmBeep() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export function showHourlyNotification(stationName, hours) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`⏰ ${stationName} — ${hours}h reached`, {
      body: 'Check in with the customer!',
      tag: `hourly-${stationName}`,
      silent: true,
    })
  }
}
