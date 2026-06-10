// src/components/ReportModal.jsx
// ─────────────────────────────────────────────────────────────
// חלון דיווח — נפתח כשמשתמש לוחץ "דווח" על משתמש או על תוכן (עצה/מתכון).
// בוחרים סיבה (תוכן פוגעני / הטרדה / ספאם / אחר) + הערה אופציונלית,
// והדיווח נשלח לאוסף reports שרק אדמין רואה.
//
// props:
//   targetType: 'user' | 'tip' | 'recipe'
//   targetId:   מזהה היעד (uid או postId)
//   targetName: שם לתצוגה (שם המשתמש או כותרת הפוסט)
//   onClose:    סגירה
//   onDone:     נקרא אחרי שליחה מוצלחת (להצגת הודעת תודה)
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { submitReport } from '../services/firebase.js'
import ModalPortal from './ModalPortal.jsx'

const REASONS = [
  { id: 'offensive',  label: 'תוכן פוגעני או לא הולם' },
  { id: 'harassment', label: 'הטרדה או התנהגות מאיימת' },
  { id: 'spam',       label: 'ספאם או פרסומת' },
  { id: 'other',      label: 'סיבה אחרת' },
]

export default function ReportModal({ targetType, targetId, targetName, onClose, onDone }) {
  const { authUser, profile } = useUserStore()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!reason) { setErr('נא לבחור סיבה לדיווח'); return }
    setSending(true); setErr('')
    const myName = [profile?.name, profile?.lastName].filter(Boolean).join(' ') || profile?.name || ''
    const res = await submitReport({
      reporterUid: authUser?.uid,
      reporterName: myName,
      targetType,
      targetId,
      targetName: targetName || '',
      reason,
      note,
    })
    setSending(false)
    if (res.ok) {
      onDone && onDone()
      onClose && onClose()
    } else {
      setErr('לא הצלחנו לשלוח את הדיווח — נסו שוב')
    }
  }

  const inputStyle = {
    width: '100%', fontSize: 16, fontFamily: 'inherit', padding: '12px 14px', borderRadius: 12,
    border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', direction: 'rtl',
  }

  return (
    <ModalPortal>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(20,23,42,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
          width: '100%', maxWidth: 430, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl',
        }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>⚠️ דיווח</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
            הדיווח יישלח לצוות הניהול לבדיקה. תודה שאתם עוזרים לשמור על קהילה בטוחה.
          </div>

          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>מה הסיבה לדיווח?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {REASONS.map(r => {
              const sel = reason === r.id
              return (
                <button key={r.id} type="button" onClick={() => setReason(r.id)} style={{
                  textAlign: 'right', padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
                  border: `1.5px solid ${sel ? 'var(--burgundy)' : 'var(--line-strong)'}`,
                  background: sel ? 'var(--burgundy-soft)' : 'var(--surface)',
                  color: sel ? 'var(--burgundy-deep)' : 'var(--ink)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${sel ? 'var(--burgundy)' : 'var(--line-strong)'}`,
                    background: sel ? 'var(--burgundy)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{sel && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}</span>
                  {r.label}
                </button>
              )
            })}
          </div>

          <label style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 8 }}>
            פרטים נוספים (לא חובה)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="ספרו לנו מה קרה..."
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />

          {err && (
            <div style={{ background: 'var(--burgundy-soft)', color: 'var(--burgundy-deep)', padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 700, marginTop: 14, textAlign: 'center' }}>{err}</div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>ביטול</button>
            <button onClick={handleSubmit} disabled={sending} className="big-btn" style={{
              flex: 2, background: 'var(--burgundy)', color: 'white', opacity: sending ? 0.7 : 1,
            }}>{sending ? 'שולח...' : 'שליחת דיווח'}</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
