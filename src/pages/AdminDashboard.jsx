// src/pages/AdminDashboard.jsx
// בורד ניהול — מוגן בשער הרשאה (רק role==='admin'). נגיש דרך ?admin בכתובת.
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
import { IconBackRTL } from '../icons/index.jsx'

const ACCENT = '#2F3A56'
const ROLE_COLOR = { admin: '#7E2C2E', premium: '#B89048', user: '#5E7CA6' }

function roleOf(u) { return u.role || 'user' }

// המרת Firestore Timestamp ל-ms (או 0)
function toMs(ts) {
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
}

// מחובר כעת = נראה לאחרונה בשתי הדקות האחרונות
function isOnline(u) {
  const ms = toMs(u.lastSeenAt)
  return !!ms && (Date.now() - ms) < 2 * 60 * 1000
}

// שם מלא (פרטי + משפחה). שם פרטי נשמר בשדה name, משפחה ב-lastName.
function fullName(u) {
  const n = [u.name, u.lastName].filter(Boolean).join(' ').trim()
  return n || 'ללא שם'
}

function fmtDateTime(ms) { return ms ? new Date(ms).toLocaleString('he-IL') : '—' }

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

// ── טווחי תאריכים ליומן הפעילות ──
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

// מחשב [fromMs, toMs] לפי מפתח הטווח (custom משתמש בתאריכי המשתמש)
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

