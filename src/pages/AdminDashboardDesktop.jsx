// src/pages/AdminDashboardDesktop.jsx
// תצוגת מחשב לבקרת הניהול — פריסה רחבה (טבלת משתמשים, עמודות מרובות,
// יומן פעילות בצד). נבחרת אוטומטית במסכים רחבים ע"י AdminDashboardResponsive.
// המובייל (AdminDashboard.jsx) נשאר ללא שינוי.
//
// נקודה טכנית: כל האפליקציה עטופה ב-.app-shell עם max-width:430px ו-overflow:hidden,
// לכן השורש כאן הוא שכבת position:fixed שממלאת את כל המסך ופורצת מהמסגרת הצרה.
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchAllUsers, getAllCommunityPosts,
  setUserRole, setUserBlocked,
  watchPendingPosts, setPostApproval, deleteCommunityPost,
  getActivityInRange, getActivityLog, getActivityLogForUser,
  sendUserNotification, adminDeleteUser, sendDirectMessage,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'

const ACCENT = '#2F3A56'
const ROLE_COLOR = { admin: '#7E2C2E', premium: '#B89048', user: '#5E7CA6' }

function roleOf(u) { return u.role || 'user' }
function toMs(ts) { return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0 }
function isOnline(u) { const ms = toMs(u.lastSeenAt); return !!ms && (Date.now() - ms) < 2 * 60 * 1000 }
function fullName(u) { const n = [u.name, u.lastName].filter(Boolean).join(' ').trim(); return n || 'ללא שם' }
function fmtDateTime(ms) { return ms ? new Date(ms).toLocaleString('he-IL') : '—' }
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

const RANGES = [
  { key: 'today', label: 'היום' },
  { key: 'yesterday', label: 'אתמול' },
  { key: 'week', label: 'השבוע' },
  { key: 'month', label: 'החודש' },
  { key: 'year', label: 'השנה' },
  { key: 'custom', label: 'מותאם' },
]
const RANGE_LABEL = { today: 'היום', yesterday: 'אתמול', week: 'השבוע', month: 'החודש', year: 'השנה', custom: 'בטווח' }
const ACTIVITY_LABEL = { login: 'כניסה', cafe: 'קפה בסלון', parliament: 'פרלמנט', singing: 'שירה בציבור', game: 'משחק' }
const ACTIVITY_COLOR = { login: '#5E7CA6', cafe: '#2C5566', parliament: '#7E2C2E', singing: '#6B3A4F', game: '#4F6B4A' }
const GAME_LABEL = { connect4: '4 בשורה', checkers: 'דמקה', chess: 'שחמט', sheshbesh: 'שש-בש', rummikub: 'רמיקוב', arena: 'מלך הזירה', bingo: 'בינגו', millionaire: 'מי רוצה להיות מיליונר', memory: 'משחק הזיכרון' }

function rangeBounds(key, customFrom, customTo) {
  const now = new Date()
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
  let from = startOfToday, to = now
  if (key === 'yesterday') {
    const y = new Date(startOfToday); y.setDate(y.getDate() - 1)
    from = y; to = new Date(startOfToday.getTime() - 1)
  } else if (key === 'week') {
    const w = new Date(startOfToday); w.setDate(w.getDate() - w.getDay()); from = w; to = now
  } else if (key === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1); to = now
  } else if (key === 'year') {
    from = new Date(now.getFullYear(), 0, 1); to = now
  } else if (key === 'custom') {
    from = customFrom ? new Date(customFrom + 'T00:00:00') : startOfToday
    to = customTo ? new Date(customTo + 'T23:59:59') : now
  }
  return [from.getTime(), to.getTime()]
}

const dateInputStyle = {
  fontFamily: 'inherit', fontSize: 14, padding: '8px 10px', borderRadius: 10,
  border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)',
}

