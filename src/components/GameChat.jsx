// src/components/GameChat.jsx
// ─────────────────────────────────────────────────────────────
// שורת כלים חברתית למשחקי אונליין:
//   • כפתור "הוסף לחברים" — להוסיף את היריב (גם רנדומלי) לרשימת החברים.
//   • כפתור "צ'אט" — פותח חלון התכתבות עם היריב בתוך המשחק.
//
// משותף ל-4 בשורה ולדמקה. במשחק על רקע כהה (דמקה) מעבירים dark.
//
// הצ'אט נשמר כמערך הודעות על מסמך החדר (gameRooms/{id}.chat),
// כך שאין צורך בתשתית נפרדת — שני הצדדים רואים את ההודעות בזמן אמת
// דרך אותו watchGameRoom שכבר קיים במסך המשחק.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import {
  sendGameChat, sendFriendRequest, getFriendshipStatus,
} from '../services/firebase.js'

// סגנון כפתור לפי ערכת הצבעים (בהיר / כהה-עץ)
function barBtnStyle(dark) {
  return dark
    ? { background: 'rgba(255,255,255,.10)', color: '#FBF7EE', border: '1px solid rgba(255,255,255,.18)' }
    : { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' }
}

export default function GameSocialBar({ roomId, me, opponent, chat = [], dark = false }) {
  if (!me?.uid) return null
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
      <AddFriendButton me={me} opponent={opponent} dark={dark} />
      <ChatButton roomId={roomId} me={me} chat={chat} dark={dark} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// כפתור "הוסף לחברים"
// ═══════════════════════════════════════════════════════════
export function AddFriendButton({ me, opponent, dark, compact = false }) {
  const [status, setStatus] = useState('loading')  // loading | none | pending | accepted

  useEffect(() => {
    let active = true
    if (!me?.uid || !opponent?.uid) { setStatus('hidden'); return }
    getFriendshipStatus(me.uid, opponent.uid)
      .then(s => { if (active) setStatus(s) })
      .catch(() => { if (active) setStatus('none') })
    return () => { active = false }
  }, [me?.uid, opponent?.uid])

  if (!opponent?.uid || status === 'hidden') return null

  const add = async () => {
    setStatus('pending')
    try {
      await sendFriendRequest(
        { uid: me.uid, name: me.name },
        { uid: opponent.uid, name: opponent.name },
      )
    } catch (e) { /* נתעלם — הבקשה כבר קיימת או נכשלה בעדינות */ }
  }

  let label, disabled = false, onClick
  if (status === 'loading')       { label = '...';            disabled = true }
  else if (status === 'accepted') { label = '✓ חבר';          disabled = true }
  else if (status === 'pending')  { label = '⏳ בקשה נשלחה';   disabled = true }
  else                            { label = '➕ הוסף לחברים';  onClick = add }

  // גרסה קומפקטית — גלולה קטנה (לכרטיס היריב במשחק)
  if (compact) {
    let clabel
    if (status === 'loading') clabel = '...'
    else if (status === 'accepted') clabel = '✓ חבר'
    else if (status === 'pending') clabel = '⏳ נשלח'
    else clabel = '➕ חבר'
    return (
      <button onClick={onClick} disabled={disabled} style={{
        background: 'linear-gradient(180deg,#6b4528,#4a2e16)',
        border: '1px solid #C9A24A', borderRadius: 10, padding: '5px 10px',
        fontSize: 12, fontWeight: 800, fontFamily: 'inherit', color: '#F0D9A0',
        cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.85 : 1,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)',
      }}>{clabel}</button>
    )
  }

  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, borderRadius: 14, padding: '13px 10px',
      fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      opacity: disabled ? 0.8 : 1,
      ...barBtnStyle(dark),
    }}>
      {label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// כפתור צ'אט + חלון
// ═══════════════════════════════════════════════════════════
function ChatButton({ roomId, me, chat, dark }) {
  const [open, setOpen] = useState(false)
  const msgs = chat || []
  const [seen, setSeen] = useState(msgs.length)
  const unread = open ? 0 : Math.max(0, msgs.length - seen)

  useEffect(() => { if (open) setSeen(msgs.length) }, [open, msgs.length])

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        flex: 1, borderRadius: 14, padding: '13px 10px',
        fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        position: 'relative',
        ...barBtnStyle(dark),
      }}>
        💬 צ'אט
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -7, insetInlineEnd: -7,
            background: '#E8484F', color: 'white', fontSize: 12, fontWeight: 800,
            minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #FBF7EE',
          }}>
            {unread}
          </span>
        )}
      </button>
      <ChatToast msgs={msgs} meUid={me.uid} suppressed={open} onOpen={() => setOpen(true)} />
      {open && (
        <ChatPanel roomId={roomId} me={me} msgs={msgs} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

export function ChatPanel({ roomId, me, msgs, onClose }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  const send = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    await sendGameChat(roomId, {
      uid: me.uid,
      name: me.name || 'אני',
      text: t.slice(0, 300),
      ts: Date.now(),
    })
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200, direction: 'rtl',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 12px 14px', pointerEvents: 'none',
    }}>
      <div style={{
        pointerEvents: 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        maxWidth: 360, width: '100%',
        height: 'min(34vh, 270px)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 36px -6px rgba(0,0,0,.45)',
        overflow: 'hidden',
      }}>
        {/* כותרת */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--line)', flexShrink: 0,
        }}>
          <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>💬 צ'אט</div>
          <button onClick={onClose} aria-label="סגור" style={{
            width: 38, height: 38, borderRadius: 10, border: '1px solid var(--line)',
            background: 'var(--bg-app)', fontSize: 18, cursor: 'pointer', fontFamily: 'inherit',
            color: 'var(--ink-2)',
          }}>
            ✕
          </button>
        </div>

        {/* הודעות */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {msgs.length === 0 ? (
            <div style={{
              textAlign: 'center', color: 'var(--ink-3)',
              fontSize: 15, fontWeight: 600, marginTop: 24, lineHeight: 1.5,
            }}>
              עדיין אין הודעות.<br />כתבו שלום ליריב! 👋
            </div>
          ) : msgs.map((m, i) => {
            const mine = m.uid === me.uid
            return (
              <div key={i} style={{
                alignSelf: mine ? 'flex-start' : 'flex-end',
                maxWidth: '78%',
                background: mine ? 'var(--burgundy)' : 'var(--bg-app)',
                color: mine ? 'white' : 'var(--ink)',
                border: mine ? 'none' : '1px solid var(--line)',
                borderRadius: 16, padding: '9px 13px',
                fontSize: 16, fontWeight: 600, lineHeight: 1.35,
                wordBreak: 'break-word',
              }}>
                {!mine && (
                  <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 2 }}>
                    {m.name}
                  </div>
                )}
                {m.text}
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* תיבת כתיבה */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 14px',
          borderTop: '1px solid var(--line)', flexShrink: 0,
        }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder="כתבו הודעה..."
            maxLength={300}
            style={{
              flex: 1, borderRadius: 12, border: '1px solid var(--line-strong)',
              padding: '12px 14px', fontSize: 16, fontFamily: 'inherit',
              outline: 'none', background: 'var(--bg-app)', color: 'var(--ink)',
            }}
          />
          <button onClick={send} style={{
            background: 'var(--burgundy)', color: 'white', border: 'none',
            borderRadius: 12, padding: '0 20px', fontSize: 16, fontWeight: 800,
            fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
          }}>
            שלח
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// בועת התראה — קופצת כשמגיעה הודעה חדשה מהיריב (כשהצ'אט סגור)
// ═══════════════════════════════════════════════════════════════
export function ChatToast({ msgs = [], meUid, suppressed = false, onOpen }) {
  const [toast, setToast] = useState(null)
  const lastTsRef = useRef(msgs.length ? (msgs[msgs.length - 1].ts || 0) : 0)

  useEffect(() => {
    if (!msgs.length) return
    const last = msgs[msgs.length - 1]
    const ts = last.ts || 0
    if (ts <= lastTsRef.current) return
    lastTsRef.current = ts
    if (last.uid === meUid) return       // הודעה שלי — לא מקפיצים
    if (suppressed) return               // הצ'אט פתוח — כבר רואים
    setToast(last)
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [msgs.length]) // eslint-disable-line

  if (!toast) return null
  return (
    <div
      onClick={() => { setToast(null); onOpen && onOpen() }}
      style={{
        position: 'fixed', insetInlineStart: '50%', transform: 'translateX(-50%)',
        bottom: 92, zIndex: 1100, maxWidth: 340, width: 'calc(100% - 32px)',
        background: 'linear-gradient(180deg,#3a2a18,#241608)',
        border: '1.5px solid #C9A24A', borderRadius: 16, padding: '11px 14px',
        boxShadow: '0 10px 28px -6px rgba(0,0,0,.55)', cursor: 'pointer', direction: 'rtl',
        display: 'flex', alignItems: 'center', gap: 10, animation: 'chatToastIn .28s ease',
      }}
    >
      <div style={{ fontSize: 22, flexShrink: 0 }}>💬</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#E8C879', marginBottom: 1 }}>{toast.name || 'הודעה חדשה'}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#F3E2BE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.text}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#C9A24A', flexShrink: 0 }}>פתח ›</div>
      <style>{`@keyframes chatToastIn { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  )
}