export default function AdminDashboard({ onExit }) {
  const { profile, authUser } = useUserStore()
  const isAdmin = profile?.role === 'admin'

  const [users, setUsers] = useState([])
  const [posts, setPosts] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState(null)     // uid שעליו מתבצעת פעולה
  const [busyPost, setBusyPost] = useState(null)   // פוסט שמתבצעת עליו פעולת אישור/דחייה
  const [search, setSearch] = useState('')
  const [selectedUid, setSelectedUid] = useState(null)   // משתמש פתוח בחלון הפרטים

  // יומן פעילות + בורר טווח
  const [range, setRange] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [rangeData, setRangeData] = useState(null)   // { cafe, parliament } לטווח
  const [log, setLog] = useState([])                 // אירועי יומן הפעילות לטווח
  const [logLoading, setLogLoading] = useState(true)
  const [logModalOpen, setLogModalOpen] = useState(false)   // חלון יומן הפעילות המלא

  useEffect(() => {
    if (!isAdmin) return
    const unsub = watchAllUsers(list => { setUsers(list); setLoading(false) })
    const unsubP = watchPendingPosts(setPending)
    getAllCommunityPosts().then(setPosts).catch(() => {})
    return () => { unsub && unsub(); unsubP && unsubP() }
  }, [isAdmin])

  // טעינת נתוני הטווח (ספירות + יומן) בכל שינוי טווח/תאריך
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

  // שינוי תפקיד
  async function changeRole(uid, role) {
    setBusyUid(uid)
    try { await setUserRole(uid, role) } catch (e) { console.error('setUserRole:', e) }
    setBusyUid(null)
  }
  // חסימה / שחרור
  async function toggleBlock(u) {
    if (u.blocked ? false : !window.confirm(`לחסום את ${fullName(u)}? הוא/היא לא יוכל/ת להשתמש באפליקציה.`)) return
    setBusyUid(u.id)
    try { await setUserBlocked(u.id, !u.blocked) } catch (e) { console.error('setUserBlocked:', e) }
    setBusyUid(null)
  }

  // מחיקת משתמש (מסיר את מסמך המשתמש). אישור חזק.
  async function deleteUser(u) {
    if (!window.confirm(`למחוק את ${fullName(u)}?\nהפעולה מסירה את כל נתוני המשתמש ואינה ניתנת לביטול.`)) return
    setBusyUid(u.id)
    try {
      await adminDeleteUser(u.id)
      setSelectedUid(null)
    } catch (e) { console.error('deleteUser:', e); alert('מחיקה נכשלה') }
    setBusyUid(null)
  }

  // שליחת הודעה למשתמש כמנהל → נפתחת כצ'אט פרטי שהמשתמש יכול להגיב בו.
  // המשתמש מקבל התראת צ'אט בפעמון; התשובה שלו חוזרת לפעמון של המנהל.
  async function messageUser(uid, text) {
    await sendDirectMessage({
      fromUid: authUser?.uid,
      toUid: uid,
      text,
      senderName: profile?.name || 'מנהל',
    })
  }

  // אישור פוסט ממתין → פרסום + התראה לכותב
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
  // דחייה → התראה לכותב ואז מחיקה (עם אישור)
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

  // ייצוא משתמשים ל-CSV
  function exportUsers() {
    const rows = users.map(u => ({
      uid: u.id, name: fullName(u), phone: u.phone || '', email: u.email || '',
      role: roleOf(u), blocked: u.blocked ? 'כן' : 'לא', status: u.status || '',
      lastSeen: toMs(u.lastSeenAt) ? new Date(toMs(u.lastSeenAt)).toLocaleString('he-IL') : '',
    }))
    downloadCSV(`beyahad-users-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }
  // ייצוא תוכן ל-CSV
  function exportPosts() {
    const rows = posts.map(p => ({
      id: p.id, kind: p.kind, title: p.title || '', category: p.category || '',
      author: p.authorName || '', approved: p.approved === false ? 'ממתין' : 'מאושר',
      views: p.views || 0, likes: (p.likes || []).length,
      createdAt: toMs(p.createdAt) ? new Date(toMs(p.createdAt)).toLocaleString('he-IL') : '',
    }))
    downloadCSV(`beyahad-content-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }
  // ייצוא יומן הפעילות (הטווח הנוכחי) ל-CSV
  function exportLog() {
    const rows = log.map(e => ({
      time: toMs(e.ts) ? new Date(toMs(e.ts)).toLocaleString('he-IL') : '',
      name: e.name || '', type: ACTIVITY_LABEL[e.type] || e.type,
      detail: e.type === 'game' ? (GAME_LABEL[e.detail] || e.detail || '') : (e.detail || ''),
      uid: e.uid || '',
    }))
    downloadCSV(`beyahad-activity-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
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
  const pendingRecipes = pending.filter(p => p.kind === 'recipe').length
  const pendingTips = pending.filter(p => p.kind === 'tip').length

  // ספירות מתוך יומן הפעילות (לטווח הנבחר)
  const logCounts = log.reduce((a, e) => { a[e.type] = (a[e.type] || 0) + 1; return a }, {})

  // הגרסה החיה של המשתמש שפתוח בחלון הפרטים (מתעדכן בזמן אמת)
  const liveSelected = selectedUid ? (users.find(u => u.id === selectedUid) || null) : null

  // סינון רשימת המשתמשים
  const q = search.trim().toLowerCase()
  const rank = { admin: 0, premium: 1, user: 2 }
  const filteredUsers = users
    .filter(u => !q || fullName(u).toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
    .sort((a, b) => (rank[roleOf(a)] - rank[roleOf(b)]) || fullName(a).localeCompare(fullName(b), 'he'))

  const sectionTitle = { fontSize: 15, fontWeight: 800, color: 'var(--ink)', margin: '20px 2px 10px' }

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
            {/* ===== דורש טיפול — תור אישור תוכן ===== */}
            <div style={{ ...sectionTitle, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              דורש טיפול
              {pending.length > 0 && (
                <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 999, padding: '2px 9px' }}>{pending.length}</span>
              )}
            </div>
            {pending.length === 0 ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontWeight: 600 }}>
                אין תוכן שממתין לאישור 🎉
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 10 }}>
                  {pendingRecipes} מתכונים · {pendingTips} עצות ממתינים לאישור
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pending.map(p => (
                    <PendingRow key={p.id} p={p} busy={busyPost === p.id} onApprove={approvePost} onReject={rejectPost} />
                  ))}
                </div>
              </>
            )}

            {/* ===== פעילות (לפי טווח תאריכים) ===== */}
            <div style={sectionTitle}>פעילות</div>
            <RangePicker range={range} setRange={setRange} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <StatCard label="מחוברים עכשיו" value={online} accent="#3E6B34" />
              <StatCard label="קפה בסלון" value={rangeData ? rangeData.cafe : '…'} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="פרלמנט" value={rangeData ? rangeData.parliament : '…'} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="שירה בציבור" value={logCounts.singing || 0} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="משחקים" value={logCounts.game || 0} accent={ACCENT} sub={RANGE_LABEL[range]} />
              <StatCard label="כניסות" value={logCounts.login || 0} accent={ACCENT} sub={RANGE_LABEL[range]} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
              קפה ופרלמנט כוללים היסטוריה מלאה. שירה, משחקים וכניסות נאספים מרגע הפעלת היומן ואילך.
            </div>

            {/* ===== יומן פעילות — כפתור שפותח חלון ===== */}
            <div style={sectionTitle}>יומן פעילות</div>
            <button onClick={() => setLogModalOpen(true)} style={{
              width: '100%', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)',
              borderRadius: 12, padding: '14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              📋 פתח יומן פעילות{!logLoading && log.length > 0 ? ` (${log.length})` : ''}
            </button>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>רשימה כרונולוגית של כל הפעילות בטווח שנבחר. אפשר לסנן גם בתוך החלון.</div>

            {/* ===== תמונת מצב ===== */}
            <div style={sectionTitle}>תמונת מצב</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <StatCard label="משתמשים" value={users.length} accent={ACCENT} />
              <StatCard label="פרימיום" value={byRole.premium} accent={ROLE_COLOR.premium} />
              <StatCard label="חסומים" value={blocked} accent="#C0392B" />
              <StatCard label="מנהלים" value={byRole.admin} accent={ROLE_COLOR.admin} />
              <StatCard label="עצות" value={tips} accent={ACCENT} />
              <StatCard label="מתכונים" value={recipes} accent={ACCENT} />
              <StatCard label="צפיות" value={totalViews} accent={ACCENT} />
              <StatCard label="לייקים" value={totalLikes} accent={ACCENT} />
            </div>

            {/* ===== ניהול משתמשים ===== */}
            <div style={sectionTitle}>ניהול משתמשים ({users.length})</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, margin: '-6px 2px 10px' }}>הקש על משתמש לצפייה בכל הפרטים, שליחת הודעה או מחיקה</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '9px 13px', marginBottom: 12 }}>
              <span style={{ fontSize: 17 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם / טלפון / אימייל..." style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 15, fontFamily: 'inherit', color: 'var(--ink)', direction: 'rtl' }} />
              {search && <button onClick={() => setSearch('')} aria-label="נקה" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, padding: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-3)', fontSize: 14 }}>לא נמצאו משתמשים</div>
              ) : (
                filteredUsers.map(u => (
                  <UserRow key={u.id} u={u} busy={busyUid === u.id} onOpen={() => setSelectedUid(u.id)} onRole={changeRole} onBlock={toggleBlock} />
                ))
              )}
            </div>

            {/* ===== ייצוא נתונים ===== */}
            <div style={sectionTitle}>ייצוא נתונים</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={exportUsers} style={{ flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 12, padding: '12px 10px' }}>⬇️ משתמשים</button>
              <button onClick={exportPosts} style={{ flex: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 12, padding: '12px 10px' }}>⬇️ תוכן</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>הקובץ נפתח ב-Excel או Google Sheets. כל לחיצה מורידה את הנתונים העדכניים ביותר.</div>
          </>
        )}
      </div>

      {/* ===== חלון יומן פעילות מלא ===== */}
      {logModalOpen && (
        <ActivityLogModal
          range={range} setRange={setRange}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo} setCustomTo={setCustomTo}
          log={log} logLoading={logLoading}
          onExport={exportLog}
          onClose={() => setLogModalOpen(false)}
        />
      )}

      {/* ===== חלון פרטי משתמש ===== */}
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

// כרטיס סטטיסטיקה יחיד
function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
      padding: '14px 8px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginTop: 6 }}>{label}</div>
      {sub ? <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div> : null}
    </div>
  )
}

// שורה ביומן הפעילות — תג סוג + שם + פירוט + זמן
function ActivityLogRow({ e }) {
  const label = ACTIVITY_LABEL[e.type] || e.type
  const color = ACTIVITY_COLOR[e.type] || '#5E7CA6'
  const detail = e.type === 'game' ? (GAME_LABEL[e.detail] || e.detail || '') : (e.detail || '')
  const ms = toMs(e.ts)
  const when = ms ? new Date(ms).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px',
    }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: color, borderRadius: 7, padding: '3px 9px', flexShrink: 0, minWidth: 62, textAlign: 'center' }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name || '—'}</div>
        {detail ? <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{detail}</div> : null}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0, direction: 'ltr' }}>{when}</div>
    </div>
  )
}

// בורר טווח תאריכים — כפתורי טווח + בחירת תאריכים מותאמת (משמש בכמה מקומות)
function RangePicker({ range, setRange, customFrom, setCustomFrom, customTo, setCustomTo }) {
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {RANGES.map(r => (
          <button key={r.key} onClick={() => setRange(r.key)} style={{
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${range === r.key ? ACCENT : 'var(--line-strong)'}`,
            background: range === r.key ? ACCENT : 'var(--surface)',
            color: range === r.key ? '#fff' : 'var(--ink)',
            borderRadius: 999, padding: '7px 14px',
          }}>{r.label}</button>
        ))}
      </div>
      {range === 'custom' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            מתאריך
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={dateInputStyle} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
            עד תאריך
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={dateInputStyle} />
          </label>
        </div>
      )}
    </>
  )
}