export default function AdminDashboardDesktop({ onExit }) {
  const { profile, authUser } = useUserStore()
  const isAdmin = profile?.role === 'admin'

  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState(null)
  const [busyPost, setBusyPost] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedUid, setSelectedUid] = useState(null)

  const [range, setRange] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rangeData, setRangeData] = useState(null)
  const [log, setLog] = useState([])
  const [logLoading, setLogLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    const unsub = watchAllUsers(list => { setUsers(list); setLoading(false) })
    const unsubP = watchPendingPosts(setPending)
    getAllCommunityPosts().then(setPosts).catch(() => {})
    return () => { unsub && unsub(); unsubP && unsubP() }
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    setLogLoading(true)
    const [fromMs, toMs] = rangeBounds(range, customFrom, customTo)
    Promise.all([getActivityInRange(fromMs, toMs), getActivityLog(fromMs, toMs)])
      .then(([rd, lg]) => { if (!alive) return; setRangeData(rd); setLog(lg); setLogLoading(false) })
      .catch(() => { if (alive) setLogLoading(false) })
    return () => { alive = false }
  }, [isAdmin, range, customFrom, customTo])

  async function changeRole(uid, role) {
    setBusyUid(uid)
    try { await setUserRole(uid, role) } catch (e) { console.error('setUserRole:', e) }
    setBusyUid(null)
  }
  async function toggleBlock(u) {
    if (u.blocked ? false : !window.confirm(`לחסום את ${fullName(u)}? הוא/היא לא יוכל/ת להשתמש באפליקציה.`)) return
    setBusyUid(u.id)
    try { await setUserBlocked(u.id, !u.blocked) } catch (e) { console.error('setUserBlocked:', e) }
    setBusyUid(null)
  }
  async function deleteUser(u) {
    if (!window.confirm(`למחוק את ${fullName(u)}?\nהפעולה מסירה את כל נתוני המשתמש ואינה ניתנת לביטול.`)) return
    setBusyUid(u.id)
    try { await adminDeleteUser(u.id); setSelectedUid(null) }
    catch (e) { console.error('deleteUser:', e); alert('מחיקה נכשלה') }
    setBusyUid(null)
  }
  async function messageUser(uid, text) {
    await sendDirectMessage({ fromUid: authUser?.uid, toUid: uid, text, senderName: profile?.name || 'מנהל' })
  }
  async function approvePost(p) {
    setBusyPost(p.id)
    try {
      await setPostApproval(p.id, true)
      if (p.authorUid && p.authorUid !== 'seed') {
        await sendUserNotification({
          toUid: p.authorUid, type: 'approved',
          title: p.kind === 'recipe' ? 'המתכון שלך אושר ✓' : 'העצה שלך אושרה ✓',
          body: `"${p.title || ''}" פורסם וכעת גלוי לכולם`,
        })
      }
    } catch (e) { console.error('approvePost:', e) }
    setBusyPost(null)
  }
  async function rejectPost(p) {
    if (!window.confirm(`לדחות ולמחוק את "${p.title || 'הפריט'}"? לא ניתן לבטל.`)) return
    setBusyPost(p.id)
    try {
      if (p.authorUid && p.authorUid !== 'seed') {
        await sendUserNotification({
          toUid: p.authorUid, type: 'rejected',
          title: p.kind === 'recipe' ? 'המתכון שלך לא אושר' : 'העצה שלך לא אושרה',
          body: `"${p.title || ''}" לא פורסם. אפשר לנסות שוב עם תוכן מעודכן.`,
        })
      }
      await deleteCommunityPost(p.id)
    } catch (e) { console.error('rejectPost:', e) }
    setBusyPost(null)
  }

  function exportUsers() {
    const rows = users.map(u => ({
      uid: u.id, name: fullName(u), phone: u.phone || '', email: u.email || '',
      role: roleOf(u), blocked: u.blocked ? 'כן' : 'לא', status: u.status || '',
      lastSeen: toMs(u.lastSeenAt) ? new Date(toMs(u.lastSeenAt)).toLocaleString('he-IL') : '',
    }))
    downloadCSV(`beyahad-users-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }
  function exportPosts() {
    const rows = posts.map(p => ({
      id: p.id, kind: p.kind, title: p.title || '', category: p.category || '',
      author: p.authorName || '', approved: p.approved === false ? 'ממתין' : 'מאושר',
      views: p.views || 0, likes: (p.likes || []).length,
      createdAt: toMs(p.createdAt) ? new Date(toMs(p.createdAt)).toLocaleString('he-IL') : '',
    }))
    downloadCSV(`beyahad-content-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }
  function exportLog() {
    const rows = log.map(e => ({
      time: toMs(e.ts) ? new Date(toMs(e.ts)).toLocaleString('he-IL') : '',
      name: e.name || '', type: ACTIVITY_LABEL[e.type] || e.type,
      detail: e.type === 'game' ? (GAME_LABEL[e.detail] || e.detail || '') : (e.detail || ''),
      uid: e.uid || '',
    }))
    downloadCSV(`beyahad-activity-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  // שכבת מסך מלא — פורצת מ-.app-shell הצר
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto',
    background: 'var(--bg-page)', direction: 'rtl',
  }

  if (!isAdmin) {
    return (
      <div style={{ ...overlay, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)' }}>אין לך הרשאה</div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', maxWidth: 320 }}>האזור הזה מיועד למנהלי המערכת בלבד.</div>
        <button onClick={onExit} style={ghostBtn}>חזרה לאפליקציה</button>
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
  const pendingRecipes = pending.filter(p => p.kind === 'recipe').length
  const pendingTips = pending.filter(p => p.kind === 'tip').length
  const logCounts = log.reduce((a, e) => { a[e.type] = (a[e.type] || 0) + 1; return a }, {})

  const liveSelected = selectedUid ? (users.find(u => u.id === selectedUid) || null) : null

  const q = search.trim().toLowerCase()
  const rank = { admin: 0, premium: 1, user: 2 }
  const filteredUsers = users
    .filter(u => !q || fullName(u).toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
    .sort((a, b) => (rank[roleOf(a)] - rank[roleOf(b)]) || fullName(a).localeCompare(fullName(b), 'he'))

  return (
    <div style={overlay}>
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '26px 36px 70px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>🛠️</span>
            <span className="h-display" style={{ fontSize: 28, color: 'var(--ink)' }}>בקרת ניהול</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-2)', borderRadius: 999, padding: '4px 12px' }}>תצוגת מחשב</span>
          </div>
          <button onClick={onExit} style={ghostBtn}>← חזרה לאפליקציה</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-3)', fontSize: 17 }}>טוען נתונים...</div>
        ) : (
          <>
            {/* ===== תמונת מצב — שורת כרטיסים רחבה ===== */}
            <SectionTitle>תמונת מצב</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12 }}>
              <StatCard label="משתמשים" value={users.length} accent={ACCENT} />
              <StatCard label="מחוברים עכשיו" value={online} accent="#3E6B34" />
              <StatCard label="פרימיום" value={byRole.premium} accent={ROLE_COLOR.premium} />
              <StatCard label="מנהלים" value={byRole.admin} accent={ROLE_COLOR.admin} />
              <StatCard label="חסומים" value={blocked} accent="#C0392B" />
              <StatCard label="עצות" value={tips} accent={ACCENT} />
              <StatCard label="מתכונים" value={recipes} accent={ACCENT} />
              <StatCard label="לייקים" value={totalLikes} accent={ACCENT} />
            </div>

            {/* ===== פעילות לפי טווח ===== */}
            <SectionTitle>פעילות</SectionTitle>
            <RangePicker range={range} setRange={setRange} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
              <StatCard label="קפה בסלון" value={rangeData ? rangeData.cafe : '…'} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="פרלמנט" value={rangeData ? rangeData.parliament : '…'} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="שירה בציבור" value={logCounts.singing || 0} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="משחקים" value={logCounts.game || 0} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="כניסות" value={logCounts.login || 0} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="סה״כ אירועים" value={log.length} accent={ACCENT} sub={RANGE_LABEL[range]} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
              קפה ופרלמנט כוללים היסטוריה מלאה. שירה, משחקים וכניסות נאספים מרגע הפעלת היומן ואילך.
            </div>

            {/* ===== אזור ראשי בשתי עמודות ===== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28, marginTop: 26, alignItems: 'start' }}>
              {/* עמודה ימין (רחבה) — ניהול משתמשים כטבלה */}
              <div>
                <SectionTitle>ניהול משתמשים ({users.length})</SectionTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '9px 13px', marginBottom: 14, maxWidth: 420 }}>
                  <span style={{ fontSize: 16 }}>🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם / טלפון / אימייל..." style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', direction: 'rtl' }} />
                  {search && <button onClick={() => setSearch('')} aria-label="נקה" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 17 }}>✕</button>}
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)' }}>
                        <Th>משתמש</Th>
                        <Th>אימייל</Th>
                        <Th>טלפון</Th>
                        <Th>תפקיד</Th>
                        <Th>נראה לאחרונה</Th>
                        <Th>פעולות</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-3)' }}>לא נמצאו משתמשים</td></tr>
                      ) : (
                        filteredUsers.map(u => (
                          <UserTableRow key={u.id} u={u} busy={busyUid === u.id} onOpen={() => setSelectedUid(u.id)} onRole={changeRole} onBlock={toggleBlock} />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ייצוא */}
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button onClick={exportUsers} style={exportBtn}>⬇️ ייצוא משתמשים</button>
                  <button onClick={exportPosts} style={exportBtn}>⬇️ ייצוא תוכן</button>
                  <button onClick={exportLog} style={exportBtn}>⬇️ ייצוא יומן ({RANGE_LABEL[range]})</button>
                </div>
              </div>

              {/* עמודה שמאל — דורש טיפול + יומן פעילות */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                {/* דורש טיפול */}
                <div>
                  <SectionTitle>
                    דורש טיפול
                    {pending.length > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 999, padding: '2px 9px', marginInlineStart: 8 }}>{pending.length}</span>}
                  </SectionTitle>
                  {pending.length === 0 ? (
                    <div style={emptyBox}>אין תוכן שממתין לאישור 🎉</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 10 }}>{pendingRecipes} מתכונים · {pendingTips} עצות ממתינים</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {pending.map(p => <PendingRow key={p.id} p={p} busy={busyPost === p.id} onApprove={approvePost} onReject={rejectPost} />)}
                      </div>
                    </>
                  )}
                </div>

                {/* יומן פעילות — פאנל גלילה */}
                <div>
                  <SectionTitle>
                    יומן פעילות
                    {!logLoading && log.length > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginInlineStart: 8 }}>({log.length})</span>}
                  </SectionTitle>
                  {logLoading ? (
                    <div style={emptyBox}>טוען...</div>
                  ) : log.length === 0 ? (
                    <div style={emptyBox}>אין פעילות מתועדת בטווח הזה</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto', paddingInlineEnd: 4 }}>
                      {log.map(e => <ActivityLogRow key={e.id} e={e} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {liveSelected && (
        <UserDetailModal
          u={liveSelected}
          busy={busyUid === liveSelected.id}
          onRole={changeRole}
          onBlock={toggleBlock}
          onMessage={messageUser}
          onDelete={deleteUser}
          onClose={() => setSelectedUid(null)}
        />
      )}
    </div>
  )
}

// ===== רכיבים משותפים לתצוגת המחשב =====

const ghostBtn = {
  fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  border: '1px solid var(--line-strong)', color: 'var(--ink)', background: 'var(--surface)',
  borderRadius: 12, padding: '10px 18px',
}
const exportBtn = {
  flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 12, padding: '11px 10px',
}
const emptyBox = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14,
  padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontWeight: 600,
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', margin: '26px 2px 12px', display: 'flex', alignItems: 'center' }}>{children}</div>
}

function Th({ children }) {
  return <th style={{ textAlign: 'right', padding: '11px 14px', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{children}</th>
}

function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 10px', textAlign: 'center', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontSize: 27, fontWeight: 900, color: accent || 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 700, marginTop: 7 }}>{label}</div>
      {sub ? <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div> : null}
    </div>
  )
}

function RangePicker({ range, setRange, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRange(r.key)} style={{
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${range === r.key ? ACCENT : 'var(--line-strong)'}`,
            background: range === r.key ? ACCENT : 'var(--surface)',
            color: range === r.key ? '#fff' : 'var(--ink)',
            borderRadius: 999, padding: '7px 16px',
          }}>{r.label}</button>
        ))}
      </div>
      {range === 'custom' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            מתאריך<input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={dateInputStyle} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            עד תאריך<input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={dateInputStyle} />
          </label>
        </div>
      )}
    </>
  )
}

