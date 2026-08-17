// src/components/AdminBroadcastPanel.jsx
// פאנל "שליחת התראה למשתמשים" לבורד הניהול — עצמאי לחלוטין (מאזין לבד ל-Firestore).
// משובץ גם ב-AdminDashboard (מובייל) וגם ב-AdminDashboardDesktop.
//
// שולח בשני ערוצים במקביל לכל נמען:
//   1. push אמיתי לטלפון  → POST /api/notify (נייטיב + דפדפן)
//   2. התראה בפעמון באפליקציה → sendUserNotification (אוסף notifications)
// כך שגם מי שהטלפון שלו היה כבוי יראה את ההודעה כשייכנס.
//
// מכבדים את העדפת המשתמש: מי שכיבה התראות (notificationsEnabled === false)
// לא יקבל push — השרת כבר מסנן אותו, וגם אנחנו מדלגים עליו בספירה.
import { useState, useEffect, useMemo } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { watchAllUsers, db } from '../services/firebase.js'
import Avatar from './Avatar.jsx'

const ACCENT = '#2F3A56'
const NOTIFY_URL = 'https://beyahad-gamma.vercel.app/api/notify'

function fullName(u) {
  const n = [u.name, u.lastName].filter(Boolean).join(' ').trim()
  return n || 'ללא שם'
}

// כתיבת ההתראה לפעמון — בדיוק במבנה שהאפליקציה מצפה לו:
//   notifications/{id} = { toUid, title, body, type: 'admin', createdAt }
// הכללים מרשים יצירה למנהל בלבד.
async function bellTo(uid, title, body) {
  await addDoc(collection(db, 'notifications'), {
    toUid: uid, title, body, type: 'admin', createdAt: serverTimestamp(),
  })
}

// שליחת push למשתמש בודד. best-effort — לא מפילים את כל המשלוח בגלל אחד.
async function pushTo(uid, title, body) {
  try {
    const res = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUid: uid, type: 'admin', title, body, tag: 'admin-msg' }),
    })
    const data = await res.json().catch(() => ({}))
    return !!data.ok
  } catch (e) {
    console.warn('push failed for', uid, e)
    return false
  }
}

