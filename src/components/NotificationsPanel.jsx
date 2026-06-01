// src/components/NotificationsPanel.jsx
// ─────────────────────────────────────────────────────────────
// פאנל ההתראות — נפתח מלמעלה כשלוחצים על הפעמון במסך הבית.
// מציג את כל ההתראות (בקשות חברות, הזמנות למשחק, הודעות, לייקים),
// החדשות מודגשות. לחיצה על התראה מנווטת למקום הרלוונטי.
// ─────────────────────────────────────────────────────────────
import { IconBackRTL } from '../icons/index.jsx'

// אייקון עגול צבעוני לכל סוג התראה
function TypeIcon({ type }) {
  const map = {
    friend: { bg: '#4F6B4A', emoji: '👋' },
    invite: { bg: '#7E2C2E', emoji: '🎮' },
    chat:   { bg: '#2C5566', emoji: '💬' },
    like:   { bg: '#B89048', emoji: '❤️' },
  }
  const s = map[type] || { bg: '#6B3A4F', emoji: '🔔' }
  return (
    <div style={{
      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
      background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22,
    }}>{s.emoji}</div>
  )
}

export default function NotificationsPanel({ items, onClose, onNavigate }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(20,15,8,.45)',
        display: 'flex', flexDirection: 'column',
        direction: 'rtl',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-app)',
          borderRadius: '0 0 24px 24px',
          maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 8px 30px rgba(0,0,0,.3)',
          paddingBottom: 12,
        }}
      >
        {/* כותרת */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px', position: 'sticky', top: 0,
          background: 'var(--bg-app)', borderBottom: '1px solid var(--line)',
          zIndex: 1,
        }}>
          <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)' }}>ההתראות שלך</div>
          <button onClick={onClose} aria-label="סגור" style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: 'var(--surface)', color: 'var(--ink)', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* רשימה */}
        <div style={{ padding: '8px 16px 4px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🔔</div>
              <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', marginBottom: 4 }}>אין התראות חדשות</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>כאן יופיעו בקשות חברות, הזמנות למשחק, הודעות ולייקים</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(it => (
                <button
                  key={it.id}
                  onClick={() => onNavigate(it)}
                  style={{
                    width: '100%', textAlign: 'right',
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: it.isNew ? 'var(--surface)' : 'transparent',
                    border: it.isNew ? '1px solid var(--burgundy)' : '1px solid var(--line)',
                    borderRadius: 16, padding: '12px 14px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    position: 'relative',
                  }}
                >
                  <TypeIcon type={it.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="h-display" style={{
                      fontSize: 16, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 2,
                    }}>{it.title}</div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{it.body}</div>
                  </div>
                  {it.isNew && (
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--burgundy)',
                    }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
