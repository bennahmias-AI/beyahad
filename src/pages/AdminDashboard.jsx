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
import GameSuggestionsPanel from '../components/GameSuggestionsPanel.jsx'
import AdminBroadcastPanel from '../components/AdminBroadcastPanel.jsx'
import AdminAddFriendsPanel from '../components/AdminAddFriendsPanel.jsx'
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
const ACTIVITY_LABEL = { login: 'כניסה', cafe: 'קפה בסלון', parliament: 'פרלמנט', singing: 'שירה בציבור', game: 'משחק', radio: 'רדיו', tv: 'טלוויזיה', greeting: 'ברכה', greeting_share: 'שיתוף ברכה', greeting_save: 'שמירת ברכה', greeting_open: 'פתיחת ברכה' }
const ACTIVITY_COLOR = { login: '#5E7CA6', cafe: '#2C5566', parliament: '#7E2C2E', singing: '#6B3A4F', game: '#4F6B4A', radio: '#6B3A4F', tv: '#2C5566', greeting: '#B8860B', greeting_share: '#4F6B4A', greeting_save: '#7E2C2E', greeting_open: '#B8860B' }
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

  // ── מיון רשימת המשתמשים ──
  // sortBy: עמודה פעילה. 'default' = תפקיד אז שם (ההתנהגות הקיימת).
  // sortDir: 'asc'/'desc'. לחיצה על צ'יפ שכבר פעיל — מהפכת כיוון. תאריך: החדש קודם; טקסט: א-ת.
  const [sortBy, setSortBy] = useState('default')
  const [sortDir, setSortDir] = useState('asc')
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(key === 'lastSeen' ? 'desc' : 'asc')
    }
  }

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

  // אגרגציה לרדיו / טלוויזיה / ברכות (מתוך היומן, לטווח הנבחר)
  const mediaStats = (() => {
    const radio = { plays: 0, users: new Set(), byStation: {}, byUser: {} }
    const tv = { plays: 0, users: new Set(), byChannel: {}, byUser: {} }
    const greeting = { created: 0, users: new Set(), byUser: {}, shares: [], saves: [] }
    const bump = (obj, key) => { const k = key || '—'; obj[k] = (obj[k] || 0) + 1 }
    for (const e of log) {
      const who = e.name || e.uid || '—'
      if (e.type === 'radio') { radio.plays++; if (e.uid) radio.users.add(e.uid); bump(radio.byStation, e.detail); bump(radio.byUser, who) }
      else if (e.type === 'tv') { tv.plays++; if (e.uid) tv.users.add(e.uid); bump(tv.byChannel, e.detail); bump(tv.byUser, who) }
      else if (e.type === 'greeting') { greeting.created++; if (e.uid) greeting.users.add(e.uid); bump(greeting.byUser, who) }
      else if (e.type === 'greeting_share') { greeting.shares.push(e) }
      else if (e.type === 'greeting_save') { greeting.saves.push(e) }
    }
    return { radio, tv, greeting }
  })()

  // הגרסה החיה של המשתמש שפתוח בחלון הפרטים (מתעדכן בזמן אמת)
  const liveSelected = selectedUid ? (users.find(u => u.id === selectedUid) || null) : null

  // סינון רשימת המשתמשים
  const q = search.trim().toLowerCase()
  const rank = { admin: 0, premium: 1, user: 2 }
  // משווה למיון — זהה ל-AdminDashboardDesktop.
  const compareUsers = (a, b) => {
    let cmp = 0
    if (sortBy === 'default') {
      cmp = (rank[roleOf(a)] - rank[roleOf(b)]) || fullName(a).localeCompare(fullName(b), 'he')
      return cmp
    }
    if (sortBy === 'name')          cmp = fullName(a).localeCompare(fullName(b), 'he')
    else if (sortBy === 'email')    cmp = (a.email || '').localeCompare(b.email || '', 'he')
    else if (sortBy === 'phone')    cmp = (a.phone || '').localeCompare(b.phone || '')
    else if (sortBy === 'lastSeen') cmp = toMs(a.lastSeenAt) - toMs(b.lastSeenAt)
    return sortDir === 'asc' ? cmp : -cmp
  }
  const filteredUsers = users
    .filter(u => !q || fullName(u).toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
    .sort(compareUsers)

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

            {/* ===== שליחת התראה למשתמשים ===== */}
            <AdminBroadcastPanel />

            {/* ===== הצעות משחק ===== */}
            <GameSuggestionsPanel />

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

            {/* ===== רדיו ===== */}
            <div style={sectionTitle}>📻 רדיו</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <StatCard label="האזנות" value={mediaStats.radio.plays} accent="#6B3A4F" sub={RANGE_LABEL[range]} />
              <StatCard label="מאזינים" value={mediaStats.radio.users.size} accent="#6B3A4F" sub={RANGE_LABEL[range]} />
            </div>
            <BreakdownList title="תחנות מובילות" entries={mediaStats.radio.byStation} empty="אין האזנות בטווח זה" />
            <BreakdownList title="מי האזין" entries={mediaStats.radio.byUser} empty="—" />

            {/* ===== טלוויזיה ===== */}
            <div style={sectionTitle}>📺 טלוויזיה</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <StatCard label="צפיות" value={mediaStats.tv.plays} accent="#2C5566" sub={RANGE_LABEL[range]} />
              <StatCard label="צופים" value={mediaStats.tv.users.size} accent="#2C5566" sub={RANGE_LABEL[range]} />
            </div>
            <BreakdownList title="ערוצים מובילים" entries={mediaStats.tv.byChannel} empty="אין צפיות בטווח זה" />
            <BreakdownList title="מי צפה" entries={mediaStats.tv.byUser} empty="—" />

            {/* ===== ברכות ===== */}
            <div style={sectionTitle}>💌 ברכות</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <StatCard label="נוצרו" value={mediaStats.greeting.created} accent="#B8860B" sub={RANGE_LABEL[range]} />
              <StatCard label="יוצרים" value={mediaStats.greeting.users.size} accent="#B8860B" sub={RANGE_LABEL[range]} />
              <StatCard label="שותפו" value={mediaStats.greeting.shares.length} accent="#4F6B4A" sub={RANGE_LABEL[range]} />
              <StatCard label="נשמרו" value={mediaStats.greeting.saves.length} accent="#7E2C2E" sub={RANGE_LABEL[range]} />
            </div>
            <BreakdownList title="מי יצר הכי הרבה" entries={mediaStats.greeting.byUser} empty="אין ברכות בטווח זה" />
            <GreetingList title="ברכות ששותפו" items={mediaStats.greeting.shares} />
            <GreetingList title="ברכות שנשמרו" items={mediaStats.greeting.saves} />
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
              הנתונים כאן נאספים מרגע הוספת המעקב ואילך, ומשתנים לפי הטווח שנבחר למעלה ({RANGE_LABEL[range]}). לסך הכל — בחרו טווח "השנה" או טווח מותאם.
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

            {/* ===== הרשמות חדשות לפי יום ===== */}
            <div style={sectionTitle}>הרשמות חדשות <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', marginInlineStart: 6 }}>(7 ימים אחרונים)</span></div>
            {(() => {
              // מחשבים הרשמות לפי יום — createdAt נשמר על יצירת משתמש. משתמשים ותיקים ללא createdAt לא נספרים.
              const days = []
              for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
                let label
                if (i === 0) label = 'היום'
                else if (i === 1) label = 'אתמול'
                else label = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
                days.push({ time: d.getTime(), label, count: 0 })
              }
              const earliest = days[0].time
              const tomorrow = days[6].time + 24 * 60 * 60 * 1000
              for (const u of users) {
                const ms = toMs(u.createdAt)
                if (!ms || ms < earliest || ms >= tomorrow) continue
                const d = new Date(ms); d.setHours(0, 0, 0, 0)
                const slot = days.find(x => x.time === d.getTime())
                if (slot) slot.count++
              }
              const total7d = days.reduce((s, x) => s + x.count, 0)
              const maxCount = Math.max(1, ...days.map(x => x.count))
              const newToday = days[6].count
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
                    <StatCard label="נרשמו היום" value={newToday} accent="#3E6B34" />
                    <StatCard label="נרשמו השבוע האחרון" value={total7d} accent="#3E6B34" />
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
                      {days.map(day => {
                        const heightPct = (day.count / maxCount) * 100
                        return (
                          <div key={day.time} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: day.count > 0 ? '#3E6B34' : 'var(--ink-3)', minHeight: 16 }}>{day.count}</div>
                            <div style={{
                              width: '100%', minHeight: day.count > 0 ? 4 : 1,
                              height: `${heightPct}%`,
                              background: day.count > 0 ? 'linear-gradient(180deg, #4F8B44 0%, #3E6B34 100%)' : 'var(--line)',
                              borderRadius: '5px 5px 0 0',
                            }} />
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.2 }}>{day.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )
            })()}

            {/* ===== ניהול משתמשים ===== */}
            <div style={sectionTitle}>ניהול משתמשים ({users.length})</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, margin: '-6px 2px 10px' }}>הקש על משתמש לצפייה בכל הפרטים, שליחת הודעה או מחיקה</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '9px 13px', marginBottom: 12 }}>
              <span style={{ fontSize: 17 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="חיפוש לפי שם / טלפון / אימייל..." style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 15, fontFamily: 'inherit', color: 'var(--ink)', direction: 'rtl' }} />
              {search && <button onClick={() => setSearch('')} aria-label="נקה" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, padding: 0 }}>✕</button>}
            </div>

            {/* שורת מיון — לחיצה על צ'יפ הופכת את המיון לעמודה זו; לחיצה נוספת מהפכת כיוון (א-ת / ת-א, או חדש-לישן / לישן-לחדש לתאריך). */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {[
                { key: 'default',  label: 'ברירת מחדל' },
                { key: 'name',     label: 'שם' },
                { key: 'lastSeen', label: 'נראה לאחרונה' },
                { key: 'email',    label: 'אימייל' },
                { key: 'phone',    label: 'טלפון' },
              ].map(opt => {
                const isActive = sortBy === opt.key
                const arrow = (isActive && opt.key !== 'default') ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
                return (
                  <button key={opt.key} onClick={() => handleSort(opt.key)} style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 999,
                    border: isActive ? 'none' : '1px solid var(--line)',
                    background: isActive ? 'var(--burgundy)' : 'var(--surface)',
                    color: isActive ? '#fff' : 'var(--ink-2)',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                    {opt.label}{arrow}
                  </button>
                )
              })}
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

// רשימת פילוח — זוגות תווית→ספירה (תחנה/ערוץ/משתמש), ממוין יורד.
function BreakdownList({ title, entries, empty = '—', max = 8 }) {
  const arr = Object.entries(entries || {}).sort((a, b) => b[1] - a[1]).slice(0, max)
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', margin: '0 2px 6px' }}>{title}</div>
      {arr.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, padding: '8px 2px' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {arr.map(([label, count]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, background: 'var(--bg-page)', borderRadius: 999, padding: '2px 10px', flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// רשימת ברכות — מציגה את טקסט הברכה (detail), מי ומתי. החדש בראש.
function GreetingList({ title, items, max = 12 }) {
  const arr = [...(items || [])].sort((a, b) => toMs(b.ts) - toMs(a.ts)).slice(0, max)
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', margin: '0 2px 6px' }}>{title}{(items && items.length) ? ` (${items.length})` : ''}</div>
      {arr.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, padding: '8px 2px' }}>אין עדיין</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {arr.map(e => {
            const ms = toMs(e.ts)
            const when = ms ? new Date(ms).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
            return (
              <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detail || '(ללא טקסט)'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>{e.name || '—'}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600, direction: 'ltr' }}>{when}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
          <Avatar name={fullName(u)} size={40} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} seed={u.id} gender={u.gender} />
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
            <Avatar name={fullName(u)} size={56} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} seed={u.id} gender={u.gender} />
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

        {/* הוספת חברים למשתמש */}
        <AdminAddFriendsPanel user={u} />

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
