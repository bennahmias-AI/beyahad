// src/utils/sounds.js
// צלילי ממשק (Web Audio) — צליל חיוג יוצא + צליל שליחת הודעה.
// משתמשים ב-AudioContext המשותף (audioUnlock) כדי שהצלילים יעבדו גם
// באפליקציה הנייטיב, לא רק בדפדפן.
import { getAudioCtx } from './audioUnlock.js'

// פעימת אקורד כפול קצרה (כמו צלצול טלפון)
function ringPulse(ctx, start, freq) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain); gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04)
  gain.gain.setValueAtTime(0.18, start + 0.32)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42)
  osc.start(start)
  osc.stop(start + 0.45)
}

// צליל חיוג יוצא — "רינג-רינג" אחד (יש להפעיל בלולאה כל ~3 שניות)
export function playOutgoingRing() {
  const ctx = getAudioCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    ringPulse(ctx, now, 440); ringPulse(ctx, now, 480)
    ringPulse(ctx, now + 0.6, 440); ringPulse(ctx, now + 0.6, 480)
  } catch (e) { /* ignore */ }
}

// צליל שליחת הודעה — "וושש" קצר עולה (כמו בוואטסאפ)
export function playMessageSent() {
  const ctx = getAudioCtx()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.24)
  } catch (e) { /* ignore */ }
}
