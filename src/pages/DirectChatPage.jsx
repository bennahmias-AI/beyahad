// src/pages/DirectChatPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך צ'אט פרטי בין שני חברים.
//
// • כותרת עם שם החבר ותמונת הפרופיל שלו
// • בועות הודעות (שלי מימין בבורדו, שלו משמאל בלבן)
// • שדה כתיבה גדול וברור למטה — נוח למבוגרים
//
// ההודעות נשמרות ב-directChats/{chatId} ב-Firestore ומסונכרנות בזמן אמת.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchDirectChat, sendDirectMessage, watchUser,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL } from '../icons/index.jsx'

export default function DirectChatPage({ friend, onBack }) {
  const { authUser, profile } = useUserStore()
  const myUid = authUser?.uid
  const otherUid = friend?.otherUid

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [prof, setProf] = useState(null)   // פרופיל חי של החבר (שם מלא + תמונה)
  const [online, setOnline] = useState(false)
  const scrollRef = useRef(null)

  // האזנה להודעות
  useEffect(() => {
    if (!myUid || !otherUid) return
    const unsub = watchDirectChat(myUid, otherUid, msgs => {
      // ממיין לפי זמן ליתר ביטחון
      setMessages([...msgs].sort((a, b) => (a.at || 0) - (b.at || 0)))
    })
    return () => unsub && unsub()
  }, [myUid, otherUid])

  // פרופיל חי של החבר — שם מלא (חבר מאושר, מותר שם משפחה) + תמונה + סטטוס
  useEffect(() => {
    if (!otherUid) return
    const unsub = watchUser(otherUid, u => {
      setProf({ name: u?.name || '', lastName: u?.lastName || '', photoURL: u?.photoURL || null })
      const seen = u?.lastSeenAt
      const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
      const fresh = seenMs && (Date.now() - seenMs) < 2 * 60 * 1000
      setOnline(Boolean(fresh) && ['available', 'busy'].includes(u?.status))
    })
    return () => unsub && unsub()
  }, [otherUid])

  // גלילה לתחתית בכל הודעה חדשה
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const fullName = prof
    ? ([prof.name, prof.lastName].filter(Boolean).join(' ') || friend?.otherName)
    : (friend?.otherName || 'חבר')
  const photoURL = prof?.photoURL || null

  const send = async () => {
    const text = draft.trim()
    if (!text || !myUid || !otherUid) return
    setDraft('')
    try {
      await sendDirectMessage({
        fromUid: myUid,
        toUid: otherUid,
        text,
        senderName: profile?.name || 'משתמש',
      })
    } catch (e) {
      console.error('sendDirectMessage error:', e)
      setDraft(text)  // מחזיר את הטקסט אם נכשל
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ direction: 'rtl', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* כותרת */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: 'var(--surface)', borderBottom: '1px solid var(--line)', flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="חזרה" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <Avatar name={fullName} size={44} online={online} photoURL={photoURL} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>{fullName}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)' }}>
            {online ? 'מחובר עכשיו' : 'לא מחובר'}
          </div>
        </div>
      </div>

      {/* הודעות */}
      <div ref={scrollRef} className="scroll-area" style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>
              עוד אין הודעות.<br />כתבו את ההודעה הראשונה ל{fullName}!
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(m => {
              const mine = m.senderUid === myUid
              return (
                <div key={m.id} style={{
                  alignSelf: mine ? 'flex-start' : 'flex-end',
                  maxWidth: '78%',
                  background: mine ? 'var(--burgundy)' : 'var(--surface)',
                  color: mine ? '#fff' : 'var(--ink)',
                  border: mine ? 'none' : '1px solid var(--line)',
                  borderRadius: 16,
                  borderBottomRightRadius: mine ? 16 : 4,
                  borderBottomLeftRadius: mine ? 4 : 16,
                  padding: '10px 14px',
                  fontSize: 16, lineHeight: 1.4, fontWeight: 500,
                  boxShadow: 'var(--shadow-sm)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.text}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* שדה כתיבה */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: 'var(--surface)', borderTop: '1px solid var(--line)', flexShrink: 0,
      }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="כתבו הודעה..."
          style={{
            flex: 1, border: '1px solid var(--line)', borderRadius: 24,
            padding: '13px 18px', fontSize: 16, fontFamily: 'inherit',
            background: 'var(--bg-app)', color: 'var(--ink)', outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          style={{
            background: draft.trim() ? 'var(--burgundy)' : 'var(--line-strong)',
            color: '#fff', border: 'none', borderRadius: 24,
            padding: '13px 22px', fontSize: 16, fontWeight: 800,
            fontFamily: 'inherit', cursor: draft.trim() ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          שלח
        </button>
      </div>
    </div>
  )
}
