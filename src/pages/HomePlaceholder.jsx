// src/pages/HomePlaceholder.jsx
// ─────────────────────────────────────────────────────────────
// The original Home screen from the prototype, ported to a
// real React component. Wired: קפה בסלון. Others show "בקרוב".
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { useSessionStore } from '../stores/sessionStore.js'
import { getAvailableUsers, createCafeSession, fetchLiveKitToken, setPresence } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { colors, avatarColor } from '../design-system/index.js'

const AVAILABLE_MOCK = [
  { id: 'mock1', name: 'יעקב לוי',   age: 74, city: 'חיפה',     status: 'available', interests: ['שחמט','חדשות'], bio: 'אוהב לדבר על פוליטיקה ומוזיקה',   waitMin: 2 },
  { id: 'mock2', name: 'אסתר כהן',   age: 71, city: 'תל אביב',  status: 'available', interests: ['גינון','בישול'], bio: 'מחפשת חברה לשיחות בוקר נינוחות',  waitMin: 4 },
  { id: 'mock3', name: 'דוד פרץ',    age: 78, city: 'באר שבע',  status: 'available', interests: ['היסטוריה','ספרים'], bio: 'מספר סיפורים מהצבא',             waitMin: 7 },
  { id: 'mock4', name: 'חנה גולדמן', age: 69, city: 'ירושלים',  status: 'available', interests: ['יידיש','בישול'], bio: 'מדברת יידיש ועברית, מבשלת מצוין', waitMin: 1 },
]

export default function HomePlaceholder({ onGoKafe }) {
  const { profile, authUser } = useUserStore()
  const { setCafePartner, setLivekit, setCafeSession } = useSessionStore()
  const [available, setAvailable] = useState(AVAILABLE_MOCK)
  const [calling, setCalling] = useState(null)
  const [loadingCall, setLoadingCall] = useState(false)
  const [error, setError] = useState('')

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : hour < 20 ? 'ערב טוב' : 'לילה טוב'

  // Try to load real available users (falls back to mock)
  useEffect(() => {
    if (!authUser?.uid) return
    getAvailableUsers(authUser.uid)
      .then(users => { if (users.length > 0) setAvailable(users) })
      .catch(() => {}) // silent - mock is fine for dev
  }, [authUser?.uid])

  async function startKafeCall(partner) {
    setError('')
    setLoadingCall(true)
    setCalling(partner)
    try {
      const uid   = authUser.uid
      const room  = `kafe-${uid}-${Date.now()}`
      const myName = profile?.name || 'משתמש'

      // Mark busy
      await setPresence(uid, 'busy')

      // Create Firestore session
      const sessionId = await createCafeSession(uid, partner.id, room)

      // Fetch LiveKit token
      const token = await fetchLiveKitToken(room, myName)

      // Set state → App.jsx will switch to KafePage
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
    <div className="scroll-area">
      {/* Greeting */}
      <div style={{ padding: '18px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={profile?.name || ''} size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: colors.burgundy, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.10em',
            fontFamily: "'Suez One', serif",
          }}>{greet}</div>
          <div style={{ fontSize: 26, color: colors.ink, lineHeight: 1, marginTop: 2, fontFamily: "'Suez One', serif" }}>
            {profile?.name}
          </div>
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: colors.surface,
          border: `3px solid ${colors.ink}`,
          boxShadow: '3px 4px 0 #1A2547',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, position: 'relative',
        }}>
          🔔
        </div>
      </div>

      <div style={{ padding: '12px 20px 28px' }}>
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

        {/* HERO */}
        <div style={{
          width: '100%', textAlign: 'right',
          background: colors.burgundy,
          border: `3px solid ${colors.ink}`,
          borderRadius: 18, padding: '20px 20px 16px',
          color: colors.surface,
          boxShadow: '6px 7px 0 #1A2547',
          position: 'relative', overflow: 'hidden',
          marginBottom: 16,
        }}>
          <div style={{
            position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0,
            width: 28,
            backgroundImage: 'repeating-linear-gradient(45deg, #FFC857 0 8px, #1A2547 8px 16px)',
            opacity: 0.95,
          }}/>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginInlineStart: 22 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 12,
              background: colors.gold, border: `3px solid ${colors.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '3px 3px 0 #1A2547', fontSize: 28,
            }}>📞</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 6, fontFamily: "'Suez One', serif" }}>
                שיחה עם חבר חדש
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
                <span className="live-dot" style={{ marginInlineEnd: 8, verticalAlign: 'middle', background: '#FFC857' }}/>
                <strong style={{ fontFamily: "'Suez One', serif" }}>{available.length} אנשים</strong> מחכים לדבר
              </div>
            </div>
          </div>
        </div>

        {/* Available people */}
        <h2 style={{ fontFamily: "'Suez One', serif", fontSize: 22, margin: '0 0 12px', color: colors.ink }}>
          מחכים עכשיו
        </h2>

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
                    {p.age && <span style={{ fontSize: 16, color: colors.ink3 }}>בן/בת {p.age} · {p.city}</span>}
                  </div>
                  {p.bio && (
                    <div style={{ fontSize: 16, color: colors.ink2, marginTop: 6, lineHeight: 1.35 }}>{p.bio}</div>
                  )}
                  {p.waitMin && (
                    <div style={{ fontSize: 14, color: colors.ink3, marginTop: 8 }}>
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

        {/* Other sections - coming soon */}
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { emoji: '🏛', label: 'הפרלמנט', sub: 'בקרוב', color: colors.wine },
            { emoji: '🎯', label: 'חוגים', sub: 'בקרוב', color: colors.teal },
          ].map(t => (
            <div key={t.label} style={{
              background: t.color, color: 'white',
              border: `3px solid ${colors.ink}`,
              borderRadius: 16, padding: '16px 14px',
              boxShadow: '4px 5px 0 #1A2547',
              minHeight: 110,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              opacity: 0.7,
            }}>
              <div style={{ fontSize: 36 }}>{t.emoji}</div>
              <div>
                <div style={{ fontFamily: "'Suez One', serif", fontSize: 20 }}>{t.label}</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{t.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}
