// src/pages/OutgoingCallScreen.jsx
// ─────────────────────────────────────────────────────────────
// מסך "מצלצל ל..." — מוצג למתקשר בזמן שממתין שהחבר יענה.
//
// מאזין לסטטוס השיחה:
//   • accepted → עובר למסך השיחה (onConnected)
//   • declined → מציג "החבר דחה" וחוזר (onEnded)
//   • אחרי 40 שניות ללא מענה → מבטל אוטומטית (אין מענה)
//
// כפתור "ביטול" מבטל את השיחה (endVideoCall) וחוזר.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { watchVideoCall, endVideoCall, deleteVideoCall } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'

export default function OutgoingCallScreen({ call, otherName, otherPhoto, onConnected, onEnded }) {
  const [status, setStatus] = useState('ringing')  // ringing | declined | no-answer
  const timeoutRef = useRef(null)

  // מאזין לסטטוס השיחה
  useEffect(() => {
    if (!call?.id) return
    const unsub = watchVideoCall(call.id, (data) => {
      if (!data) return
      if (data.status === 'accepted') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        onConnected && onConnected()
      } else if (data.status === 'declined') {
        setStatus('declined')
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        // מנקים את ה-doc ואז סוגרים אחרי שניתיים
        setTimeout(() => {
          deleteVideoCall(call.id).catch(() => {})
          onEnded && onEnded()
        }, 2200)
      }
    })
    return () => unsub && unsub()
    // eslint-disable-next-line
  }, [call?.id])

  // טיימאאוט — אם לא ענו תוך 40 שניות, מבטלים
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setStatus('no-answer')
      endVideoCall(call?.id).catch(() => {})
      setTimeout(() => {
        deleteVideoCall(call?.id).catch(() => {})
        onEnded && onEnded()
      }, 2200)
    }, 40000)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
    // eslint-disable-next-line
  }, [])

  const handleCancel = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    await endVideoCall(call?.id).catch(() => {})
    setTimeout(() => deleteVideoCall(call?.id).catch(() => {}), 1200)
    onEnded && onEnded()
  }

  const title = status === 'declined' ? `${otherName} לא יכול לדבר כעת`
    : status === 'no-answer' ? `${otherName} לא ענה`
    : `מצלצל ל${otherName}...`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3500, direction: 'rtl',
      background: 'linear-gradient(180deg, #241830 0%, #160d1c 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, gap: 24,
    }}>
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        {status === 'ringing' && (
          <>
            <span style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.4)', animation: 'ocRing 1.5s ease-out infinite',
            }} />
            <span style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              border: '3px solid rgba(255,255,255,.25)', animation: 'ocRing 1.5s ease-out .6s infinite',
            }} />
          </>
        )}
        <Avatar name={otherName} size={130} photoURL={otherPhoto} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, fontFamily: "'Suez One', serif", marginBottom: 6 }}>
          {title}
        </div>
        {status === 'ringing' && (
          <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 16, fontWeight: 600 }}>
            ממתין שיענה לשיחת הווידאו
          </div>
        )}
      </div>

      {status === 'ringing' && (
        <button
          onClick={handleCancel}
          aria-label="בטל שיחה"
          style={{
            width: 76, height: 76, borderRadius: '50%', background: '#E8484F',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 6px 18px rgba(232,72,79,.5)', marginTop: 8,
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" style={{ transform: 'rotate(135deg)' }}>
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        </button>
      )}

      <style>{`@keyframes ocRing { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }`}</style>
    </div>
  )
}
