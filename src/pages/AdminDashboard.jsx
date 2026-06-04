// src/pages/AdminDashboard.jsx
// בורד ניהול — מוגן בשער הרשאה (רק role==='admin'). נגיש דרך ?admin בכתובת.
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchAllUsers, getAllUsers, getAllCommunityPosts,
  setUserRole, setUserBlocked,
} from '../services/firebase.js'
import { IconBackRTL } from '../icons/index.jsx'

const ACCENT = '#2F3A56'
const ROLE_LABEL = { admin: 'מנהל', premium: 'פרימיום', user: 'רגיל' }
const ROLE_COLOR = { admin: '#7E2C2E', premium: '#B89048', user: '#5E7CA6' }

function roleOf(u) { return u.role || 'user' }

// המרת Firestore Timestamp ל-ms (או 0)
function toMs(ts) {
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
}

// תווית "נראה לאחרונה"
function lastSeenLabel(u) {
  const ms = toMs(u.lastSeenAt)
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 2 * 60 * 1000) return 'מחובר/ת עכשיו'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `לפני ${mins} ד׳`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `לפני ${hrs} ש׳`
  return `לפני ${Math.round(hrs / 24)} ימים`
}

export default function AdminDashboard({ onExit }) {
  const { profile } = useUserStore()
  const isAdmin = profile?.role === 'admin'

  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState(null)   // uid שעליו מתבצעת פעולה כרגע
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    const unsub = watchAllUsers(list => { setUsers(list); setLoading(false) })
    getAllCommunityPosts().then(setPosts).catch(() => {})
    return () => unsub && unsub()
  }, [isAdmin])

  // שינוי תפקיד למשתמש
  async function changeRole(uid, role) {
    setBusyUid(uid)
    try { await setUserRole(uid, role) } catch (e) { console.error('setUserRole:', e) }
    setBusyUid(null)
  }
  // חסימה / שחרור
  async function toggleBlock(u) {
    if (u.blocked ? false : !window.confirm(`לחסום את ${u.name || 'המשתמש'}? הוא/היא לא יוכל/ת להשתמש באפליקציה.`)) return
    setBusyUid(u.id)
    try { await setUserBlocked(u.id, !u.blocked) } catch (e) { console.error('setUserBlocked:', e) }
    setBusyUid(null)
  }

  // ייצוא משתמשים ל-CSV
  function exportUsers() {
    const rows = users.map(u => ({
      uid: u.id, name: u.name || '', role: roleOf(u),
      blocked: u.blocked ? 'כן' : 'לא', status: u.status || '',
      lastSeen: toMs(u.lastSeenAt) ? new Date(toMs(u.lastSeenAt)).toLocaleString('he-IL') : '',
    }))
    downloadCSV(`beyahad-users-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }
  // ייצוא תוכן ל-CSV
  function exportPosts() {
    const rows = posts.map(p => ({
      id: p.id, kind: p.kind, title: p.title || '', category: p.category || '',
      author: p.authorName || '', views: p.views || 0, likes: (p.likes || []).length,
      createdAt: toMs(p.createdAt) ? new Date(toMs(p.createdAt)).toLocaleString('he-IL') : '',
    }))
    downloadCSV(`beyahad-content-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  // ===== שער הרשאה =====
  if (!isAdmin) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40, gap: 14, minHeight: '70vh' }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)' }}>אין לך הרשאה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: 280 }}>האזור הזה מיועד למנהלי המערכת בלבד.</div>
        <button onClick={onExit} className="big-btn" style={{ marginTop: 10, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line-strong)' }}>חזרה לאפליקציה</button>
      </div>
    )
  }

  // ===== סטטיסטיקות =====
  const now = Date.now()
  const byRole = { admin: 0, premium: 0, user: 0 }
  let blocked = 0, online = 0
  for (const u of users) {
    byRole[roleOf(u)] = (byRole[roleOf(u)] || 0) + 1
    if (u.blocked) blocked++
    const ms = toMs(u.lastSeenAt)
    if (ms && now - ms < 2 * 60 * 1000) online++
  }
  const tips = posts.filter(p => p.kind === 'tip').length
  const recipes = posts.filter(p => p.kind === 'recipe').length
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0)
  const totalLikes = posts.reduce((s, p) => s + ((p.likes || []).length), 0)

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onExit} aria-label="יציאה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">🛠️ בקרת ניהול</div>
      </div>

      <div style={{ padding: '8px 16px 28px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>טוען נתונים...</div>
        ) : (
          <>
            {/* כרטיסי סטטיסטיקה */}
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', margin: '4px 2px 12px' }}>תמונת מצב</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
              <StatCard label="משתמשים" value={users.length} accent={ACCENT} />
              <StatCard label="מחוברים" value={online} accent="#3E6B34" />
              <StatCard label="פרימיום" value={byRole.premium} accent={ROLE_COLOR.premium} />
              <StatCard label="חסומים" value={blocked} accent="#C0392B" />
              <StatCard label="עצות" value={tips} accent={ACCENT} />
              <StatCard label="מתכונים" value={recipes} accent={ACCENT} />
              <StatCard label="צפיות" value={totalViews} accent={ACCENT} />
              <StatCard label="לייקים" value={totalLikes} accent={ACCENT} />
            </div>

            {/* ניהול משתמשים */}
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', margin: '4px 2px 10px' }}>ניהול משתמשים ({users.length})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '9px 13px', marginBottom: 12 }}>
              <span style={{ fontSize: 17 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם..." style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 15, fontFamily: 'inherit', color: 'var(--ink)', direction: 'rtl' }} />
              {search && <button onClick={() => setSearch('')} aria-label="נקה" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, padding: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => {
                const q = search.trim().toLowerCase()
                const rank = { admin: 0, premium: 1, user: 2 }
                const list = users
                  .filter(u => !q || (u.name || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
                  .sort((a, b) => (rank[roleOf(a)] - rank[roleOf(b)]) || (a.name || '').localeCompare(b.name || '', 'he'))
                if (list.length === 0) return <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-3)', fontSize: 14 }}>לא נמצאו משתמשים</div>
                return list.map(u => (
                  <UserRow key={u.id} u={u} busy={busyUid === u.id} onRole={changeRole} onBlock={toggleBlock} />
                ))
              })()}
            </div>

            {/* ייצוא נתונים */}
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', margin: '4px 2px 10px' }}>ייצוא נתונים</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={exportUsers} style={{ flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 12, padding: '12px 10px' }}>⬇️ משתמשים</button>
                <button onClick={exportPosts} style={{ flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 12, padding: '12px 10px' }}>⬇️ תוכן</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>הקובץ נפתח ב-Excel או Google Sheets. כל לחיצה מורידה את הנתונים העדכניים ביותר.</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// כרטיס סטטיסטיקה יחיד
function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
      padding: '14px 8px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  )
}

// שורת משתמש בטבלת הניהול
function UserRow({ u, busy, onRole, onBlock }) {
  const role = roleOf(u)
  const initial = (u.name || '?').trim().charAt(0) || '?'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', border: `1px solid ${u.blocked ? '#E0B4B0' : 'var(--line)'}`,
      borderRadius: 14, padding: '10px 12px', opacity: u.blocked ? 0.7 : 1,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17,
        background: ROLE_COLOR[role] + '22', color: ROLE_COLOR[role],
      }}>{initial}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name || 'ללא שם'}</span>
          {u.blocked && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 6, padding: '1px 6px', flexShrink: 0 }}>חסום</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{lastSeenLabel(u)}</div>
      </div>
      <select value={role} onChange={e => onRole(u.id, e.target.value)} disabled={busy} style={{
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: ROLE_COLOR[role],
        border: `1.5px solid ${ROLE_COLOR[role]}55`, borderRadius: 9, padding: '6px 8px',
        background: 'var(--surface)', cursor: 'pointer', flexShrink: 0,
      }}>
        <option value="user">רגיל</option>
        <option value="premium">פרימיום</option>
        <option value="admin">מנהל</option>
      </select>
      <button onClick={() => onBlock(u)} disabled={busy} style={{
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        border: 'none', borderRadius: 9, padding: '7px 10px',
        background: u.blocked ? '#3E6B34' : '#C0392B', color: '#fff', opacity: busy ? 0.5 : 1,
      }}>{u.blocked ? 'שחרר' : 'חסום'}</button>
    </div>
  )
}

// בונה מחרוזת CSV ממערך אובייקטים ומוריד כקובץ (עם BOM כדי שעברית תראה טוב ב-Excel).
function downloadCSV(filename, rows) {
  if (!rows.length) { alert('אין נתונים לייצוא עדיין'); return }
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))]
  const esc = v => {
    const s = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v))
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}
