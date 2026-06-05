// src/components/InstallPrompt.jsx
// ─────────────────────────────────────────────────────────────
// באנר עדין שמציע למשתמש להתקין את "ביחד" כאפליקציה.
//
// • באנדרואיד/כרום — משתמש באירוע beforeinstallprompt שנתפס מוקדם
//   (utils/pwaInstall) ומציג כפתור "התקן" שמפעיל את הדיאלוג המקורי.
// • באייפון (סאפארי) — אין אירוע כזה, אז מציג הנחיה ידנית
//   ("שתף → הוסף למסך הבית").
// • נסגר ל-30 יום אם המשתמש בחר "אחר כך", ולא מוצג כלל אם
//   האפליקציה כבר מותקנת.
//
// הערה: יש גם כפתור התקנה קבוע במסך ההגדרות (InstallAppSection)
// שתמיד זמין — הבאנר הזה הוא רק תזכורת עדינה וחד-פעמית.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import AppLogo from './AppLogo.jsx'
import { isStandalone, isIOS, canPrompt, subscribe, promptInstall } from '../utils/pwaInstall.js'

const SNOOZE_KEY = 'beyahad_install_snooze'
const SNOOZE_DAYS = 30

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    // already installed? — never show
    if (isStandalone()) return

    // snoozed recently? — don't show
    try {
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0)
      if (snoozedUntil && Date.now() < snoozedUntil) return
    } catch (e) { /* localStorage blocked — ignore */ }

    // iOS — no install event; show the manual hint after a short delay
    if (isIOS()) {
      setIos(true)
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    // Android / Chrome — show as soon as the install event is available
    if (canPrompt()) setShow(true)
    const unsub = subscribe(() => { if (canPrompt()) setShow(true) })
    return unsub
  }, [])

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5))
    } catch (e) { /* ignore */ }
    setShow(false)
  }

  const install = async () => {
    await promptInstall()
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 2000,
      display: 'flex', justifyContent: 'center',
      padding: '0 12px calc(12px + env(safe-area-inset-bottom))',
      pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto',
        width: '100%', maxWidth: 406,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-lg)',
        padding: '16px 16px 14px',
        direction: 'rtl',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
          }}><AppLogo size={52} rounded={14} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>
              התקינו את ביחד
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>
              גישה מהירה ישירות ממסך הבית
            </div>
          </div>
        </div>

        {ios ? (
          <>
            <div style={{
              fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5,
              background: 'var(--surface-2)', borderRadius: 12,
              padding: '10px 12px', marginBottom: 10,
            }}>
              לחצו על כפתור <strong>השיתוף</strong> בדפדפן
              (הריבוע עם החץ ⬆️), ואז בחרו <strong>"הוסף למסך הבית"</strong>.
            </div>
            <button onClick={snooze} className="big-btn big-btn--ghost"
              style={{ width: '100%' }}>
              הבנתי
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={snooze} className="big-btn big-btn--ghost"
              style={{ flex: 1 }}>
              אחר כך
            </button>
            <button onClick={install} className="big-btn big-btn--primary"
              style={{ flex: 2 }}>
              התקן עכשיו
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