export default function AdminBroadcastPanel() {
  const [users, setUsers] = useState([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('all')     // 'all' | 'some'
  const [pickedUids, setPickedUids] = useState([]) // בחירה מרובה
  const [search, setSearch] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [report, setReport] = useState(null)      // { total, pushed, bellOnly, failed }

  useEffect(() => {
    const unsub = watchAllUsers(setUsers)
    return () => { unsub && unsub() }
  }, [])

  // נמענים בפועל — לא שולחים לחסומים
  const active = useMemo(() => users.filter(u => !u.blocked), [users])
  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return active
    return active.filter(u => fullName(u).includes(q) || (u.phone || '').includes(q))
  }, [active, search])

  const recipients = target === 'all'
    ? active
    : active.filter(u => pickedUids.includes(u.id))

  const toggleUid = (id) => setPickedUids(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )
  const selectAllShown = () => setPickedUids(prev => {
    const ids = filtered.map(u => u.id)
    const allIn = ids.every(id => prev.includes(id))
    return allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
  })

  const canSend = title.trim().length > 0 && body.trim().length > 0 && recipients.length > 0 && !sending

  async function doSend() {
    setConfirmOpen(false)
    setSending(true)
    setReport(null)
    const t = title.trim(), b = body.trim()
    let pushed = 0, bellOnly = 0, failed = 0

    for (const u of recipients) {
      // התראה בפעמון — תמיד (גם למי שכיבה push)
      let bellOk = false
      try {
        await bellTo(u.id, t, b)
        bellOk = true
      } catch (e) { console.warn('bell failed for', u.id, e) }

      // push לטלפון — רק למי שלא כיבה התראות
      let pushOk = false
      if (u.notificationsEnabled !== false) pushOk = await pushTo(u.id, t, b)

      if (pushOk) pushed++
      else if (bellOk) bellOnly++
      else failed++
    }

    setReport({ total: recipients.length, pushed, bellOnly, failed })
    setSending(false)
    setTitle(''); setBody('')
  }

  const box = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15,
    border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px',
    background: 'var(--surface)', color: 'var(--ink)', direction: 'rtl',
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18,
      padding: '16px 16px 18px', marginBottom: 16, direction: 'rtl',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>📣</span>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>שליחת התראה למשתמשים</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, marginBottom: 14 }}>
        ההודעה תישלח כהתראה לטלפון וגם תופיע בפעמון בתוך האפליקציה.
        מי שכיבה התראות בהגדרות יקבל אותה בפעמון בלבד.
      </div>

      {/* כותרת + תוכן */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>כותרת</label>
          <input value={title} onChange={e => setTitle(e.target.value.slice(0, 60))} maxLength={60}
            placeholder="למשל: משחק חדש באפליקציה!" style={box} />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{title.length}/60</div>
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}>תוכן ההודעה</label>
          <textarea value={body} onChange={e => setBody(e.target.value.slice(0, 180))} maxLength={180} rows={3}
            placeholder="למשל: הוספנו את הברידג' של קלרה — בואו לשחק!" style={{ ...box, resize: 'none' }} />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{body.length}/180</div>
        </div>
      </div>

      {/* בחירת נמענים */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'block', marginBottom: 6 }}>למי לשלוח</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[{ k: 'all', l: `כל המשתמשים (${active.length})` }, { k: 'some', l: 'משתמשים נבחרים' }].map(o => (
            <button key={o.k} onClick={() => setTarget(o.k)} style={{
              flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              border: 'none', borderRadius: 12, padding: '11px 8px',
              background: target === o.k ? ACCENT : 'var(--surface-2)',
              color: target === o.k ? '#fff' : 'var(--ink-2)',
            }}>{o.l}</button>
          ))}
        </div>

        {target === 'some' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם או טלפון" style={{ ...box, flex: 1 }} />
              <button onClick={selectAllShown} style={{
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                border: '1px solid var(--line)', borderRadius: 12, padding: '0 14px',
                background: 'var(--surface-2)', color: 'var(--ink-2)', whiteSpace: 'nowrap',
              }}>סמן הכל</button>
            </div>
            {pickedUids.length > 0 && (
              <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
                נבחרו {pickedUids.length} משתמשים
                <button onClick={() => setPickedUids([])} style={{
                  marginInlineStart: 8, background: 'none', border: 'none', color: 'var(--ink-3)',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>נקה בחירה</button>
              </div>
            )}
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
              {filtered.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>לא נמצאו משתמשים</div>
              )}
              {filtered.map(u => {
                const on = pickedUids.includes(u.id)
                return (
                  <button key={u.id} onClick={() => toggleUid(u.id)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'right',
                    border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                    background: on ? 'var(--surface-2)' : 'transparent',
                    padding: '9px 12px', fontFamily: 'inherit',
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${on ? ACCENT : 'var(--line-strong, #ccc)'}`,
                      background: on ? ACCENT : 'transparent', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800,
                    }}>{on ? '✓' : ''}</span>
                    <Avatar name={fullName(u)} size={34} photoURL={u.photoURL} />
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{fullName(u)}</span>
                    {u.notificationsEnabled === false && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#B8860B' }}>התראות כבויות</span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* תצוגה מקדימה */}
      {(title.trim() || body.trim()) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>איך זה ייראה בטלפון</div>
          <div style={{
            background: '#1B1B1E', borderRadius: 14, padding: '11px 13px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'linear-gradient(135deg,#8A4D6A,#6B3A4F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
            }}>💛</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: '#A9A6A0', marginBottom: 1 }}>ביחד · עכשיו</div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#F6F0E3' }}>{title.trim() || 'כותרת ההודעה'}</div>
              <div style={{ fontSize: 13.5, color: '#D8D4CC', lineHeight: 1.35 }}>{body.trim() || 'תוכן ההודעה'}</div>
            </div>
          </div>
        </div>
      )}

      {/* שליחה */}
      <button onClick={() => setConfirmOpen(true)} disabled={!canSend} style={{
        width: '100%', fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
        cursor: canSend ? 'pointer' : 'default', border: 'none', borderRadius: 14,
        padding: '14px 10px', background: ACCENT, color: '#fff', opacity: canSend ? 1 : 0.5,
      }}>{sending ? 'שולח...' : `שליחה ל-${recipients.length} משתמשים`}</button>

      {/* דוח אחרי שליחה */}
      {report && (
        <div style={{
          marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)',
        }}>
          <div style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>הדוח: נשלח ל-{report.total} משתמשים</div>
          <div>✅ קיבלו התראה בטלפון: <strong>{report.pushed}</strong></div>
          <div>🔔 בפעמון בלבד (התראות כבויות / בלי מכשיר רשום): <strong>{report.bellOnly}</strong></div>
          {report.failed > 0 && <div style={{ color: '#C0392B' }}>⚠ נכשלו לגמרי: <strong>{report.failed}</strong></div>}
        </div>
      )}

      {/* אישור לפני שליחה — כדי שלא יישלח בטעות */}
      {confirmOpen && (
        <div onClick={() => setConfirmOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, direction: 'rtl',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 20, padding: '22px 20px', maxWidth: 360, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📣</div>
            <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)', marginBottom: 8 }}>
              לשלוח ל-{recipients.length} משתמשים?
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 18 }}>
              ההתראה תגיע לטלפונים שלהם מיד. אי אפשר לבטל אחרי השליחה.
            </div>
            <button onClick={doSend} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 8 }}>כן, שלח עכשיו</button>
            <button onClick={() => setConfirmOpen(false)} className="big-btn big-btn--ghost" style={{ width: '100%' }}>ביטול</button>
          </div>
        </div>
      )}
    </div>
  )
}
