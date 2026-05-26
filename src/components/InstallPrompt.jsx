// src/components/InstallPrompt.jsx
// ─────────────────────────────────────────────────────────────
// באנר עדין שמציע למשתמש להתקין את "ביחד" כאפליקציה.
//
// • באנדרואיד/כרום — תופס את אירוע beforeinstallprompt ומציג
//   כפתור "התקן" שמפעיל את הדיאלוג המקורי.
// • באייפון (סאפారי) — אין אירוע כזה, אז מציג הנחיה ידנית
//   ("שתף → הוסף למסך הבית").
// • נסגר ל-30 יום אם המשתמש בחר "אחר כך", ולא מוצג כלל אם
//   האפליקציה כבר מותקנת.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

const SNOOZE_KEY = 'beyahad_install_snooze'
const SNOOZE_DAYS = 30

export default function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // already installed? (running in standalone) — never show
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (standalone) return

    // snoozed recently? — don't show
    try {
      const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0)
      if (snoozedUntil && Date.now() < snoozedUntil) return
    } catch (e) { /* localStorage blocked — ignore */ }

    // detect iOS Safari (no beforeinstallprompt there)
    const ua = window.navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
    if (iOS) {
      setIsIOS(true)
      // show the manual hint after a short delay
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    // Android / Chrome — wait for the install event
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredEvent(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 864e5))
    } catch (e) { /* ignore */ }
    setShow(false)
  }

  const install = async () => {
    if (!deferredEvent) return
    deferredEvent.prompt()
    try { await deferredEvent.userChoice } catch (e) { /* ignore */ }
    setDeferredEvent(null)
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
            background: 'linear-gradient(135deg, #8A4D6A, #6B3A4F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0,
          }}>🤝</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>
              התקינו את ביחד
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>
              גישה מהירה ישירות ממסך הבית
            </div>
          </div>
        </div>

        {isIOS ? (
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