function ActivityLogRow({ e }) {
  const label = ACTIVITY_LABEL[e.type] || e.type
  const color = ACTIVITY_COLOR[e.type] || '#5E7CA6'
  const detail = e.type === 'game' ? (GAME_LABEL[e.detail] || e.detail || '') : (e.detail || '')
  const ms = toMs(e.ts)
  const when = ms ? new Date(ms).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: color, borderRadius: 7, padding: '3px 9px', flexShrink: 0, minWidth: 62, textAlign: 'center' }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name || '—'}</div>
        {detail ? <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{detail}</div> : null}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0, direction: 'ltr' }}>{when}</div>
    </div>
  )
}

function PendingRow({ p, busy, onApprove, onReject }) {
  const kindLabel = p.kind === 'recipe' ? 'מתכון' : 'עצה'
  const kindColor = p.kind === 'recipe' ? '#7E2C2E' : '#B89048'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid #E7D2A8', borderRadius: 14, padding: '10px 12px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: kindColor, borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>{kindLabel}</span>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'ללא כותרת'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>מאת {p.authorName || '—'}</div>
      </div>
      <button onClick={() => onApprove(p)} disabled={busy} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, border: 'none', borderRadius: 9, padding: '8px 12px', background: '#3E6B34', color: '#fff', opacity: busy ? 0.5 : 1 }}>✓ אשר</button>
      <button onClick={() => onReject(p)} disabled={busy} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, border: '1px solid #C0392B', borderRadius: 9, padding: '8px 12px', background: 'var(--surface)', color: '#C0392B', opacity: busy ? 0.5 : 1 }}>✕ דחה</button>
    </div>
  )
}

