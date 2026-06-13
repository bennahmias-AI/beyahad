// src/utils/gameSounds.js
// ─────────────────────────────────────────────────────────────
// סאונדים למשחקים — מבוססי Web Audio API (בלי קבצים!)
//
// היתרון של הגישה הזו:
//   • אפס קבצים — הסאונד נוצר בזמן אמת ב-JavaScript
//   • אפס latency — מתנגן מיד
//   • שליטה מלאה בצליל
//
// שימוש:
//   import { playSound, isMuted, setMuted } from '../utils/gameSounds'
//   playSound('drop')      // מנגן סאונד של דיסקית נופלת
//   playSound('win')       // מנגן סאונד של ניצחון
//   setMuted(true)         // משתיק
//   isMuted()              // האם מושתק?
// ─────────────────────────────────────────────────────────────

// מפתח ב-localStorage לשמירת ההעדפה
const STORAGE_KEY = 'beyahad-game-sound-muted'

// AudioContext singleton — יוצרים פעם אחת ומחזיקים
let audioCtx = null

// מאתחלים את ה-AudioContext (חייב לקרות אחרי אינטראקציה של המשתמש)
function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API not supported:', e)
      return null
    }
  }
  // אם ה-context הושעה (קורה אחרי resume של דפדפן) — מנסים להחיות
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// בודק אם הסאונד מושתק
export function isMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch (e) {
    return false
  }
}

// קובע את מצב ההשתקה
export function setMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'true' : 'false')
  } catch (e) {}
}

// ────────────────────────────────────────────────
// סאונד "דיסקית נופלת" — Subtle click (UI tap)
// ────────────────────────────────────────────────
// קליק נקי ומינימאלי — כמו תקתוק על מקלדת טלפון.
// מבנה: רעש לבן קצרצר (25ms) עם עיכוב מעריכי להדמית מגע קצר וחד.
// פילטר bandpass על 3000Hz — מדגיש תדרים גבוהים למען התחושה הנקיה.
function playDropSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const duration = 0.025  // 25ms — קליק קצרצר ונקי

  // יוצרים buffer של רעש לבן עם עיכוב מעריכי (נדעך לאפס מהר)
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    // עיכוב מעריכי — מתחילים חזק ודועכים לאפס מהר
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.1))
  }

  const src = ctx.createBufferSource()
  src.buffer = buf

  // פילטר bandpass שמעביר רק תדרים סביב 3000Hz — נותן את התחושה של "טפ"
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 3000
  filter.Q.value = 0.8

  const gain = ctx.createGain()
  gain.gain.value = 0.35

  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start(now)
  src.stop(now + duration)
}

// ────────────────────────────────────────────────
// סאונד ניצחון — 3 צלילים עולים יפים (אקורד דו מאז'ור)
// ────────────────────────────────────────────────
function playWinSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  // 3 תווים עולים: C5 → E5 → G5
  const notes = [
    { freq: 523.25, time: 0 },     // C5
    { freq: 659.25, time: 0.12 },  // E5
    { freq: 783.99, time: 0.24 },  // G5
  ]

  notes.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'  // משולש = קול חמים יותר מסינוס
    osc.frequency.value = freq

    // עיטוף עוצמה: עליה מהירה, ירידה איטית
    gain.gain.setValueAtTime(0, now + time)
    gain.gain.linearRampToValueAtTime(0.25, now + time + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.01, now + time + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + time)
    osc.stop(now + time + 0.3)
  })
}

// ────────────────────────────────────────────────
// סאונד הפסד — צליל יורד עצוב קצר
// ────────────────────────────────────────────────
function playLoseSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  // מ-400Hz יורד ל-200Hz — צליל "אווווו" עצוב
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.4)

  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.4)
}

// סאונד כדור בינגו — פינג של פעמון קטן צלול (E6) עם נצנוץ עדין.
// נעים לקהל מבוגר — לא חד ולא מבהיל, כמו "טינג" של רספשן.
function playBingoBallSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const layers = [
    { freq: 1318.5, dur: 0.5, vol: 0.30 },  // E6 — הצליל העיקרי
    { freq: 2637.0, dur: 0.4, vol: 0.09 },  // E7 — נצנוץ עדין
  ]
  layers.forEach(({ freq, dur, vol }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur)
  })
}

// ────────────────────────────────────────────────
// סאונד הטלת קוביות — כמה נקישות עץ של קוביות מתגלגלות (שש-בש)
// ────────────────────────────────────────────────
// רצף של 5-6 נקישות עץ קצרות בקצב מאיץ-מאט, כמו קוביות שנופלות
// ומתגלגלות על הלוח ונחות.
function playDiceSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  // זמני הנקישות — מתחילות צפופות ומתפזרות (מתגלגל ונח)
  const taps = [0, 0.06, 0.13, 0.22, 0.34, 0.5]
  taps.forEach((t, i) => {
    const dur = 0.04
    // רעש לבן קצר עם דעיכה — "טוק" של עץ
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let j = 0; j < data.length; j++) {
      data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.18))
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    // פילטר bandpass שיורד בתדר עם כל נקישה — תחושת עץ מתגלגל
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500 - i * 130
    filter.Q.value = 1.1
    const gain = ctx.createGain()
    gain.gain.value = 0.32 - i * 0.025  // נקישות אחרונות חלשות יותר
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
    src.start(now + t)
    src.stop(now + t + dur)
  })
}

// ────────────────────────────────────────────────
// סאונד צעד — נקישה קצרה ויבשה לכל משבצת שעוברים
// ────────────────────────────────────────────────
function playStepSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  // "טופ" קצר — תדר נופל מעט
  osc.frequency.setValueAtTime(330, now)
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.07)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
  osc.connect(gain); gain.connect(ctx.destination)
  osc.start(now); osc.stop(now + 0.1)
}

// ────────────────────────────────────────────────
// סאונד נחיתה לא טובה — באז יורד קצר (קנס / שכירות / עצור)
// ────────────────────────────────────────────────
function playBadStepSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'  // משור = צליל חד/מבאס
  // "בְּזזז" יורד מ-300 ל-110
  osc.frequency.setValueAtTime(300, now)
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.32)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.34)
  osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
  osc.start(now); osc.stop(now + 0.34)
}

// ────────────────────────────────────────────────
// API ציבורי — מנגן סאונד לפי שם
// ────────────────────────────────────────────────
export function playSound(soundName) {
  if (isMuted()) return  // לא מנגנים אם המשתמש השתיק

  try {
    switch (soundName) {
      case 'drop':
        playDropSound()
        break
      case 'bingoBall':
        playBingoBallSound()
        break
      case 'dice':
        playDiceSound()
        break
      case 'step':
        playStepSound()
        break
      case 'badStep':
        playBadStepSound()
        break
      case 'win':
        playWinSound()
        break
      case 'lose':
        playLoseSound()
        break
      default:
        console.warn('Unknown sound:', soundName)
    }
  } catch (e) {
    // אם משהו נכשל — לא נופלים, פשוט מתעלמים
    console.warn('playSound error:', e)
  }
}
