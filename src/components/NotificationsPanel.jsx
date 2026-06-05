// src/components/NotificationsPanel.jsx
// ─────────────────────────────────────────────────────────────
// פאנל ההתראות — נפתח מלמעלה כשלוחצים על הפעמון במסך הבית.
// מציג את כל ההתראות (בקשות חברות, הזמנות למשחק, הודעות, לייקים),
// החדשות מודגשות. לחיצה על התראה מנווטת למקום הרלוונטי.
// ─────────────────────────────────────────────────────────────
import { IconBackRTL } from '../icons/index.jsx'

// אייקון עגול צבעוני לכל סוג התראה — אייקוני קו (SVG) במקום אמוג'י
function TypeIcon({ type }) {
  const BG = {
    friend:   '#4F6B4A',
    invite:   '#7E2C2E',
    chat:     '#2C5566',
    like:     '#B89048',
    approved: '#3E6B34',
    rejected: '#8A6A2E',
    admin:    '#2F3A56',
  }
  const bg = BG[type] || '#6B3A4F'
  return (
    <div style={{
      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <NotifGlyph type={type} />
    </div>
  )
}

// גליף לבן (קו) לכל סוג התראה — תואם לשפת ה-LineIcon של האפליקציה
function NotifGlyph({ type }) {
  const p = {
    width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
    stroke: '#FBF7EE', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  switch (type) {
    case 'friend':   // בקשת חברות — דמות אדם
      return (<svg {...p}><circle cx="12" cy="8" r="4" /><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>)
    case 'invite':   // הזמנה למשחק — בקר משחק
      return (<svg {...p}><rect x="2" y="6" width="20" height="12" rx="4" /><line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" /><line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" /></svg>)
    case 'chat':     // הודעה — בועת דיבור
      return (<svg {...p}><path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.8-5.4A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 17 0Z" /></svg>)
    case 'like':     // לייק — לב
      return (<svg {...p}><path d="M12 20S3.5 14.5 3.5 8.8C3.5 6 5.6 4 8 4c1.6 0 3 .9 4 2.3C13 4.9 14.4 4 16 4c2.4 0 4.5 2 4.5 4.8C20.5 14.5 12 20 12 20Z" /></svg>)
    case 'approved': // אושר — וי סימון
      return (<svg {...p}><path d="M4 12.5 10 18 20 6" /></svg>)
    case 'rejected': // לא אושר — מסמך
      return (<svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="M9.5 13.5h5M9.5 16.5h3" /></svg>)
    case 'admin':    // הודעה מההנהלה — רמקול/כרוז
      return (<svg {...p}><path d="M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1Z" /><path d="M16 8.5a5 5 0 0 1 0 7" /></svg>)
    default:         // ברירת מחדל — פעמון
      return (<svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>)
  }
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
