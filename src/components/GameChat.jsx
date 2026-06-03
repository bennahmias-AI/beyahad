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
import { IconChatLine } from '../icons/index.jsx'

// סגנון כפתור לפי ערכת הצבעים (בהיר / כהה-עץ)
function barBtnStyle(dark) {
  return dark
    ? { background: 'rgba(255,255,255,.10)', color: '#FBF7EE', border: '1px solid rgba(255,255,255,.18)' }
    : { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)' }
}

export default function GameSocialBar({ roomId, me, opponent, chat = [], dark = false, suppressToast = false }) {
  if (!me?.uid) return null
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
      <AddFriendButton me={me} opponent={opponent} dark={dark} />
      <ChatButton roomId={roomId} me={me} chat={chat} dark={dark} suppressToast={suppressToast} />
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
    // סימון ברור: ＋ למי שעדיין לא חבר (לחיצה שולחת בקשה) · ✓ למי שכבר חבר.
    let clabel, isFriend = false
    if (status === 'loading') clabel = '…'
    else if (status === 'accepted') { clabel = '✓ חבר'; isFriend = true }
    else if (status === 'pending') clabel = '✓ נשלח'
    else clabel = '＋ הוסף'
    return (
      <button onClick={onClick} disabled={disabled} style={{
        background: isFriend ? 'rgba(79,107,74,.85)' : 'linear-gradient(180deg,#6b4528,#4a2e16)',
        border: `1px solid ${isFriend ? '#7FBF7A' : '#C9A24A'}`, borderRadius: 10, padding: '5px 11px',
        fontSize: 12, fontWeight: 800, fontFamily: 'inherit', color: isFriend ? '#EAF7E8' : '#F0D9A0',
        cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: disabled ? 0.9 : 1,
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
function ChatButton({ roomId, me, chat, dark, suppressToast = false }) {
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
      {!suppressToast && <ChatToast msgs={msgs} meUid={me.uid} suppressed={open} onOpen={() => setOpen(true)} />}
      {open && (
        <ChatPanel roomId={roomId} me={me} msgs={msgs} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// כפתור צ'אט צף — עיגול בפינה התחתונה, בדיוק כמו ב"מלך הזירה".
// משותף לכל משחקי האונליין; מקבל פלטת צבעים מותאמת לכל משחק.
//   chat   = מערך ההודעות (לחישוב מונה שלא-נקראו)
//   open   = האם חלון הצ'אט פתוח כרגע
//   onOpen = נפתח בלחיצה
// ═══════════════════════════════════════════════════════════
export function ChatFab({
  chat = [], open, onOpen,
  bg = 'linear-gradient(180deg,#4A2A66,#2A1438)',
  border = '#C9A24A', color = '#E8C879', ringColor = '#2A1438',
}) {
  const [seen, setSeen] = useState(chat.length)
  useEffect(() => { if (open) setSeen(chat.length) }, [open, chat.length])
  const unread = open ? 0 : Math.max(0, chat.length - seen)
  return (
    <button onClick={onOpen} aria-label="צ'אט" style={{
      position: 'fixed', insetInlineEnd: 16, bottom: 16, zIndex: 1150,
      width: 60, height: 60, borderRadius: '50%', cursor: 'pointer',
      background: bg, border: `2px solid ${border}`, color, fontSize: 26,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 16px rgba(0,0,0,.5)', fontFamily: 'inherit',
    }}>
      💬
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -4, insetInlineStart: -4,
          background: '#E8484F', color: 'white', fontSize: 12, fontWeight: 800,
          minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${ringColor}`,
        }}>{unread}</span>
      )}
    </button>
  )
}

// ══════════════════════════════════════════════════════════
// אייקון צ'אט לכותרת — כפתור קטן עגול שיושב בשורת הכותרת העליונה.
// מחליף את העיגול הצף — כך הצ'אט לא מסתיר את הלוח או כפתורי הפעולה.
//   bg/border/color — מתאימים לכותרת (בהירה/כהה) של כל משחק.
export function ChatHeaderButton({
  chat = [], open, onOpen, size = 40,
  bg = 'var(--surface)', border = 'var(--line)', color = 'var(--ink)',
}) {
  const [seen, setSeen] = useState(chat.length)
  useEffect(() => { if (open) setSeen(chat.length) }, [open, chat.length])
  const unread = open ? 0 : Math.max(0, chat.length - seen)
  return (
    <button onClick={onOpen} aria-label="צ'אט" style={{
      position: 'relative', width: size, height: size, borderRadius: 12,
      cursor: 'pointer', background: bg,
      border: `1px solid ${border}`, color,
      fontSize: Math.round(size * 0.5), padding: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit', flexShrink: 0,
    }}>
      <IconChatLine size={Math.round(size * 0.52)} color={color} />
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -5, insetInlineStart: -5,
          background: '#E8484F', color: 'white', fontSize: 11, fontWeight: 800,
          minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #FBF7EE',
        }}>{unread}</span>
      )}
    </button>
  )
}

export function ChatPanel({ roomId, me, msgs, onClose, sendFn }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  const send = async () => {
    const t = text.trim()
    if (!t) return
    setText('')
    const message = {
      uid: me.uid,
      name: me.name || 'אני',
      text: t.slice(0, 300),
      ts: Date.now(),
    }
    // אם סופקה פונקציית שליחה ייעודית (רמיקוב) — משתמשים בה; אחרת sendGameChat
    if (sendFn) await sendFn(roomId, message)
    else await sendGameChat(roomId, message)
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
export function ChatToast({ msgs = [], meUid, suppressed = false, onOpen, inline = false }) {
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

  const inner = (
    <>
      <div style={{ fontSize: 20, flexShrink: 0 }}>💬</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#E8C879', marginBottom: 1 }}>{toast.name || 'הודעה חדשה'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F3E2BE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toast.text}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A24A', flexShrink: 0 }}>פתח ›</div>
      <style>{`@keyframes chatToastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </>
  )

  const baseStyle = {
    background: 'linear-gradient(180deg,#3a2a18,#241608)',
    border: '1.5px solid #C9A24A', borderRadius: 14, padding: '10px 13px',
    cursor: 'pointer', direction: 'rtl', display: 'flex', alignItems: 'center', gap: 9,
    boxShadow: '0 6px 18px -4px rgba(0,0,0,.5)', animation: 'chatToastIn .26s ease',
  }
  const style = inline
    ? { ...baseStyle, position: 'relative', width: '100%', margin: '10px 0 2px' }
    : { ...baseStyle, position: 'fixed', insetInlineEnd: 12, bottom: 86, zIndex: 1100, maxWidth: 'min(290px, calc(100vw - 24px))' }

  return (
    <div onClick={() => { setToast(null); onOpen && onOpen() }} style={style}>
      {inner}
    </div>
  )
}