// חלון יומן פעילות מלא (בבורד הראשי) — בורר טווח + רשימה + ייצוא.
// חולק את ה-state של הטווח עם קטע "פעילות" — שינוי טווח כאן מעדכן גם את הכרטיסים.
function ActivityLogModal({ range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, log, logLoading, onExport, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1002, background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>יומן פעילות</div>
          {!logLoading && log.length > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>({log.length})</span>}
          {!logLoading && log.length > 0 && (
            <button onClick={onExport} style={{ marginInlineStart: 'auto', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${ACCENT}`, color: ACCENT, background: 'var(--surface)', borderRadius: 9, padding: '6px 12px' }}>⬇️ ייצוא</button>
          )}
        </div>
        <RangePicker range={range} setRange={setRange} customFrom={customFrom} setCustomFrom={setCustomFrom} customTo={customTo} setCustomTo={setCustomTo} />
        {logLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-3)', fontSize: 14 }}>טוען...</div>
        ) : log.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontWeight: 600 }}>
            אין פעילות מתועדת בטווח הזה
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {log.map(e => <ActivityLogRow key={e.id} e={e} />)}
          </div>
        )}
        <button onClick={onClose} className="big-btn big-btn--ghost" style={{ width: '100%', marginTop: 16 }}>סגור</button>
      </div>
    </div>
  )
}

// יומן פעילות אישי בתוך חלון המשתמש — טווח עצמאי, מסונן ל-uid.
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontWeight: 600 }}>
          אין פעילות מתועדת בטווח הזה
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {log.map(e => <ActivityLogRow key={e.id} e={e} />)}
        </div>
      )}
    </div>
  )
}

// סימון נקודה ירוקה למחובר
function OnlineDot({ online, size = 11 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: online ? '#3E6B34' : '#C2C2C2',
      border: '2px solid var(--surface)', display: 'inline-block',
    }} />
  )
}

// שורת פוסט ממתין לאישור — עם כפתורי אשר / דחה
function PendingRow({ p, busy, onApprove, onReject }) {
  const kindLabel = p.kind === 'recipe' ? 'מתכון' : 'עצה'
  const kindColor = p.kind === 'recipe' ? '#7E2C2E' : '#B89048'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', border: '1px solid #E7D2A8', borderRadius: 14, padding: '10px 12px',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: kindColor, borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>{kindLabel}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'ללא כותרת'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>מאת {p.authorName || '—'}</div>
      </div>
      <button onClick={() => onApprove(p)} disabled={busy} style={{
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        border: 'none', borderRadius: 9, padding: '8px 12px', background: '#3E6B34', color: '#fff', opacity: busy ? 0.5 : 1,
      }}>✓ אשר</button>
      <button onClick={() => onReject(p)} disabled={busy} style={{
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        border: '1px solid #C0392B', borderRadius: 9, padding: '8px 12px', background: 'var(--surface)', color: '#C0392B', opacity: busy ? 0.5 : 1,
      }}>✕ דחה</button>
    </div>
  )
}

// שורת משתמש — אזור המידע נפתח לחלון פרטים; תפקיד/חסימה כפעולות מהירות
function UserRow({ u, busy, onOpen, onRole, onBlock }) {
  const role = roleOf(u)
  const online = isOnline(u)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', border: `1px solid ${u.blocked ? '#E0B4B0' : 'var(--line)'}`,
      borderRadius: 14, padding: '8px 10px', opacity: u.blocked ? 0.75 : 1,
    }}>
      <button onClick={onOpen} style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', padding: '4px 2px',
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar name={fullName(u)} size={40} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} />
          {online && (
            <span style={{
              position: 'absolute', bottom: -1, left: -1,
              width: 12, height: 12, borderRadius: '50%', background: '#3E6B34', border: '2px solid var(--surface)',
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName(u)}</span>
            {u.blocked && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 6, padding: '1px 6px', flexShrink: 0 }}>חסום</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'ltr', textAlign: 'right' }}>{u.email || 'ללא אימייל'}</div>
          <div style={{ fontSize: 11.5, color: online ? '#3E6B34' : 'var(--ink-3)', fontWeight: online ? 800 : 600 }}>{lastSeenLabel(u)}</div>
        </div>
      </button>
      <select value={role} onChange={e => onRole(u.id, e.target.value)} disabled={busy} style={{
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: ROLE_COLOR[role],
        border: `1.5px solid ${ROLE_COLOR[role]}55`, borderRadius: 9, padding: '6px 6px',
        background: 'var(--surface)', cursor: 'pointer', flexShrink: 0,
      }}>
        <option value="user">רגיל</option>
        <option value="premium">פרימיום</option>
        <option value="admin">מנהל</option>
      </select>
      <button onClick={() => onBlock(u)} disabled={busy} style={{
        fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        border: 'none', borderRadius: 9, padding: '7px 9px',
        background: u.blocked ? '#3E6B34' : '#C0392B', color: '#fff', opacity: busy ? 0.5 : 1,
      }}>{u.blocked ? 'שחרר' : 'חסום'}</button>
    </div>
  )
}

// חלון פרטי משתמש מלאים — מידע, שליחת הודעה, ניהול תפקיד/חסימה, מחיקה
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '0 auto 18px' }} />

        {/* כותרת — אווטאר + שם מלא + תגיות + מצב חיבור */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name={fullName(u)} size={56} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} />
            <span style={{
              position: 'absolute', bottom: 0, left: 0,
              width: 16, height: 16, borderRadius: '50%', background: online ? '#3E6B34' : '#C2C2C2', border: '3px solid var(--bg-app)',
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-display" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1.15 }}>{fullName(u)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', background: ROLE_COLOR[role], borderRadius: 999, padding: '2px 10px' }}>
                {role === 'admin' ? 'מנהל' : role === 'premium' ? 'פרימיום' : 'רגיל'}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: online ? '#3E6B34' : 'var(--ink-3)' }}>
                {online ? '● מחובר/ת עכשיו' : '○ לא מחובר/ת'}
              </span>
              {u.blocked && <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 999, padding: '2px 10px' }}>חסום</span>}
            </div>
          </div>
        </div>

        {/* פרטים */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '4px 14px', marginBottom: 16 }}>
          {rows.map(([label, value], i) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
              borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none',
            }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 700, width: 110, flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, wordBreak: 'break-all', textAlign: 'left', flex: 1, direction: 'ltr' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* שליחת הודעה כמנהל */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>שליחת הודעה למשתמש</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>נפתח כצ׳אט — המשתמש יקבל התראה ויוכל להגיב לך</div>
          <textarea
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder="כתוב הודעה למשתמש..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 14,
              color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line-strong)',
              borderRadius: 12, padding: '10px 12px', direction: 'rtl', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button onClick={sendMsg} disabled={msgSending || !msgText.trim()} style={{
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: msgText.trim() ? 'pointer' : 'default',
              border: 'none', borderRadius: 12, padding: '11px 18px', background: ACCENT, color: '#fff',
              opacity: (msgSending || !msgText.trim()) ? 0.5 : 1,
            }}>{msgSending ? 'שולח...' : '📤 שלח הודעה'}</button>
            {msgSent && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#3E6B34' }}>✓ נשלח — התשובה תגיע לפעמון שלך</span>}
          </div>
        </div>

        {/* פעולות ניהול */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <select value={role} onChange={e => onRole(u.id, e.target.value)} disabled={busy} style={{
            flex: 1, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: ROLE_COLOR[role],
            border: `1.5px solid ${ROLE_COLOR[role]}55`, borderRadius: 12, padding: '12px 10px', background: 'var(--surface)', cursor: 'pointer',
          }}>
            <option value="user">תפקיד: רגיל</option>
            <option value="premium">תפקיד: פרימיום</option>
            <option value="admin">תפקיד: מנהל</option>
          </select>
          <button onClick={() => onBlock(u)} disabled={busy} style={{
            flex: 1, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            border: 'none', borderRadius: 12, padding: '13px 10px',
            background: u.blocked ? '#3E6B34' : '#C0392B', color: '#fff', opacity: busy ? 0.5 : 1,
          }}>{u.blocked ? 'שחרר מחסימה' : 'חסום משתמש'}</button>
        </div>

        {/* מחיקת משתמש */}
        <button onClick={() => onDelete(u)} disabled={busy} style={{
          width: '100%', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          border: '1px solid #C0392B', borderRadius: 12, padding: '12px 10px',
          background: 'var(--surface)', color: '#C0392B', opacity: busy ? 0.5 : 1, marginBottom: 14,
        }}>🗑️ מחק משתמש</button>

        {/* יומן פעילות אישי של המשתמש */}
        <UserActivityLog uid={u.id} name={fullName(u)} />

        <button onClick={onClose} className="big-btn big-btn--ghost" style={{ width: '100%' }}>סגור</button>
      </div>
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
