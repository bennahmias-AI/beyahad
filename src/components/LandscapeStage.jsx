// src/components/LandscapeStage.jsx
// ─────────────────────────────────────────────────────────────
// עטיפה שמעודדת תצוגת רוחב (landscape) למשחק שבתוכה.
//
// גישה פשוטה ויציבה (ללא סיבוב CSS שמעוות את התצוגה):
//   • בנייד — מנסה נעילת כיוון אמיתית (requestFullscreen +
//     screen.orientation.lock). עובד באנדרואיד/כרום: המסך מסתובב
//     פיזית לרוחב, ו-RummiGameLayout מציג את פריסת הרוחב.
//   • אם הנעילה לא נתמכת (אייפון/ספארי) או שהמשתמש מחזיק לאורך —
//     פשוט מציגים את התוכן כמו שהוא. RummiGameLayout בוחר לבד
//     פריסת רוחב או אורך לפי מידות החלון, ושתיהן נוחות לשימוש.
//
// אין כאן שום סיבוב-בתוכנה: הוא גרם לעיוות (טקסט אנכי, פריסה על
// הצד) ולכן הוסר. העטיפה לעולם לא משנה את צורת התוכן — רק מנסה
// לבקש מהמערכת לנעול כיוון בנייד.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'

// האם זה מכשיר מגע אמיתי (טלפון/טאבלט)?
function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
}

export default function LandscapeStage({ children }) {
  const lockTriedRef = useRef(false)

  // מנסה נעילת כיוון אמיתית — רק בנייד, פעם אחת בכניסה.
  // אם זה נכשל (אייפון וכו') — לא קורה כלום, פשוט נשארים בכיוון הנוכחי.
  useEffect(() => {
    if (!isTouchDevice() || lockTriedRef.current) return
    lockTriedRef.current = true
    tryLockLandscape()
    return () => { tryUnlock() }
  }, [])

  // התוכן תמיד מוצג כמו שהוא — RummiGameLayout מטפל בפריסה.
  return <div style={{ height: '100%', width: '100%' }}>{children}</div>
}

// ── עזרי נעילת כיוון ──────────────────────────────────────
async function tryLockLandscape() {
  try {
    const el = document.documentElement
    if (el.requestFullscreen) {
      await el.requestFullscreen().catch(() => {})
    }
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {})
    }
  } catch (e) {
    // נכשל (למשל אייפון) — נשארים בכיוון הנוכחי, וזה בסדר גמור.
  }
}

function tryUnlock() {
  try {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock()
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  } catch (e) { /* ignore */ }
}
