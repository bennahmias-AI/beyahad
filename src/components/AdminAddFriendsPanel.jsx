// src/components/AdminAddFriendsPanel.jsx
// ─────────────────────────────────────────────────────────────
// "הוספת חברים למשתמש" — נפתח מתוך כרטיס המשתמש בבורד הניהול.
//
// המנהל בוחר משתמש (מהכרטיס), ואז מסמן כאן משתמשים אחרים ולוחץ
// "הוסף כחברים". החברות נוצרת מאושרת מיידית — כלומר שני הצדדים
// רואים אחד את השני ברשימת החברים שלהם, בלי אישור נוסף.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { adminLinkFriends, adminGetFriendUids } from '../services/adminFriends.js'
import { watchAllUsers } from '../services/firebase.js'
import Avatar from './Avatar.jsx'

const ACCENT = '#2F3A56'

function fullName(u) {
  const n = [u.name, u.lastName].filter(Boolean).join(' ').trim()
  return n || 'ללא שם'
}

export default function AdminAddFriendsPanel({ user, allUsers: allUsersProp = [] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState([])
  const [existing, setExisting] = useState({ accepted: [], pending: [] })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)   // { added, already }
  // אם לא הועברה רשימת משתמשים מבחוץ — שולפים אותה לבד (רכיב עצמאי)
  const [ownUsers, setOwnUsers] = useState([])
  const allUsers = allUsersProp && allUsersProp.length ? allUsersProp : ownUsers

  useEffect(() => {
    if (!open) return
    if (allUsersProp && allUsersProp.length) return
    const unsub = watchAllUsers(setOwnUsers)
    return () => { unsub && unsub() }
  }, [open])

  // טוענים את החברים הקיימים כדי לא להציע אותם שוב
  const loadExisting = async () => {
    if (!user?.id) return
    setLoading(true)
    try { setExisting(await adminGetFriendUids(user.id)) }
    catch (e) { console.error('adminGetFriendUids:', e) }
    setLoading(false)
  }

  useEffect(() => { if (open) loadExisting() }, [open, user?.id])

  const acceptedSet = useMemo(() => new Set(existing.accepted), [existing.accepted])
  const pendingSet = useMemo(() => new Set(existing.pending), [existing.pending])

  const candidates = useMemo(() => {
    const q = search.trim()
    return allUsers
      .filter(u => u.id !== user?.id && !u.blocked)
      .filter(u => !acceptedSet.has(u.id))
      .filter(u => !q || fullName(u).includes(q) || (u.phone || '').includes(q))
  }, [allUsers, user?.id, acceptedSet, search])

  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  async function save() {
    if (!picked.length || saving) return
    setSaving(true)
    setDone(null)
    let added = 0, already = 0
    for (const id of picked) {
      const other = allUsers.find(u => u.id === id)
      if (!other) continue
      try {
        const res = await adminLinkFriends(
          { uid: user.id, name: user.name || fullName(user) },
          { uid: other.id, name: other.name || fullName(other) },
        )
        if (res.ok && res.already) already++
        else if (res.ok) added++
      } catch (e) { console.error('adminLinkFriends:', e) }
    }
    setPicked([])
    await loadExisting()
    setDone({ added, already })
    setSaving(false)
  }

  const box = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 15,
    border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px',
    background: 'var(--surface)', color: 'var(--ink)', direction: 'rtl',
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: '100%', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        border: `1px solid ${ACCENT}`, borderRadius: 12, padding: '12px 10px',
        background: 'var(--surface)', color: ACCENT, marginBottom: 12,
      }}>👥 הוספת חברים למשתמש</button>
    )
  }

  return (
    <div style={{
      border: '1px solid var(--line)', borderRadius: 14, padding: '12px 12px 14px',
      marginBottom: 12, background: 'var(--surface-2)', direction: 'rtl',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
          הוספת חברים ל{user?.name || 'משתמש'}
        </div>
        <button onClick={() => setOpen(false)} style={{
          background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--ink-3)', padding: 2,
        }}>✕</button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45, marginBottom: 10 }}>
        החברות תיווצר מאושרת — שני הצדדים יראו אחד את השני ברשימת החברים מיד.
        {existing.accepted.length > 0 && ` (כבר יש ${existing.accepted.length} חברים)`}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="חיפוש לפי שם או טלפון" style={{ ...box, marginBottom: 8 }} />

      {loading ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>טוען...</div>
      ) : (
        <div style={{ maxHeight: 230, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)' }}>
          {candidates.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>אין משתמשים להוספה</div>
          )}
          {candidates.map(u => {
            const on = picked.includes(u.id)
            const isPending = pendingSet.has(u.id)
            return (
              <button key={u.id} onClick={() => toggle(u.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'right',
                border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer',
                background: on ? 'var(--surface-2)' : 'transparent', padding: '9px 12px', fontFamily: 'inherit',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${on ? ACCENT : '#ccc'}`, background: on ? ACCENT : 'transparent',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800,
                }}>{on ? '✓' : ''}</span>
                <Avatar name={fullName(u)} size={32} photoURL={u.photoURL} />
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{fullName(u)}</span>
                {isPending && <span style={{ fontSize: 11, fontWeight: 700, color: '#B8860B' }}>בקשה ממתינה</span>}
              </button>
            )
          })}
        </div>
      )}

      <button onClick={save} disabled={!picked.length || saving} style={{
        width: '100%', marginTop: 10, fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
        cursor: picked.length ? 'pointer' : 'default', border: 'none', borderRadius: 12,
        padding: '13px 10px', background: ACCENT, color: '#fff', opacity: (picked.length && !saving) ? 1 : 0.5,
      }}>{saving ? 'מוסיף...' : `הוסף ${picked.length || ''} כחברים`}</button>

      {done && (
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#3E6B34', textAlign: 'center' }}>
          ✓ נוספו {done.added} חברים{done.already > 0 ? ` (${done.already} כבר היו חברים)` : ''}
        </div>
      )}
    </div>
  )
}
