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
  watchDirectChat, sendDirectMessage, watchUser, uploadVoiceMessage,
} from '../services/firebase.js'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder.js'
import VoiceMessage from '../components/VoiceMessage.jsx'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL, IconPhone, IconGamepad, IconVideoLine } from '../icons/index.jsx'

export default function DirectChatPage({ friend, onBack, onVideoCall, onCallFriend, onPlayFriend }) {
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

  // הקלטה קולית
  const recorder = useVoiceRecorder()
  const [sendingVoice, setSendingVoice] = useState(false)

  // סיום הקלטה — מעלה ושולח את ההודעה הקולית
  const finishAndSendVoice = async () => {
    const result = await recorder.stop()
    if (!result || !result.blob || !myUid || !otherUid) return
    setSendingVoice(true)
    try {
      const audioUrl = await uploadVoiceMessage({ fromUid: myUid, toUid: otherUid, blob: result.blob })
      await sendDirectMessage({
        fromUid: myUid,
        toUid: otherUid,
        senderName: profile?.name || 'משתמש',
        audioUrl,
        durationSec: result.durationSec,
      })
    } catch (e) {
      console.error('send voice error:', e)
      alert('לא הצלחנו לשלוח את ההקלטה. נסו שוב.')
    }
    setSendingVoice(false)
  }

  const cancelVoice = async () => {
    await recorder.cancel()
  }

  // ── לוגיקת כפתור וואטסאפ (לחיצה ארוכה) ──
  const hasText = draft.trim().length > 0
  // סימון שהמשתמש משך את האצבע החוצה מהכפתור — אז שחרור מבטל במקום לשלוח
  const pointerLeftRef = useRef(false)

  // תחילת לחיצה — מתחילים להקליט
  const startHold = (e) => {
    if (sendingVoice || recorder.recording) return
    // תופסים את ה-pointer כדי לקבל את ה-up גם אם האצבע זזה
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    pointerLeftRef.current = false
    recorder.start()
  }

  // שחרור האצבע — אם לא יצא מהכפתור: שולח. אם יצא: מבטל.
  const endHold = () => {
    if (!recorder.recording) return
    if (pointerLeftRef.current) { cancelVoice() }
    else { finishAndSendVoice() }
    pointerLeftRef.current = false
  }

  // האצבע יצא מגבולות הכפתור תוך כדי הקלטה — מסמן לביטול
  const pointerLeftButton = () => {
    if (recorder.recording) pointerLeftRef.current = true
  }

  const cancelHold = () => {
    if (recorder.recording) cancelVoice()
    pointerLeftRef.current = false
  }

  // פורמט טיימר ההקלטה (למשל 0:07)
  const fmtTimer = (s) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ direction: 'rtl', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
      {/* כותרת */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--surface)', borderBottom: '1px solid var(--line)', flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="חזרה" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <Avatar name={fullName} size={42} online={online} photoURL={photoURL} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)' }}>
            {online ? 'מחובר עכשיו' : 'לא מחובר'}
          </div>
        </div>
        {/* כפתורי פעולה — וידאו, קפה (קולי), משחק */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <HeaderAction icon={<IconVideoLine size={19} color="#fff" />} bg="#4F6B4A" label="שיחת וידאו" onClick={() => onVideoCall && onVideoCall(friend)} />
          <HeaderAction icon={<IconPhone size={19} color="#fff" />} bg="var(--success)" label="שיחת קפה" onClick={() => onCallFriend && onCallFriend(friend)} />
          <HeaderAction icon={<IconGamepad size={19} color="#fff" />} bg="var(--burgundy)" label="משחק" onClick={() => onPlayFriend && onPlayFriend(friend)} />
        </div>
      </div>

      {/* הודעות */}
      <div ref={scrollRef} className="scroll-area" style={{ flex: 1, minHeight: 0, padding: '16px', overflowY: 'auto' }}>
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
                  padding: m.type === 'voice' ? '8px 10px' : '10px 14px',
                  fontSize: 16, lineHeight: 1.4, fontWeight: 500,
                  boxShadow: 'var(--shadow-sm)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.type === 'voice'
                    ? <VoiceMessage audioUrl={m.audioUrl} durationSec={m.durationSec} mine={mine} />
                    : m.text}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* שדה כתיבה / הקלטה */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: 'var(--surface)', borderTop: '1px solid var(--line)', flexShrink: 0,
      }}>
        {/* אזור שמאלי: טיימר הקלטה או שדה כתיבה */}
        {recorder.recording ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-app)', borderRadius: 24, padding: '0 18px', height: 54,
          }}>
            <span className="live-dot" style={{ background: 'var(--danger)', width: 12, height: 12 }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
              {fmtTimer(recorder.seconds)}
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--forest)', textAlign: 'center' }}>
              🎙️ שחררו לשליחה · החליקו לביטול
            </span>
          </div>
        ) : (
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }, 300)
            }}
            placeholder="כתבו הודעה..."
            disabled={sendingVoice}
            style={{
              flex: 1, minWidth: 0, width: 0, border: '1px solid var(--line)', borderRadius: 24,
              padding: '13px 18px', fontSize: 16, fontFamily: 'inherit',
              background: 'var(--bg-app)', color: 'var(--ink)', outline: 'none',
            }}
          />
        )}

        {/* כפתור מתחלף: שליחה כשיש טקסט, אחרת מיקרופון (לחיצה ארוכה) */}
        {/* הכפתור נשאר תמיד ב-DOM כדי לקבל את אירוע השחרור גם תוך כדי הקלטה */}
        {hasText && !recorder.recording ? (
          /* יש טקסט — כפתור שליחה */
          <button
            onClick={send}
            aria-label="שלח"
            style={{
              background: 'var(--burgundy)', color: '#fff', border: 'none', borderRadius: '50%',
              width: 54, height: 54, padding: 0, flexShrink: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px -2px rgba(126,44,46,.5)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        ) : (
          /* אין טקסט — כפתור מיקרופון: לחיצה ארוכה מקליטה, שחרור שולח */
          <button
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={pointerLeftButton}
            onPointerCancel={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
            disabled={sendingVoice}
            aria-label="החזיקו כדי להקליט הודעה קולית"
            style={{
              background: sendingVoice ? 'var(--line-strong)' : (recorder.recording ? 'var(--danger)' : 'var(--forest)'),
              color: '#fff', border: 'none', borderRadius: '50%',
              width: recorder.recording ? 64 : 54, height: recorder.recording ? 64 : 54,
              padding: 0, flexShrink: 0,
              cursor: sendingVoice ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recorder.recording ? '0 0 0 6px rgba(200,40,40,.25)' : '0 2px 8px -2px rgba(79,107,74,.5)',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              transition: 'width .15s, height .15s, background .15s',
            }}
          >
            {sendingVoice ? (
              <span style={{ fontSize: 13, fontWeight: 700 }}>...</span>
            ) : (
              <svg width={recorder.recording ? 30 : 26} height={recorder.recording ? 30 : 26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </button>
        )}
      </div>

      {recorder.error && (
        <div style={{
          padding: '8px 16px 12px', background: 'var(--surface)',
          color: 'var(--danger)', fontSize: 14, fontWeight: 600, textAlign: 'center',
        }}>
          {recorder.error}
        </div>
      )}
    </div>
  )
}

// כפתור פעולה בכותרת הצ'אט (וידאו / קפה / משחק)
function HeaderAction({ icon, bg, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 42, height: 42, borderRadius: '50%', background: bg,
        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, boxShadow: 'var(--shadow-sm)',
      }}
    >
      {icon}
    </button>
  )
}
