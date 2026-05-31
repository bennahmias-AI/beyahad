// src/pages/FriendsPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך "חברים קרובים".
//
// מציג:
//   • בקשות חברות שממתינות לאישור שלי (אפשר לאשר / לדחות)
//   • רשימת החברים המאושרים — עם חיווי מי מחובר עכשיו
//   • כפתור להתקשר ישירות לחבר
//
// חברות דורשת אישור הדדי — מישהו שולח בקשה, השני מאשר.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchFriendships, acceptFriendRequest, removeFriendship,
  watchUser,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL, IconPhone } from '../icons/index.jsx'

export default function FriendsPage({ onBack, onCallFriend }) {
  const { authUser } = useUserStore()
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)

  // watch all my friendships
  useEffect(() => {
    if (!authUser?.uid) return
    const unsub = watchFriendships(authUser.uid, ({ friends, incoming, outgoing }) => {
      setFriends(friends)
      setIncoming(incoming)
      setOutgoing(outgoing)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [authUser?.uid])

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">חברים קרובים</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>
            טוען...
          </div>
        ) : (
          <>
            {/* ── Incoming requests ───────────────────────── */}
            {incoming.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <h2 className="h-display" style={{
                  fontSize: 19, margin: '0 0 10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  בקשות חברות
                  <span style={{
                    background: 'var(--mustard)', color: 'var(--ink)',
                    fontSize: 13, fontWeight: 800, borderRadius: 999,
                    padding: '2px 9px',
                  }}>{incoming.length}</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {incoming.map(req => (
                    <div key={req.docId} style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 16, padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <LiveAvatar uid={req.otherUid} name={req.otherName} size={48} />
                        <div style={{ flex: 1 }}>
                          <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>
                            {req.otherName}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
                            רוצה להוסיף אותך לחברים
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => acceptFriendRequest(req.docId)}
                          className="big-btn big-btn--primary"
                          style={{ flex: 2, padding: '11px' }}
                        >
                          אישור
                        </button>
                        <button
                          onClick={() => removeFriendship(req.docId)}
                          className="big-btn big-btn--ghost"
                          style={{ flex: 1, padding: '11px' }}
                        >
                          דחייה
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Friends list ────────────────────────────── */}
            <section>
              <h2 className="h-display" style={{ fontSize: 19, margin: '0 0 10px' }}>
                החברים שלי {friends.length > 0 && `(${friends.length})`}
              </h2>

              {friends.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '36px 20px',
                  color: 'var(--ink-2)',
                }}>
                  <div style={{ fontSize: 52, marginBottom: 12 }}>👥</div>
                  <div className="h-display" style={{ fontSize: 19, marginBottom: 6, color: 'var(--ink)' }}>
                    עדיין אין חברים
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.5 }}>
                    כשתדברו עם מישהו בקפה או בפרלמנט,
                    תוכלו להוסיף אותו כחבר קרוב
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {friends.map(f => (
                    <FriendRow
                      key={f.docId}
                      friend={f}
                      onCall={() => onCallFriend && onCallFriend(f)}
                      onRemove={() => removeFriendship(f.docId)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Outgoing (sent) requests ────────────────── */}
            {outgoing.length > 0 && (
              <section style={{ marginTop: 24 }}>
                <h2 className="h-display" style={{ fontSize: 19, margin: '0 0 10px' }}>
                  בקשות ששלחת
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {outgoing.map(req => (
                    <div key={req.docId} style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 14, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <LiveAvatar uid={req.otherUid} name={req.otherName} size={42} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                          {req.otherName}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
                          ממתין לאישור
                        </div>
                      </div>
                      <button
                        onClick={() => removeFriendship(req.docId)}
                        style={{
                          fontSize: 13, fontWeight: 700, color: 'var(--ink-3)',
                          fontFamily: 'inherit', padding: '6px 10px',
                        }}
                      >
                        ביטול
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// אווטאר חי לבקשות חברות — שולף תמונת פרופיל לפי uid.
// שם משפחה לא מוצג כאן — עדיין לא חברים מאושרים (פרטיות).
function LiveAvatar({ uid, name, size, online }) {
  const [photoURL, setPhotoURL] = useState(null)
  useEffect(() => {
    if (!uid) return
    const unsub = watchUser(uid, u => setPhotoURL(u?.photoURL || null))
    return () => unsub && unsub()
  }, [uid])
  return <Avatar name={name} size={size} photoURL={photoURL} online={online} />
}

// ── one friend row — watches that friend's live online status ──
function FriendRow({ friend, onCall, onRemove }) {
  const [online, setOnline] = useState(false)
  const [prof, setProf] = useState(null)  // פרופיל חי: { name, lastName, photoURL }

  useEffect(() => {
    if (!friend.otherUid) return
    const unsub = watchUser(friend.otherUid, u => {
      // consider "online" if status available/busy and seen in last 2 min
      const seen = u?.lastSeenAt
      const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
      const fresh = seenMs && (Date.now() - seenMs) < 2 * 60 * 1000
      setOnline(Boolean(fresh) && ['available', 'busy'].includes(u?.status))
      setProf({ name: u?.name || '', lastName: u?.lastName || '', photoURL: u?.photoURL || null })
    })
    return () => unsub && unsub()
  }, [friend.otherUid])

  // חבר מאושר — מציגים שם מלא (שם + שם משפחה) ותמונת פרופיל אם הגדיר
  const fullName = prof
    ? ([prof.name, prof.lastName].filter(Boolean).join(' ') || friend.otherName)
    : friend.otherName
  const photoURL = prof?.photoURL || null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 16, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Avatar name={fullName} size={50} online={online} photoURL={photoURL} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>
          {fullName}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: online ? 'var(--success)' : 'var(--ink-3)',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {online && <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#4ADE80',
          }}/>}
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button
        onClick={onCall}
        disabled={!online}
        aria-label="התקשר"
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: online ? 'var(--success)' : 'var(--line-strong)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: online ? 'pointer' : 'default',
        }}
      >
        <IconPhone size={22} color="white" />
      </button>
    </div>
  )
}
