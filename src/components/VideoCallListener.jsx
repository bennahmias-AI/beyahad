// src/components/VideoCallListener.jsx
// ─────────────────────────────────────────────────────────────
// מאזין גלובלי לשיחות וידאו נכנסות.
//
// מורכב פעם אחת ברמת ה-App (כל עוד המשתמש מחובר). מאזין לאוסף
// videoCalls לכל שיחה ש-status='ringing' שממוענת למשתמש הנוכחי.
// כשמגיעה שיחה — מציג חלונית "צלצול" עם תמונת המתקשר וכפתורי מענה/דחייה.
//
//   • ענה  → מסמן accepted ונכנס למסך השיחה (onAccept).
//   • דחה  → מסמן declined (המתקשר יראה ויתנתק).
//
// אם המתקשר ביטל בינתיים — השיחה נעלמת מהרשימה והחלונית נסגרת לבד.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchIncomingCalls, acceptVideoCall, declineVideoCall, watchUser,
} from '../services/firebase.js'
import Avatar from './Avatar.jsx'

export default function VideoCallListener({ onAccept }) {
  const { authUser } = useUserStore()
  const [calls, setCalls] = useState([])
  const [busy, setBusy] = useState(false)
  const [callerPhoto, setCallerPhoto] = useState(null)
  const ringRef = useRef(null)

  // מאזינים לשיחות נכנסות כל עוד המשתמש מחובר
  useEffect(() => {
    if (!authUser?.uid) { setCalls([]); return }
    const unsub = watchIncomingCalls(authUser.uid, (list) => setCalls(list))
    return () => unsub && unsub()
  }, [authUser?.uid])

  // ── השיחה המוצגת — הראשונה בתור ──
  const call = calls[0]

  // תמונת המתקשר (חיה)
  useEffect(() => {
    if (!call?.fromUid) { setCallerPhoto(null); return }
    const unsub = watchUser(call.fromUid, u => setCallerPhoto(u?.photoURL || null))
    return () => unsub && unsub()
  }, [call?.fromUid])

  // צליל צלצול — ביפ עדין חוזר כל עוד יש שיחה נכנסת
  useEffect(() => {
    if (!call) return
    let ctx
    let stopped = false
    const beep = () => {
      if (stopped) return
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 660
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
        osc.start()
        osc.stop(ctx.currentTime + 0.55)
      } catch (e) { /* ignore */ }
    }
    beep()
    ringRef.current = setInterval(beep, 1800)
    return () => {
      stopped = true
      if (ringRef.current) clearInterval(ringRef.current)
      if (ctx) { try { ctx.close() } catch (e) {} }
    }
  }, [call?.id])

  if (!call) return null

  const handleAccept = async () => {
    if (busy) return
    setBusy(true)
    try {
      await acceptVideoCall(call.id)
      onAccept && onAccept({
        call,
        otherUid: call.fromUid,
        otherName: call.fromName,
        otherPhoto: callerPhoto || call.fromPhoto || null,
      })
    } catch (e) {
      console.error('acceptVideoCall error:', e)
    } finally {
      setBusy(false)
    }
  }

  const handleDecline = async () => {
    if (busy) return
    setBusy(true)
    try {
      await declineVideoCall(call.id)
    } catch (e) {
      console.error('declineVideoCall error:', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20,15,25,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 24,
        padding: '32px 24px 24px',
        maxWidth: 360, width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* תמונת המתקשר עם הילה פועמת */}
        <div style={{ position: 'relative', display: 'inline-flex', marginBottom: 18 }}>
          <span style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '3px solid var(--success)', animation: 'vcRing 1.4s ease-out infinite',
          }} />
          <Avatar name={call.fromName} size={96} photoURL={callerPhoto || call.fromPhoto} />
        </div>

        <div style={{ fontSize: 30, marginBottom: 4 }}>📹</div>
        <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>
          {call.fromName}
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 24 }}>
          מתקשר/ת אליך בשיחת וידאו...
        </div>

        {/* כפתורי מענה / דחייה — גדולים */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <button
            onClick={handleDecline}
            disabled={busy}
            aria-label="דחה שיחה"
            style={{
              flex: 1, background: '#E8484F', color: '#fff', border: 'none',
              borderRadius: 16, padding: '16px', fontSize: 17, fontWeight: 800,
              fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 24 }}>📵</span>
            דחה
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            aria-label="ענה לשיחה"
            style={{
              flex: 1, background: 'var(--success)', color: '#fff', border: 'none',
              borderRadius: 16, padding: '16px', fontSize: 17, fontWeight: 800,
              fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 24 }}>📹</span>
            {busy ? 'רגע...' : 'ענה'}
          </button>
        </div>
      </div>

      <style>{`@keyframes vcRing { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.35); opacity: 0; } }`}</style>
    </div>
  )
}
