// src/utils/triviaSounds.js
// ─────────────────────────────────────────────────────────────
// צלילים עשירים למשחק "מי רוצה להיות מיליונר" — מבוססי Tone.js.
//
// למה מודול נפרד מ-gameSounds.js?
//   • gameSounds משתמש ב-Web Audio גולמי (קליק/ניצחון פשוטים ל-4 בשורה).
//   • כאן רצינו צליל חם ומוזיקלי (פעמונים + נבל + הד) — Tone.js נותן את זה.
//   • מודול נפרד = רק משחק המיליונר טוען את Tone, לא כל האפליקציה.
//
// מערכת ההשתקה משותפת: משתמשים ב-isMuted() מ-gameSounds כדי שכפתור
// ההשתקה יהיה אחיד בכל המשחקים.
//
// הערה: דורש `npm install tone`.
// ─────────────────────────────────────────────────────────────
import * as Tone from 'tone'
import { isMuted } from './gameSounds.js'

let ready = false
let bell, pluck, low, reverb

// אתחול הכלים — קורה פעם אחת, רק אחרי אינטראקציה של המשתמש (Tone.start).
function init() {
  reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0.3 }).toDestination()
  Tone.getDestination().volume.value = -5

  // פעמון רך — משולש עם מעטפת דועכת ארוכה (צלצול נעים עם הד)
  bell = new Tone.PolySynth(Tone.Synth).connect(reverb)
  bell.set({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.5, sustain: 0.05, release: 1.3 },
  })

  // נבל פרוט — מיתר אמיתי (Karplus-Strong) לתחושה טבעית
  pluck = new Tone.PluckSynth({ attackNoise: 0.7, dampening: 3600, resonance: 0.93 }).connect(reverb)

  // טון בס נמוך — למתח ולעומק
  low = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.03, decay: 0.4, sustain: 0.25, release: 0.8 },
  }).connect(reverb)

  ready = true
}

// מפת הצלילים — כל אחד מקבל זמן התחלה n (Tone.now()).
const SOUNDS = {
  // בחירת תשובה — פריטה רכה אחת
  select: (n) => pluck.triggerAttackRelease('C5', '8n', n),

  // נעילת תשובה — מתח עמוק קצר
  lock: (n) => {
    low.triggerAttackRelease('A1', '2n', n, 0.5)
    bell.triggerAttackRelease('A3', '8n', n)
    bell.triggerAttackRelease('F3', '4n', n + 0.18)
  },

  // תשובה נכונה — פעמונים עולים (דו-מי-סול-דו)
  correct: (n) => {
    bell.triggerAttackRelease('C5', '8n', n)
    bell.triggerAttackRelease('E5', '8n', n + 0.1)
    bell.triggerAttackRelease('G5', '8n', n + 0.2)
    bell.triggerAttackRelease('C6', '4n', n + 0.3)
  },

  // תשובה שגויה — אכזבה רכה יורדת (מינורי)
  wrong: (n) => {
    low.triggerAttackRelease('E2', '4n', n, 0.5)
    bell.triggerAttackRelease('Eb4', '8n', n)
    bell.triggerAttackRelease('C4', '4n', n + 0.18)
    bell.triggerAttackRelease('A3', '2n', n + 0.36)
  },

  // ניצחון / מיליון — פאנפרה חגיגית עם נצנוץ נבל
  win: (n) => {
    bell.triggerAttackRelease(['C4', 'E4', 'G4'], '8n', n)
    bell.triggerAttackRelease(['F4', 'A4', 'C5'], '8n', n + 0.22)
    bell.triggerAttackRelease(['G4', 'B4', 'D5'], '8n', n + 0.44)
    bell.triggerAttackRelease(['C5', 'E5', 'G5', 'C6'], '2n', n + 0.66)
    ;['C6', 'E6', 'G6', 'C7'].forEach((note, i) =>
      pluck.triggerAttackRelease(note, '8n', n + 0.66 + i * 0.06))
  },

  // שימוש בעזרה — נצנוץ נבל עולה
  lifeline: (n) => {
    ;['C5', 'E5', 'G5', 'C6', 'E6'].forEach((note, i) =>
      pluck.triggerAttackRelease(note, '16n', n + i * 0.05))
  },

  // ספירה לאחור — פעמון רך בכל אחת מה-5 השניות האחרונות
  tick: (n) => bell.triggerAttackRelease('A5', '16n', n),
}

// מנגן צליל לפי שם. אסינכרוני — מפעיל את Tone (חייב מתוך אינטראקציה).
// אם מושתק או שיש שגיאה — פשוט שותק, לא נופל.
export async function playTriviaSound(name) {
  if (isMuted()) return
  try {
    await Tone.start()
    if (!ready) init()
    const fn = SOUNDS[name]
    if (fn) fn(Tone.now())
  } catch (e) {
    console.warn('playTriviaSound error:', e)
  }
}

// חימום מוקדם — נקרא בלחיצה על ביטול השתקה כדי שהצליל הבא יהיה מיידי.
export async function warmTriviaAudio() {
  try {
    await Tone.start()
    if (!ready) init()
  } catch (e) { /* ignore */ }
}
