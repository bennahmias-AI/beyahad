// src/components/BlockReportBar.jsx
// ─────────────────────────────────────────────────────────────
// שורת כפתורי בטיחות: "חסום" + "דווח". משובצת בפרופיל חבר, בצ'אט הפרטי,
// ובחלון צפייה בעצה/מתכון. נותנת למשתמש רגיל כלים להתגונן מתוכן/אנשים
// פוגעניים — דרישת ליבה של אפליקציה חברתית (וגם של Google Play).
//
// props:
//   targetType: 'user' | 'tip' | 'recipe'
//   targetId:   uid של המשתמש, או postId של התוכן
//   targetName: שם לתצוגה (שם החבר / כותרת הפוסט)
//   showBlock:  האם להציג כפתור חסימה (ברירת מחדל: רק ל-'user')
//   onBlocked:  נקרא אחרי חסימה מוצלחת (למשל לחזור אחורה מהצ'אט)
//   compact:    גרסה קטנה (לכפתורים בתוך חלון תוכן)
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { blockUser } from '../services/firebase.js'
import ReportModal from './ReportModal.jsx'

export default function BlockReportBar({
  targetType, targetId, targetName,
  showBlock = targetType === 'user',
  onBlocked, compact = false,
}) {
  const { authUser } = useUserStore()
  const [reporting, setReporting] = useState(false)
  const [done, setDone] = useState('')   // הודעת אישור קצרה
  const [busy, setBusy] = useState(false)

  const handleBlock = async () => {
    if (!targetId || busy) return
    const name = targetName || 'המשתמש'
    if (!window.confirm(`לחסום את ${name}? לא תקבלו יותר הודעות מ${name}, ו${name} לא יופיע/תופיע לכם ברשימות.`)) return
    setBusy(true)
    const res = await blockUser(authUser?.uid, targetId)
    setBusy(false)
    if (res.ok) {
      setDone('המשתמש נחסם.')
      onBlocked && onBlocked()
    } else {
      alert('לא הצלחנו לחסום — נסו שוב')
    }
  }

  const btnStyle = {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: compact ? '10px 12px' : '13px 16px', borderRadius: 12, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: compact ? 14 : 15.5, fontWeight: 700,
    border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink-2)',
  }

  if (done) {
    return (
      <div style={{
        background: 'var(--surface-2)', color: 'var(--ink-2)', borderRadius: 12,
        padding: '12px 14px', fontSize: 14, fontWeight: 700, textAlign: 'center',
        marginTop: compact ? 10 : 14,
      }}>✓ {done} תודה שדיווחת.</div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginTop: compact ? 10 : 14 }}>
        {showBlock && (
          <button onClick={handleBlock} disabled={busy} style={btnStyle}>
            🚫 חסימה
          </button>
        )}
        <button onClick={() => setReporting(true)} style={btnStyle}>
          ⚠️ דיווח
        </button>
      </div>

      {reporting && (
        <ReportModal
          targetType={targetType}
          targetId={targetId}
          targetName={targetName}
          onClose={() => setReporting(false)}
          onDone={() => setDone('הדיווח נשלח לצוות הניהול.')}
        />
      )}
    </>
  )
}
