// src/pages/AvailablePeoplePage.jsx
// ─────────────────────────────────────────────────────────────
// רשימת אנשים זמינים לשיחה. נפתח מ-HERO במסך הבית.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { useSessionStore } from '../stores/sessionStore.js'
import {
  watchAvailableUsers, createCafeSession, fetchLiveKitToken, setPresence,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { colors } from '../design-system/index.js'

const AVAILABLE_MOCK = [
  { id: 'mock1', name: 'יעקב לוי',   age: 74, city: 'חיפה',     bio: 'אוהב לדבר על פוליטיקה ומוזיקה', waitMin: 2 },
  { id: 'mock2', name: 'אסתר כהן',   age: 71, city: 'תל אביב',  bio: 'מחפשת חברה לשיחות בוקר נינוחות', waitMin: 4 },
  { id: 'mock3', name: 'דוד פרץ',    age: 78, city: 'באר שבע',  bio: 'מספר סיפורים מהצבא', waitMin: 7 },
  { id: 'mock4', name: 'חנה גולדמן', age: 69, city: 'ירושלים',  bio: 'מדברת יידיש ועברית, מבשלת מצוין', waitMin: 1 },
]

function pairRoomName(uidA, uidB) {
  const [a, b] = [uidA, uidB].sort()
  const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
  return `kafe-${safe(a)}-${safe(b)}`
}

export default function AvailablePeoplePage({ onBack, onGoKafe }) {
  const { profile, authUser } = useUserStore()
  const { setCafePartner, setLivekit, setCafeSession } = useSessionStore()
  const [available, setAvailable] = useState(AVAILABLE_MOCK)
  const [calling, setCalling] = useState(null)
  const [loadingCall, setLoadingCall] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authUser?.uid) return
    const unsub = watchAvailableUsers(authUser.uid, users => {
      if (users.length > 0) setAvailable(users)
      else setAvailable(AVAILABLE_MOCK)
    })
    return () => unsub && unsub()
  }, [authUser?.uid])

  async function startKafeCall(partner) {
    setError('')
    setLoadingCall(true)
    setCalling(partner)
    try {
      const uid    = authUser.uid
      const room   = pairRoomName(uid, partner.id)
      const myName = profile?.name || 'משתמש'

      await setPresence(uid, 'busy')
      const sessionId = await createCafeSession(uid, partner.id, room)
      const token = await fetchLiveKitToken(room, myName)

      setCafePartner(partner)
      setCafeSession({ id: sessionId })
      setLivekit({ token, room })
      onGoKafe?.()
    } catch (e) {
      console.error(e)
      setError('לא הצלחנו לחבר — נסי שוב')
      await setPresence(authUser.uid, 'available').catch(() => {})
    } finally {
      setLoadingCall(false)
      setCalling(null)
    }
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `2px solid ${colors.ink}`,
        marginBottom: 16,
      }}>
        <button onClick={onBack} style={{
          width: 44, height: 44, borderRadius: 12,
          background: colors.surface, border: `3px solid ${colors.ink}`,
          boxShadow: '3px 3px 0 #1A2547',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, cursor: 'pointer', fontFamily: 'inherit',
        }}>→</button>

        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Suez One', serif", fontSize: 22, color: colors.ink,
            lineHeight: 1,
          }}>
            מחכים עכשיו
          </div>
          <div style={{ fontSize: 13, color: colors.ink2, marginTop: 4 }}>
            <span className="live-dot" style={{
              marginInlineEnd: 6, verticalAlign: 'middle', background: '#FFC857',
            }}/>
            {available.length} {available.length === 1 ? 'אדם זמין' : 'אנשים זמינים'}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 28px' }}>
        {error && (
          <div style={{
            background: colors.burgundySoft, color: colors.burgundyDeep,
            border: `2px solid ${colors.burgundy}`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 14,
            fontSize: 16, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {available.map(p => (
            <div key={p.id} style={{
              background: colors.surface,
              border: `3px solid ${colors.ink}`,
              borderRadius: 22, padding: 16,
              boxShadow: '0 3px 0 #B89E70',
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <Avatar name={p.name} size={72} online />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{p.name}</span>
                    {p.age && (
                      <span style={{ fontSize: 14, color: colors.ink3 }}>
                        בן/בת {p.age} · {p.city}
                      </span>
                    )}
                  </div>
                  {p.bio && (
                    <div style={{ fontSize: 15, color: colors.ink2, marginTop: 6, lineHeight: 1.35 }}>
                      {p.bio}
                    </div>
                  )}
                  {p.waitMin && (
                    <div style={{ fontSize: 13, color: colors.ink3, marginTop: 8 }}>
                      ⏱ ממתין/ה {p.waitMin} דקות
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => startKafeCall(p)}
                  disabled={loadingCall}
                  className="big-btn big-btn--primary"
                  style={{ flex: 1 }}
                >
                  {calling?.id === p.id ? '⏳ מתחבר...' : '📞 התקשרי'}
                </button>
                <button className="big-btn big-btn--ghost" style={{ width: 68, padding: 0 }} aria-label="דלג">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}
