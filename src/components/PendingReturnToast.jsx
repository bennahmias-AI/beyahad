// src/components/PendingReturnToast.jsx
// ─────────────────────────────────────────────────────────────
// טוסט גלובלי שמופיע בפינה הימנית-עליונה כששחקן עזב משחק זמנית
// ויש לו 60 שניות לחזור. מציג: תמונת פרופיל + אייקון משחק + כפתור חזרה +
// ספירה לאחור. מוצג בכל מסך באפליקציה (לא רק בעמוד הבית).
//
// מקור הנתונים: profile.pendingReturn (נכתב ע"י pauseAroundWorldGame ו-
// פונקציות דומות במשחקים אחרים).
//
// onResume(gameType, roomId) — קריאה כשהמשתמש לוחץ לחזור. ב-App.jsx
// זה מנווט לחדר המתאים.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { GameIcon } from '../icons/gameIcons.jsx'
import { quitAroundWorldGame } from '../services/firebase.js'
import Avatar from './Avatar.jsx'

export default function PendingReturnToast({ onResume }) {
  const { profile, authUser } = useUserStore()
  const pendingReturn = profile?.pendingReturn || null
  const [remainingSec, setRemainingSec] = useState(0)
  const [busy, setBusy] = useState(false)

  // ביטול — המשתמש לא רוצה לחזור: מסיים את ההשתתפות (פותח לאחרים להמשיך)
  const handleDismiss = async (e) => {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    try {
      if (pendingReturn?.gameType === 'aroundworld') {
        await quitAroundWorldGame(pendingReturn.roomId, authUser?.uid)
      }
    } catch {}
    setBusy(false)
  }

  useEffect(() => {
    if (!pendingReturn?.expiresMs) { setRemainingSec(0); return }
    const tick = () => setRemainingSec(Math.max(0, Math.ceil((pendingReturn.expiresMs - Date.now()) / 1000)))
    tick()
    const i = setInterval(tick, 500)
    return () => clearInterval(i)
  }, [pendingReturn?.expiresMs])

  if (!pendingReturn || remainingSec <= 0) return null

  const userName = profile?.name || 'אתה'
  const photoURL = profile?.photoURL || null
  const backWord = profile?.gender === 'female' ? 'חזרי למשחק' : 'חזור למשחק'

  return (
    <>
      <style>{`
        @keyframes pendingReturnSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pendingReturnPulse {
          0%, 100% { box-shadow: 0 8px 24px rgba(0,0,0,.3), 0 0 0 0 rgba(47,158,63,.5); }
          50% { box-shadow: 0 8px 24px rgba(0,0,0,.3), 0 0 0 10px rgba(47,158,63,0); }
        }
      `}</style>
      <div
        onClick={() => onResume && onResume(pendingReturn.gameType, pendingReturn.roomId)}
        style={{
          position: 'fixed',
          top: 'max(70px, calc(env(safe-area-inset-top) + 60px))',
          right: 14,
          zIndex: 4000,
          direction: 'rtl',
          background: 'linear-gradient(135deg, #2f9e3f, #1b6b27)',
          color: '#fff',
          borderRadius: 16,
          padding: '14px 16px',
          width: 'min(280px, calc(100vw - 28px))',
          cursor: 'pointer',
          fontFamily: 'inherit',
          animation: 'pendingReturnSlideIn .4s ease-out, pendingReturnPulse 2s ease-in-out infinite .5s',
          border: '2px solid rgba(255,255,255,.25)',
        }}
        role="button"
        aria-label={backWord}
      >
        <button onClick={handleDismiss} disabled={busy} aria-label="לא לחזור" style={{
          position: 'absolute', top: -8, insetInlineEnd: -8,
          width: 26, height: 26, borderRadius: '50%',
          background: '#fff', color: '#1b6b27',
          border: '2px solid #1b6b27', cursor: busy ? 'default' : 'pointer',
          display: 'grid', placeItems: 'center', padding: 0,
          fontSize: 15, fontWeight: 900, lineHeight: 1, zIndex: 1,
          boxShadow: '0 2px 6px rgba(0,0,0,.25)', fontFamily: 'inherit',
        }}>✕</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={userName} size={42} photoURL={photoURL} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9, lineHeight: 1.2 }}>עזבת באמצע</div>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
              {pendingReturn.gameName}
            </div>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: 'rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid rgba(255,255,255,.3)',
          }}>
            <GameIcon id={pendingReturn.gameType} size={28} />
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,.22)',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontWeight: 800, fontSize: 15,
          border: '1px solid rgba(255,255,255,.2)',
        }}>
          <span>🎮 {backWord}</span>
          <span style={{ fontWeight: 900, fontSize: 18, minWidth: 32, textAlign: 'left' }}>{remainingSec}s</span>
        </div>
      </div>
    </>
  )
}