function UserTableRow({ u, busy, onOpen, onRole, onBlock }) {
  const role = roleOf(u)
  const online = isOnline(u)
  const stop = e => e.stopPropagation()
  return (
    <tr onClick={onOpen} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer', background: u.blocked ? 'rgba(192,57,43,0.04)' : 'transparent' }}>
      <td style={{ padding: '9px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name={fullName(u)} size={36} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} />
            {online && <span style={{ position: 'absolute', bottom: -1, left: -1, width: 11, height: 11, borderRadius: '50%', background: '#3E6B34', border: '2px solid var(--surface)' }} />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)' }}>{fullName(u)}</span>
            {u.blocked && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 6, padding: '1px 6px' }}>חסום</span>}
          </div>
        </div>
      </td>
      <td style={{ padding: '9px 14px', color: 'var(--ink-2)', direction: 'ltr', textAlign: 'right', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email || '—'}</td>
      <td style={{ padding: '9px 14px', color: 'var(--ink-2)', direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap' }}>{u.phone || '—'}</td>
      <td style={{ padding: '9px 14px' }} onClick={stop}>
        <select value={role} onChange={e => onRole(u.id, e.target.value)} disabled={busy} style={{
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: ROLE_COLOR[role],
          border: `1.5px solid ${ROLE_COLOR[role]}55`, borderRadius: 9, padding: '6px 8px', background: 'var(--surface)', cursor: 'pointer',
        }}>
          <option value="user">רגיל</option>
          <option value="premium">פרימיום</option>
          <option value="admin">מנהל</option>
        </select>
      </td>
      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', fontSize: 12.5, color: online ? '#3E6B34' : 'var(--ink-3)', fontWeight: online ? 800 : 600 }}>{lastSeenLabel(u)}</td>
      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }} onClick={stop}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onOpen} style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 8, padding: '6px 10px' }}>פרטים</button>
          <button onClick={() => onBlock(u)} disabled={busy} style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 8, padding: '6px 10px', background: u.blocked ? '#3E6B34' : '#C0392B', color: '#fff', opacity: busy ? 0.5 : 1 }}>{u.blocked ? 'שחרר' : 'חסום'}</button>
        </div>
      </td>
    </tr>
  )
}

