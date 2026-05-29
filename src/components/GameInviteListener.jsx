// src/components/GameInviteListener.jsx
// ─────────────────────────────────────────────────────────────
// מאזין גלובלי להזמנות משחק נכנסות.
//
// מורכב פעם אחת ברמת ה-App (כל עוד המשתמש מחובר). מאזין לאוסף
// gameInvites לכל הזמנה ש-status='pending' שממוענת למשתמש הנוכחי.
// כשמגיעה הזמנה — מציג חלונית עם שם המזמין וכפתורי אישור/דחייה.
//
//   • הצטרף  → מצטרף לחדר (acceptGameInvite) ומנווט ישר למשחק.
//   • לא עכשיו → מסמן את ההזמנה כ-declined (השולח יראה ויבטל).
//
// אם השולח ביטל בינתיים — ההזמנה נעלמת מהרשימה והחלונית נסגרת לבד.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchIncomingInvites, acceptGameInvite, declineGameInvite,
} from '../services/firebase.js'
import Avatar from './Avatar.jsx'

// שמות המשחקים לתצוגה בחלונית
const GAME_NAMES = {
  connect4: '4 בשורה',
}

export default function GameInviteListener({ onAccept }) {
  const { authUser, profile } = useUserStore()
  const [invites, setInvites] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // מאזינים להזמנות נכנסות כל עוד המשתמש מחובר
  useEffect(() => {
    if (!authUser?.uid) { setInvites([]); return }
    const unsub = watchIncomingInvites(authUser.uid, (list) => {
      setInvites(list)
    })
    return () => unsub && unsub()
  }, [authUser?.uid])

  // ── ההזמנה המוצגת — הראשונה בתור ──
  const invite = invites[0]
  if (!invite) return null

  const gameName = GAME_NAMES[invite.gameType] || 'משחק'

  const handleAccept = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const player = { uid: authUser.uid, name: profile?.name || 'משתמש' }
      const roomId = await acceptGameInvite(invite.id, player)
      // ניווט ישר לתוך המשחק בחדר הזה
      onAccept && onAccept({ roomId, gameType: invite.gameType })
    } catch (e) {
      console.error('acceptGameInvite error:', e)
      // השולח כנראה ביטל או שהחדר נסגר
      setError('המשחק כבר לא זמין — ייתכן שהמזמין ביטל')
    } finally {
      setBusy(false)
    }
  }

  const handleDecline = async () => {
    if (busy) return
    setBusy(true)
    try {
      await declineGameInvite(invite.id)
    } catch (e) {
      console.error('declineGameInvite error:', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 24,
        padding: '28px 24px 22px',
        maxWidth: 360, width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <Avatar name={invite.fromName} size={72} />
        </div>
        <div style={{ fontSize: 38, marginBottom: 6 }}>🔴 🟡</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
          {invite.fromName} מזמין/ה אותך לשחק
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 20 }}>
          {gameName}
        </div>

        {error && (
          <div style={{
            background: 'var(--burgundy-soft)', color: 'var(--burgundy)',
            padding: '10px', borderRadius: 10,
            fontSize: 14, fontWeight: 700, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={busy}
          className="big-btn big-btn--primary"
          style={{ width: '100%', marginBottom: 10, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'רגע...' : '✅ הצטרף למשחק'}
        </button>
        <button
          onClick={handleDecline}
          disabled={busy}
          className="big-btn big-btn--ghost"
          style={{ width: '100%' }}
        >
          לא עכשיו
        </button>
      </div>
    </div>
  )
}
