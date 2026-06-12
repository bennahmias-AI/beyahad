// src/components/LeaveConfirmModal.jsx
// ─────────────────────────────────────────────────────────────
// חלון אישור יציאה — "לעזוב את המשחק?" / "לצאת מעריכת הברכה?"
//
// לפי העיצוב המאושר: כפתור ראשי גדול בורגנדי "לא, להישאר"
// וכפתור משני בקו-מתאר "כן, לעזוב". נפתח בלחיצת חזרה (חומרה
// או כפתור) באמצע משחק פעיל / עריכה, כדי למנוע יציאה בטעות.
// ─────────────────────────────────────────────────────────────
export default function LeaveConfirmModal({
  emoji = '🚪',
  title = 'לעזוב את המשחק?',
  subtitle = 'המשחק הנוכחי יסתיים',
  stayLabel = 'לא, להישאר במשחק',
  leaveLabel = 'כן, לעזוב',
  onStay,
  onLeave,
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 24, padding: '28px 24px 22px',
        maxWidth: 340, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>{emoji}</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, marginBottom: 20, lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}
        <button onClick={onStay} className="big-btn big-btn--primary" style={{ width: '100%', marginBottom: 10 }}>
          {stayLabel}
        </button>
        <button onClick={onLeave} className="big-btn big-btn--ghost" style={{
          width: '100%', border: '2px solid var(--burgundy)', color: 'var(--burgundy)', fontWeight: 800,
        }}>
          {leaveLabel}
        </button>
      </div>
    </div>
  )
}