// חלון פרטי משתמש — ממורכז (לא מלמטה כמו במובייל)
function UserDetailModal({ u, busy, onRole, onBlock, onMessage, onDelete, onClose }) {
  const role = roleOf(u)
  const online = isOnline(u)
  const genderText = u.gender === 'male' ? 'גבר' : u.gender === 'female' ? 'אישה' : (u.gender || '—')
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)

  const rows = [
    ['טלפון', u.phone || '—'],
    ['אימייל', u.email || '—'],
    ['מגדר', genderText],
    ['סטטוס', u.status || '—'],
    ['נראה לאחרונה', lastSeenLabel(u)],
    ['עודכן לאחרונה', fmtDateTime(toMs(u.updatedAt))],
    ['התראות', u.notificationsEnabled ? 'מופעלות' : 'כבויות'],
    ['מזהה (uid)', u.id],
  ]

  async function sendMsg() {
    const text = msgText.trim()
    if (!text) return
    setMsgSending(true)
    try {
      await onMessage(u.id, text)
      setMsgText(''); setMsgSent(true)
      setTimeout(() => setMsgSent(false), 4000)
    } catch (e) { console.error('sendMsg:', e); alert('שליחה נכשלה') }
    setMsgSending(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(20,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-app)', borderRadius: 20, padding: '24px 26px', width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', direction: 'rtl', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name={fullName(u)} size={56} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} />
            <span style={{ position: 'absolute', bottom: 0, left: 0, width: 16, height: 16, borderRadius: '50%', background: online ? '#3E6B34' : '#C2C2C2', border: '3px solid var(--bg-app)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', lineHeight: 1.15 }}>{fullName(u)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', background: ROLE_COLOR[role], borderRadius: 999, padding: '2px 10px' }}>{role === 'admin' ? 'מנהל' : role === 'premium' ? 'פרימיום' : 'רגיל'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: online ? '#3E6B34' : 'var(--ink-3)' }}>{online ? '● מחובר/ת עכשיו' : '○ לא מחובר/ת'}</span>
              {u.blocked && <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 999, padding: '2px 10px' }}>חסום</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="סגור" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--ink-3)', flexShrink: 0 }}>✕</button>
        </div>

        {/* פרטים — שתי עמודות */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '4px 16px', marginBottom: 16 }}>
          {rows.map(([label, value], i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700, width: 120, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, wordBreak: 'break-all', textAlign: 'left', flex: 1, direction: 'ltr' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* שליחת הודעה */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>שליחת הודעה למשתמש</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>נפתח כצ׳אט — המשתמש יקבל התראה ויוכל להגיב לך</div>
          <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="כתוב הודעה למשתמש..." rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '10px 12px', direction: 'rtl', outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button onClick={sendMsg} disabled={msgSending || !msgText.trim()} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: msgText.trim() ? 'pointer' : 'default', border: 'none', borderRadius: 12, padding: '11px 18px', background: ACCENT, color: '#fff', opacity: (msgSending || !msgText.trim()) ? 0.5 : 1 }}>{msgSending ? 'שולח...' : '📤 שלח הודעה'}</button>
            {msgSent && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3E6B34' }}>✓ נשלח — התשובה תגיע לפעמון שלך</span>}
          </div>
        </div>

        {/* פעולות ניהול */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <select value={role} onChange={e => onRole(u.id, e.target.value)} disabled={busy} style={{ flex: 1, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: ROLE_COLOR[role], border: `1.5px solid ${ROLE_COLOR[role]}55`, borderRadius: 12, padding: '12px 10px', background: 'var(--surface)', cursor: 'pointer' }}>
            <option value="user">תפקיד: רגיל</option>
            <option value="premium">תפקיד: פרימיום</option>
            <option value="admin">תפקיד: מנהל</option>
          </select>
          <button onClick={() => onBlock(u)} disabled={busy} style={{ flex: 1, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 12, padding: '13px 10px', background: u.blocked ? '#3E6B34' : '#C0392B', color: '#fff', opacity: busy ? 0.5 : 1 }}>{u.blocked ? 'שחרר מחסימה' : 'חסום משתמש'}</button>
        </div>

        <button onClick={() => onDelete(u)} disabled={busy} style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: '1px solid #C0392B', borderRadius: 12, padding: '12px 10px', background: 'var(--surface)', color: '#C0392B', opacity: busy ? 0.5 : 1, marginBottom: 16 }}>🗑️ מחק משתמש</button>

        {/* יומן פעילות אישי */}
        <UserActivityLog uid={u.id} name={fullName(u)} />

        <button onClick={onClose} style={{ ...ghostBtn, width: '100%' }}>סגור</button>
      </div>
    </div>
  )
}

function UserActivityLog({ uid, name }) {
  const [range, setRange] = useState('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const [fromMs, toMs] = rangeBounds(range, customFrom, customTo)
    getActivityLogForUser(uid, fromMs, toMs)
      .then(lg => { if (alive) { setLog(lg); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [uid, range, customFrom, customTo])

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>יומן פעילות של {name}</div>
      <RangePicker range={range} setRange={setRange} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />
      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>טוען...</div>
      ) : log.length === 0 ? (
        <div style={emptyBox}>אין פעילות מתועדת בטווח הזה</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {log.map(e => <ActivityLogRow key={e.id} e={e} />)}
        </div>
      )}
    </div>
  )
}

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
