// src/components/PendingReturnButton.jsx
// ─────────────────────────────────────────────────────────────
// כפתור אדום מהבהב ליד הפעמון בעמוד הבית — מופיע רק כששחקן עזב
// משחק זמנית ויש לו 60 שניות לחזור.
//
// לחיצה פותחת מודאל עם שתי אפשרויות:
//   • חזור למשחק   → onResume(gameType, roomId)
//   • צא סופית     → quit… (מסיים את ההשתתפות, פותח לאחרים להמשיך)
//
// מקור הנתונים: profile.pendingReturn (נכתב ע"י pauseAroundWorldGame
// וכיו"ב). useAuth כעת מאזין לפרופיל בלייב — כך שברגע שזה נכתב,
// הכפתור מופיע מיד.
//
// size — 'desktop' (50px) / 'mobile' (42px)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { GameIcon } from '../icons/gameIcons.jsx'
import { quitAroundWorldGame } from '../services/firebase.js'

export default function PendingReturnButton({ onResume, size = 'desktop' }) {
  const { profile, authUser } = useUserStore()
  const pendingReturn = profile?.pendingReturn || null
  const [remainingSec, setRemainingSec] = useState(0)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!pendingReturn?.expiresMs) { setRemainingSec(0); return }
    const tick = () => setRemainingSec(Math.max(0, Math.ceil((pendingReturn.expiresMs - Date.now()) / 1000)))
    tick()
    const i = setInterval(tick, 500)
    return () => clearInterval(i)
  }, [pendingReturn?.expiresMs])

  if (!pendingReturn || remainingSec <= 0) return null

  const isMob = size === 'mobile'
  const buttonSize = isMob ? 42 : 50
  const iconSize = isMob ? 22 : 26
  const backWord = profile?.gender === 'female' ? 'חזרי למשחק' : 'חזור למשחק'

  const handleResume = () => {
    setOpen(false)
    onResume && onResume(pendingReturn.gameType, pendingReturn.roomId)
  }

  const handleQuit = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (pendingReturn.gameType === 'aroundworld') {
        await quitAroundWorldGame(pendingReturn.roomId, authUser?.uid)
      }
      // (לעתיד — quit עבור rummikub/bingo/arena)
    } catch (e) { /* best-effort */ }
    setBusy(false)
    setOpen(false)
  }

  return (
    <>
      <style>{`
        @keyframes pendingReturnBlink {
          0%, 100% {
            background: #d8402a;
            box-shadow: 0 0 0 0 rgba(216,64,42,.55), 0 2px 8px rgba(0,0,0,.18);
          }
          50% {
            background: #a82817;
            box-shadow: 0 0 0 12px rgba(216,64,42,0), 0 2px 8px rgba(0,0,0,.18);
          }
        }
        @keyframes pendingReturnCountPop {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
      `}</style>
      <button
        aria-label={backWord}
        onClick={() => setOpen(true)}
        style={{
          width: buttonSize, height: buttonSize, borderRadius: '50%',
          border: 'none', color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          cursor: 'pointer', position: 'relative',
          animation: 'pendingReturnBlink 1.2s ease-in-out infinite',
          fontFamily: 'inherit',
        }}
      >
        <GameIcon id={pendingReturn.gameType} size={iconSize} />
        <span style={{
          position: 'absolute', top: -5, insetInlineEnd: -5,
          background: '#fff', color: '#a82817',
          borderRadius: 999, minWidth: 22, height: 20, padding: '0 5px',
          fontSize: 11, fontWeight: 900, lineHeight: '20px', textAlign: 'center',
          border: '2px solid #a82817', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
          animation: 'pendingReturnCountPop 1s ease-in-out infinite',
          fontVariantNumeric: 'tabular-nums',
        }}>{remainingSec}</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 5000,
          background: 'rgba(20,15,8,.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          direction: 'rtl', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface, #fff)',
            borderRadius: 22, padding: '26px 22px',
            width: '100%', maxWidth: 360,
            boxShadow: '0 18px 60px rgba(0,0,0,.45)',
            border: '1px solid var(--line, rgba(0,0,0,.08))',
            fontFamily: 'inherit',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
                background: 'linear-gradient(135deg, #ffe2dd, #ffd0c5)',
                display: 'grid', placeItems: 'center',
                border: '2px solid #d8402a',
              }}>
                <GameIcon id={pendingReturn.gameType} size={42} />
              </div>
              <div className="h-display" style={{ fontWeight: 900, fontSize: 22, color: 'var(--ink, #1c1c1c)', marginBottom: 6 }}>
                עזבת באמצע {pendingReturn.gameName}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-2, #555)', lineHeight: 1.5 }}>
                נשארו <strong style={{ color: '#d8402a', fontSize: 18 }}>{remainingSec} שניות</strong> לחזור
                <br />
                לפני שהמשחק ימשיך בלעדיך
              </div>
            </div>
            <button
              onClick={handleResume}
              disabled={busy}
              style={{
                width: '100%', padding: 14, borderRadius: 14,
                background: '#2f9e3f', color: '#fff',
                fontWeight: 800, fontSize: 17,
                border: 'none', cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit', marginBottom: 10,
                opacity: busy ? 0.6 : 1,
              }}>
              🎮 {backWord}
            </button>
            <button
              onClick={handleQuit}
              disabled={busy}
              style={{
                width: '100%', padding: 14, borderRadius: 14,
                background: 'transparent', color: '#d8402a',
                fontWeight: 700, fontSize: 16,
                border: '2px solid #d8402a',
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit', marginBottom: 6,
                opacity: busy ? 0.6 : 1,
              }}>
              {busy ? 'יוצא...' : '✕ לצאת סופית'}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: '100%', padding: 10, borderRadius: 12,
                background: 'transparent', color: 'var(--ink-3, #999)',
                fontWeight: 600, fontSize: 14,
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              סגור
            </button>
          </div>
        </div>
      )}
    </>
  )
}
