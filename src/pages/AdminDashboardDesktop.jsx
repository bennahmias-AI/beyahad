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
  adminSetUserPhone, adminSetUserEmail,
  watchReports, resolveReport, deleteReport, blockUser,
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
const ACTIVITY_LABEL = { login: 'כניסה', cafe: 'קפה בסלון', parliament: 'פרלמנט', singing: 'שירה בציבור', game: 'משחק', radio: 'רדיו', tv: 'טלוויזיה', greeting: 'ברכה', greeting_share: 'שיתוף ברכה', greeting_save: 'שמירת ברכה', greeting_open: 'פתיחת ברכה' }
const ACTIVITY_COLOR = { login: '#5E7CA6', cafe: '#2C5566', parliament: '#7E2C2E', singing: '#6B3A4F', game: '#4F6B4A', radio: '#6B3A4F', tv: '#2C5566', greeting: '#B8860B', greeting_share: '#4F6B4A', greeting_save: '#7E2C2E', greeting_open: '#B8860B' }
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
  const [reports, setReports] = useState([])   // דיווחי משתמשים

  // ── מיון רשימת המשתמשים ──
  // sortBy: עמודה פעילה. 'default' = ההתנהגות הקיימת (תפקיד אז שם).
  // sortDir: 'asc' = עולה, 'desc' = יורד.
  // לחיצה על כותרת עמודה מחליפה למיון לפיה; לחיצה מחדש על אותה עמודה — מהפכת כיוון.
  const [sortBy, setSortBy] = useState('default')
  const [sortDir, setSortDir] = useState('asc')
  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      // כיוון ברירת מחדל לכל עמודה — תאריך: מהחדש לישן; טקסט: א-ת
      setSortDir(key === 'lastSeen' ? 'desc' : 'asc')
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    const unsub = watchAllUsers(list => { setUsers(list); setLoading(false) })
    const unsubP = watchPendingPosts(setPending)
    const unsubR = watchReports(setReports)
    getAllCommunityPosts().then(setPosts).catch(() => {})
    return () => { unsub && unsub(); unsubP && unsubP(); unsubR && unsubR() }
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
  // מצמיד מספר טלפון לחשבון הקיים (דרך צד-שרת). מחזיר את התוצאה לרכיב.
  async function setPhone(uid, phone) {
    setBusyUid(uid)
    const r = await adminSetUserPhone(uid, phone)
    setBusyUid(null)
    return r
  }
  // מעדכן מייל לחשבון הקיים (דרך צד-שרת). מחזיר את התוצאה לרכיב.
  async function setEmail(uid, email) {
    setBusyUid(uid)
    const r = await adminSetUserEmail(uid, email)
    setBusyUid(null)
    return r
  }

  // ===== טיפול בדיווחים =====
  // מסמן דיווח כטופל (ללא מחיקה — נשאר לתיעוד).
  async function handleResolveReport(reportId) {
    await resolveReport(reportId)
  }
  // מוחק דיווח לגמרי.
  async function handleDeleteReport(reportId) {
    if (!window.confirm('למחוק את הדיווח? לא ניתן לבטל.')) return
    await deleteReport(reportId)
  }
  // חוסם גלובלית את המשתמש שדווח עליו (setUserBlocked), ומסמן את הדיווח כטופל.
  async function blockReportedUser(report) {
    if (report.targetType !== 'user') return
    if (!window.confirm(`לחסום את ${report.targetName || 'המשתמש'}? הוא/היא לא יוכל/ת להשתמש באפליקציה.`)) return
    try {
      await setUserBlocked(report.targetId, true)
      await resolveReport(report.id)
    } catch (e) { console.error('blockReportedUser:', e); alert('החסימה נכשלה') }
  }
  // מוחק תוכן שדווח עליו (עצה/מתכון), ומסמן את הדיווח כטופל.
  async function deleteReportedContent(report) {
    if (report.targetType !== 'tip' && report.targetType !== 'recipe') return
    const what = report.targetType === 'recipe' ? 'המתכון' : 'העצה'
    if (!window.confirm(`למחוק את ${what} "${report.targetName || ''}"? לא ניתן לבטל.`)) return
    try {
      await deleteCommunityPost(report.targetId)
      await resolveReport(report.id)
    } catch (e) { console.error('deleteReportedContent:', e); alert('המחיקה נכשלה') }
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

  const liveSelected = selectedUid ? (users.find(u => u.id === selectedUid) || null) : null

  // דיווחים פתוחים בלבד (שעוד לא טופלו)
  const openReports = reports.filter(r => r.status !== 'resolved')

  const q = search.trim().toLowerCase()
  const rank = { admin: 0, premium: 1, user: 2 }
  // משווה למיון: מחזיר -/0/+ לפי העמודה הנבחרת. במצב 'default' — תפקיד הישן (אדמין קודם, ואז שם).
  const compareUsers = (a, b) => {
    let cmp = 0
    if (sortBy === 'default') {
      cmp = (rank[roleOf(a)] - rank[roleOf(b)]) || fullName(a).localeCompare(fullName(b), 'he')
      return cmp
    }
    if (sortBy === 'name')     cmp = fullName(a).localeCompare(fullName(b), 'he')
    else if (sortBy === 'email')    cmp = (a.email || '').localeCompare(b.email || '', 'he')
    else if (sortBy === 'phone')    cmp = (a.phone || '').localeCompare(b.phone || '')
    else if (sortBy === 'role')     cmp = (rank[roleOf(a)] - rank[roleOf(b)]) || fullName(a).localeCompare(fullName(b), 'he')
    else if (sortBy === 'lastSeen') cmp = toMs(a.lastSeenAt) - toMs(b.lastSeenAt)
    return sortDir === 'asc' ? cmp : -cmp
  }
  const filteredUsers = users
    .filter(u => !q || fullName(u).toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q))
    .sort(compareUsers)

  return (
    <div style={overlay}>
      <div style={{ width: '100%', margin: '0 auto', padding: '26px 48px 70px' }}>
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

            {/* ===== הרשמות חדשות לפי יום ===== */}
            <SectionTitle>הרשמות חדשות <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginInlineStart: 8 }}>(7 ימים אחרונים)</span></SectionTitle>
            {(() => {
              // מחשבים הרשמות לפי יום — createdAt נשמר על יצירת משתמש. משתמשים ותיקים ללא createdAt לא נספרים.
              const days = []
              for (let i = 6; i >= 0; i--) {
                const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
                const labelOpts = i === 0 ? null : i === 1 ? null : null
                let label
                if (i === 0) label = 'היום'
                else if (i === 1) label = 'אתמול'
                else label = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
                days.push({ time: d.getTime(), label, count: 0, users: [] })
              }
              const earliest = days[0].time
              const tomorrow = days[6].time + 24 * 60 * 60 * 1000
              for (const u of users) {
                const ms = toMs(u.createdAt)
                if (!ms || ms < earliest || ms >= tomorrow) continue
                const d = new Date(ms); d.setHours(0, 0, 0, 0)
                const slot = days.find(x => x.time === d.getTime())
                if (slot) { slot.count++; slot.users.push(fullName(u)) }
              }
              const total7d = days.reduce((s, x) => s + x.count, 0)
              const maxCount = Math.max(1, ...days.map(x => x.count))
              const newToday = days[6].count
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                    <StatCard label="נרשמו היום" value={newToday} accent="#3E6B34" />
                    <StatCard label="נרשמו השבוע האחרון" value={total7d} accent="#3E6B34" />
                    <StatCard label="סך הכל משתמשים" value={users.length} accent={ACCENT} />
                    <StatCard label="ללא תאריך יצירה" value={users.filter(u => !toMs(u.createdAt)).length} accent="#999" sub="משתמשים ותיקים" />
                  </div>
                  {/* גרף — עמודה לכל יום. גובה העמודה יחסית ל-maxCount. ריקוף על העמודה מציג תוי עם השמות. */}
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '18px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
                      {days.map(day => {
                        const heightPct = (day.count / maxCount) * 100
                        return (
                          <div key={day.time} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={day.users.length ? day.users.join(', ') : 'אין הרשמות'}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: day.count > 0 ? '#3E6B34' : 'var(--ink-3)', minHeight: 18 }}>{day.count}</div>
                            <div style={{
                              width: '100%', minHeight: day.count > 0 ? 4 : 1,
                              height: `${heightPct}%`,
                              background: day.count > 0
                                ? 'linear-gradient(180deg, #4F8B44 0%, #3E6B34 100%)'
                                : 'var(--line)',
                              borderRadius: '6px 6px 0 0',
                            }} />
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center' }}>{day.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )
            })()}

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

            {/* ===== רדיו, טלוויזיה וברכות ===== */}
            <SectionTitle>רדיו, טלוויזיה וברכות <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)', marginInlineStart: 8 }}>({RANGE_LABEL[range]})</span></SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>
              {/* רדיו */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <StatCard label="📻 האזנות" value={mediaStats.radio.plays} accent="#6B3A4F" />
                  <StatCard label="מאזינים" value={mediaStats.radio.users.size} accent="#6B3A4F" />
                </div>
                <BreakdownList title="תחנות מובילות" entries={mediaStats.radio.byStation} empty="אין האזנות בטווח זה" />
                <BreakdownList title="מי האזין" entries={mediaStats.radio.byUser} empty="—" />
              </div>
              {/* טלוויזיה */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <StatCard label="📺 צפיות" value={mediaStats.tv.plays} accent="#2C5566" />
                  <StatCard label="צופים" value={mediaStats.tv.users.size} accent="#2C5566" />
                </div>
                <BreakdownList title="ערוצים מובילים" entries={mediaStats.tv.byChannel} empty="אין צפיות בטווח זה" />
                <BreakdownList title="מי צפה" entries={mediaStats.tv.byUser} empty="—" />
              </div>
              {/* ברכות */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <StatCard label="💌 נוצרו" value={mediaStats.greeting.created} accent="#B8860B" />
                  <StatCard label="יוצרים" value={mediaStats.greeting.users.size} accent="#B8860B" />
                  <StatCard label="שותפו" value={mediaStats.greeting.shares.length} accent="#4F6B4A" />
                  <StatCard label="נשמרו" value={mediaStats.greeting.saves.length} accent="#7E2C2E" />
                </div>
                <BreakdownList title="מי יצר הכי הרבה" entries={mediaStats.greeting.byUser} empty="אין ברכות בטווח זה" />
              </div>
            </div>
            {/* רשימות ברכות ששותפו/נשמרו — שתי עמודות */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginTop: 14, alignItems: 'start' }}>
              <GreetingList title="ברכות ששותפו" items={mediaStats.greeting.shares} />
              <GreetingList title="ברכות שנשמרו" items={mediaStats.greeting.saves} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
              הנתונים נאספים מרגע הוספת המעקב ואילך, ומשתנים לפי הטווח שנבחר. לסך הכל — בחרו "השנה" או טווח מותאם.
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
                        <SortableTh sortKey="name"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>משתמש</SortableTh>
                        <SortableTh sortKey="email"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>אימייל</SortableTh>
                        <SortableTh sortKey="phone"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>טלפון</SortableTh>
                        <SortableTh sortKey="role"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>תפקיד</SortableTh>
                        <SortableTh sortKey="lastSeen" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>נראה לאחרונה</SortableTh>
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
                {/* דיווחים ממשתמשים */}
                <div>
                  <SectionTitle>
                    דיווחים ממשתמשים
                    {openReports.length > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 999, padding: '2px 9px', marginInlineStart: 8 }}>{openReports.length}</span>}
                  </SectionTitle>
                  {openReports.length === 0 ? (
                    <div style={emptyBox}>אין דיווחים פתוחים 🎉</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {openReports.map(r => (
                        <ReportRow
                          key={r.id} r={r}
                          onBlockUser={blockReportedUser}
                          onDeleteContent={deleteReportedContent}
                          onResolve={handleResolveReport}
                          onDelete={handleDeleteReport}
                        />
                      ))}
                    </div>
                  )}
                </div>

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
          onSetPhone={setPhone}
          onSetEmail={setEmail}
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

// כותרת טבלה למיון — לחיצה מחליפה למיון לפי שדה זה; לחיצה נוספת מהפכת כיוון.
// העמודה הפעילה מודגשת בצבע ה-burgundy + חצ מלא; שאר העמודות — אינדיקטור אפור דו-כיווני רמז.
function SortableTh({ sortKey, sortBy, sortDir, onSort, children }) {
  const isActive = sortBy === sortKey
  const arrow = isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇵'
  return (
    <th
      onClick={() => onSort(sortKey)}
      title="לחץ למיון לפי עמודה זו"
      style={{
        textAlign: 'right', padding: '11px 14px', fontSize: 12.5, fontWeight: 800,
        color: isActive ? 'var(--burgundy)' : 'var(--ink-2)',
        whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
        background: isActive ? 'rgba(126,44,46,.07)' : 'transparent',
        transition: 'background .15s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(126,44,46,.04)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {children}
        <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.35 }}>{arrow}</span>
      </span>
    </th>
  )
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

// רשימת פילוח — זוגות תווית→ספירה (תחנה/ערוץ/משתמש), ממוין יורד.
function BreakdownList({ title, entries, empty = '—', max = 8 }) {
  const arr = Object.entries(entries || {}).sort((a, b) => b[1] - a[1]).slice(0, max)
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', margin: '0 2px 6px' }}>{title}</div>
      {arr.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, padding: '8px 2px' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {arr.map(([label, count]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, background: 'var(--surface-2)', borderRadius: 999, padding: '2px 10px', flexShrink: 0 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// רשימת ברכות — מציגה את טקסט הברכה (detail), מי ומתי. החדש בראש.
function GreetingList({ title, items, max = 14 }) {
  const arr = [...(items || [])].sort((a, b) => toMs(b.ts) - toMs(a.ts)).slice(0, max)
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', margin: '0 2px 6px' }}>{title}{(items && items.length) ? ` (${items.length})` : ''}</div>
      {arr.length === 0 ? (
        <div style={emptyBox}>אין עדיין</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto', paddingInlineEnd: 4 }}>
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

const REPORT_REASON_LABEL = {
  offensive: 'תוכן פוגעני', harassment: 'הטרדה', spam: 'ספאם', other: 'אחר',
}
const REPORT_TYPE_LABEL = { user: 'משתמש', tip: 'עצה', recipe: 'מתכון' }

// שורת דיווח בפאנל — מציגה מי דיווח, על מה/מי, הסיבה, וכפתורי טיפול.
function ReportRow({ r, onBlockUser, onDeleteContent, onResolve, onDelete }) {
  const ms = toMs(r.createdAt)
  const when = ms ? new Date(ms).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
  const isUser = r.targetType === 'user'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid #E0A8A8', borderRadius: 14, padding: '11px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', background: '#C0392B', borderRadius: 6, padding: '1px 7px' }}>{REPORT_REASON_LABEL[r.reason] || r.reason}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-2)', background: 'var(--surface-2)', borderRadius: 6, padding: '1px 7px' }}>{REPORT_TYPE_LABEL[r.targetType] || r.targetType}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{r.targetName || '—'}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: r.note ? 4 : 8 }}>
        דווח ע"י {r.reporterName || '—'} · <span style={{ direction: 'ltr', unicodeBidi: 'embed' }}>{when}</span>
      </div>
      {r.note && (
        <div style={{ fontSize: 13, color: 'var(--ink-2)', background: 'var(--surface-2)', borderRadius: 8, padding: '6px 10px', marginBottom: 8, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.note}</div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {isUser ? (
          <button onClick={() => onBlockUser(r)} style={reportBtn('#C0392B', true)}>🚫 חסום משתמש</button>
        ) : (
          <button onClick={() => onDeleteContent(r)} style={reportBtn('#C0392B', true)}>🗑️ מחק תוכן</button>
        )}
        <button onClick={() => onResolve(r.id)} style={reportBtn('#3E6B34', false)}>✓ טופל</button>
        <button onClick={() => onDelete(r.id)} style={reportBtn('var(--ink-3)', false)}>הסר</button>
      </div>
    </div>
  )
}

function reportBtn(color, filled) {
  return {
    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
    border: filled ? 'none' : `1px solid ${color}`, borderRadius: 9, padding: '7px 11px',
    background: filled ? color : 'var(--surface)', color: filled ? '#fff' : color,
  }
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
            <Avatar name={fullName(u)} size={36} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} seed={u.id} gender={u.gender} />
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
function UserDetailModal({ u, busy, onRole, onBlock, onMessage, onSetPhone, onSetEmail, onDelete, onClose }) {
  const role = roleOf(u)
  const online = isOnline(u)
  const genderText = u.gender === 'male' ? 'גבר' : u.gender === 'female' ? 'אישה' : (u.gender || '—')
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  const [phoneInput, setPhoneInput] = useState(u.phone || '')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState(null)
  const [emailInput, setEmailInput] = useState(u.email || '')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)

  async function savePhone() {
    const val = phoneInput.trim()
    if (!val) return
    setPhoneSaving(true); setPhoneMsg(null)
    const r = await onSetPhone(u.id, val)
    setPhoneSaving(false)
    if (r && r.ok) setPhoneMsg({ ok: true, text: `✓ המספר ${r.phone} שויך לחשבון. אפשר להיכנס איתו + קוד SMS.` })
    else if (r && r.reason === 'phone-taken') setPhoneMsg({ ok: false, text: 'המספר כבר משויך לחשבון אחר (אולי חשבון בדיקה). מחק אותו ב-Firebase Console ונסה שוב.' })
    else if (r && r.reason === 'not-admin') setPhoneMsg({ ok: false, text: 'אין הרשאת אדמין לפעולה הזו.' })
    else if (r && r.reason === 'bad-phone') setPhoneMsg({ ok: false, text: 'מספר לא תקין. הזן מספר ישראלי, למשל 0501234567.' })
    else setPhoneMsg({ ok: false, text: 'הפעולה נכשלה. ודא שהאתר פרוס (Vercel) ושיש חיבור.' })
  }

  async function saveEmail() {
    const val = emailInput.trim()
    if (!val) return
    setEmailSaving(true); setEmailMsg(null)
    const r = await onSetEmail(u.id, val)
    setEmailSaving(false)
    if (r && r.ok) setEmailMsg({ ok: true, text: `✓ המייל ${r.email} עודכן. אפשר להיכנס איתו + קוד במייל.` })
    else if (r && r.reason === 'email-taken') setEmailMsg({ ok: false, text: 'המייל כבר משויך לחשבון אחר. בחר מייל אחר.' })
    else if (r && r.reason === 'not-admin') setEmailMsg({ ok: false, text: 'אין הרשאת אדמין לפעולה הזו.' })
    else if (r && r.reason === 'bad-email') setEmailMsg({ ok: false, text: 'מייל לא תקין. הזן כתובת תקינה, למשל name@gmail.com.' })
    else setEmailMsg({ ok: false, text: 'הפעולה נכשלה. ודא שהאתר פרוס (Vercel) ושיש חיבור.' })
  }

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
            <Avatar name={fullName(u)} size={56} color={ROLE_COLOR[role]} photoURL={u.photoURL || null} seed={u.id} gender={u.gender} />
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

        {/* טלפון לכניסה — הצמדת מספר לחשבון הקיים (הגירה / כניסה ב-SMS) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>📱 מספר טלפון לכניסה</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>
            מצמיד את המספר לחשבון הקיים של המשתמש. אחרי השמירה הוא יוכל להיכנס עם המספר הזה וקוד SMS — לאותו חשבון, עם כל המידע וההרשאות.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="05X-XXXXXXX"
              inputMode="tel"
              style={{ flex: 1, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '11px 12px', direction: 'ltr', textAlign: 'right', outline: 'none' }}
            />
            <button onClick={savePhone} disabled={phoneSaving || !phoneInput.trim()} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: phoneInput.trim() ? 'pointer' : 'default', border: 'none', borderRadius: 12, padding: '11px 18px', background: ACCENT, color: '#fff', opacity: (phoneSaving || !phoneInput.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}>{phoneSaving ? 'שומר...' : 'שמור טלפון'}</button>
          </div>
          {phoneMsg && <div style={{ fontSize: 12.5, fontWeight: 700, color: phoneMsg.ok ? '#3E6B34' : '#C0392B', marginTop: 8, lineHeight: 1.5 }}>{phoneMsg.text}</div>}
        </div>

        {/* מייל לכניסה — עדכון מייל החשבון (כניסה בקוד-מייל) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>✉️ כתובת מייל לכניסה</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>
            מעדכן את המייל של המשתמש בחשבון. אחרי השמירה הוא יוכל להיכנס עם המייל הזה וקוד שנשלח אליו — לאותו חשבון.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="name@gmail.com"
              inputMode="email"
              style={{ flex: 1, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 12, padding: '11px 12px', direction: 'ltr', textAlign: 'left', outline: 'none' }}
            />
            <button onClick={saveEmail} disabled={emailSaving || !emailInput.trim()} style={{ fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: emailInput.trim() ? 'pointer' : 'default', border: 'none', borderRadius: 12, padding: '11px 18px', background: ACCENT, color: '#fff', opacity: (emailSaving || !emailInput.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}>{emailSaving ? 'שומר...' : 'שמור מייל'}</button>
          </div>
          {emailMsg && <div style={{ fontSize: 12.5, fontWeight: 700, color: emailMsg.ok ? '#3E6B34' : '#C0392B', marginTop: 8, lineHeight: 1.5 }}>{emailMsg.text}</div>}
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
