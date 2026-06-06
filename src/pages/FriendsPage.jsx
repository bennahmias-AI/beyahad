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
  watchUser, sendFriendRequest, getSuggestedFriends, getAllUsers,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'

// נרמול מספר טלפון ישראלי להשוואה — מסיר קידומת/אפס מוביל, משאיר עד 9 ספרות.
function normILPhone(raw) {
  if (!raw) return ''
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('972')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)
  return d.length >= 8 ? d.slice(-9) : ''
}

export default function FriendsPage({ onBack, onHome, onMessageFriend, onOpenFriendProfile }) {
  const { authUser, profile } = useUserStore()
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [sentReqs, setSentReqs] = useState({})
  const [contactsBusy, setContactsBusy] = useState(false)
  const [contactMatches, setContactMatches] = useState(null)
  const [contactsNotOnApp, setContactsNotOnApp] = useState(0)
  const [contactsMsg, setContactsMsg] = useState('')

  // הזמנת חברים ומשפחה — שיתוף קישור להתקנת/כניסה לאפליקציה
  const [copied, setCopied] = useState(false)
  const inviteUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteText = `בואו להצטרף אליי באפליקציית ביחד! ${inviteUrl}`
  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank')
  }
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

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

  // טוען הצעות חברות (חברים של חברים) — פעם אחת בעליית המסך
  useEffect(() => {
    if (!authUser?.uid) return
    getSuggestedFriends(authUser.uid).then(setSuggestions).catch(() => {})
  }, [authUser?.uid])

  async function handleAddSuggested(s) {
    setSentReqs(r => ({ ...r, [s.uid]: true }))
    try {
      const myName = [profile?.name, profile?.lastName].filter(Boolean).join(' ') || profile?.name || 'משתמש'
      await sendFriendRequest({ uid: authUser.uid, name: myName }, { uid: s.uid, name: s.name })
    } catch (e) { console.error('add suggested error:', e) }
  }

  // מציאת חברים מתוך אנשי הקשר (Contact Picker API — נתמך באנדרואיד/Chrome בלבד).
  async function findFromContacts() {
    setContactsMsg(''); setContactMatches(null)
    const supported = typeof navigator !== 'undefined' && navigator.contacts && typeof navigator.contacts.select === 'function'
    if (!supported) { setContactsMsg('unsupported'); return }
    setContactsBusy(true)
    try {
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: true })
      if (picked && picked.length) {
        const wanted = new Set()
        picked.forEach(c => (c.tel || []).forEach(t => { const n = normILPhone(t); if (n) wanted.add(n) }))
        if (wanted.size) {
          const all = await getAllUsers()
          const known = new Set([authUser.uid, ...friends.map(f => f.otherUid), ...incoming.map(i => i.otherUid), ...outgoing.map(o => o.otherUid)])
          const matches = []
          const matchedNorms = new Set()
          all.forEach(u => {
            const n = normILPhone(u.phone)
            if (n && wanted.has(n)) {
              matchedNorms.add(n)
              if (!known.has(u.id)) {
                matches.push({ uid: u.id, name: [u.name, u.lastName].filter(Boolean).join(' ') || u.name || 'משתמש', photoURL: u.photoURL || null })
              }
            }
          })
          setContactMatches(matches)
          setContactsNotOnApp(wanted.size - matchedNorms.size)
        } else {
          setContactMatches([]); setContactsNotOnApp(0)
        }
      }
    } catch (e) {
      if (e?.name !== 'AbortError' && e?.name !== 'NotAllowedError') {
        console.error('contacts error:', e); setContactsMsg('error')
      }
    }
    setContactsBusy(false)
  }

  const g = profile?.gender
  const suggestTitle = g === 'male' ? 'חברים שאתה עשוי להכיר'
    : g === 'female' ? 'חברים שאת עשויה להכיר'
    : 'אנשים שאולי תכירו'

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">חברים ומשפחה</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {/* הזמנת חברים ובני משפחה — שיתוף קישור לאפליקציה */}
        <div style={{
          background: 'linear-gradient(135deg, #4F6B4A 0%, #354D31 100%)',
          borderRadius: 20, padding: '18px 18px', marginBottom: 20,
          color: '#FBF7EE', boxShadow: '0 10px 24px -8px rgba(79,107,74,.5)',
        }}>
          <div className="h-display" style={{ fontSize: 20, lineHeight: 1.15, marginBottom: 5 }}>
            הזמינו חברים ובני משפחה
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.92)', lineHeight: 1.5, marginBottom: 14 }}>
            שלחו קישור לאפליקציה — שיתקינו ותהיו בקשר כאן
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={shareWhatsApp} style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: '#FBF7EE', border: 'none',
              color: '#1B2540', fontSize: 16, fontWeight: 800,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>שיתוף בוואטסאפ</button>
            <button onClick={copyInvite} style={{
              flex: 1, padding: '13px', borderRadius: 12,
              background: 'transparent', border: '1.5px solid rgba(255,255,255,.55)',
              color: '#FBF7EE', fontSize: 16, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>{copied ? 'הקישור הועתק ✓' : 'העתקת קישור'}</button>
          </div>
          <button onClick={findFromContacts} disabled={contactsBusy} style={{
            width: '100%', marginTop: 10, padding: '13px', borderRadius: 12,
            background: 'rgba(255,255,255,.14)', border: '1.5px solid rgba(255,255,255,.4)',
            color: '#FBF7EE', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
          }}>{contactsBusy ? 'בודק...' : '📇 מצא חברים מאנשי הקשר'}</button>
        </div>

        {contactsMsg === 'unsupported' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 }}>
            קריאת אנשי קשר נתמכת רק ב-Chrome על אנדרואיד. באייפון או במחשב אפשר להזמין דרך קישור ההזמנה למעלה.
          </div>
        )}
        {contactsMsg === 'error' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px', marginBottom: 16, fontSize: 14, color: 'var(--danger)', fontWeight: 600 }}>
            לא הצלחנו לגשת לאנשי הקשר — נסו שוב.
          </div>
        )}
        {contactMatches && (
          <div style={{ marginBottom: 20 }}>
            {contactMatches.length > 0 ? (
              <>
                <h2 className="h-display" style={{ fontSize: 19, margin: '0 0 10px' }}>מאנשי הקשר שלך — כבר באפליקציה</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {contactMatches.map(s => (
                    <div key={s.uid} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={s.name} size={48} photoURL={s.photoURL} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      </div>
                      {sentReqs[s.uid] ? (
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>נשלחה בקשה ✓</span>
                      ) : (
                        <button onClick={() => handleAddSuggested(s)} className="big-btn big-btn--primary" style={{ padding: '9px 16px', flexShrink: 0 }}>הוסף חבר</button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', fontSize: 15, color: 'var(--ink-2)', fontWeight: 600 }}>
                לא נמצאו אנשי קשר שכבר באפליקציה.
              </div>
            )}
            {contactsNotOnApp > 0 && (
              <div style={{ fontSize: 13.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 10, lineHeight: 1.5 }}>
                {contactsNotOnApp} מאנשי הקשר שבחרת עדיין לא באפליקציה — הזמינו אותם דרך קישור ההזמנה למעלה.
              </div>
            )}
          </div>
        )}

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
                      onOpen={() => onMessageFriend && onMessageFriend(f)}
                      onOpenProfile={() => onOpenFriendProfile && onOpenFriendProfile(f)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Outgoing (sent) requests ────────────────── */}
            {suggestions.length > 0 && (
              <section style={{ marginTop: 24 }}>
                <h2 className="h-display" style={{ fontSize: 19, margin: '0 0 4px' }}>{suggestTitle}</h2>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10 }}>חברים של החברים שלך</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {suggestions.map(s => (
                    <div key={s.uid} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={s.name} size={48} photoURL={s.photoURL} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        {s.mutualCount > 0 && (
                          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
                            {s.mutualCount} {s.mutualCount === 1 ? 'חבר משותף' : 'חברים משותפים'}
                          </div>
                        )}
                      </div>
                      {sentReqs[s.uid] ? (
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>נשלחה בקשה ✓</span>
                      ) : (
                        <button onClick={() => handleAddSuggested(s)} className="big-btn big-btn--primary" style={{ padding: '9px 16px', flexShrink: 0 }}>הוסף חבר</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

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
// לחיצה על השורה פותחת את הצ'אט עם החבר (ושם יש כפתורי וידאו/קפה/משחק)
function FriendRow({ friend, onOpen, onOpenProfile }) {
  const [online, setOnline] = useState(false)
  const [prof, setProf] = useState(null)  // פרופיל חי: { name, lastName, photoURL }

  useEffect(() => {
    if (!friend.otherUid) return
    const unsub = watchUser(friend.otherUid, u => {
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
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      style={{
        width: '100%', textAlign: 'right',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16, padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onOpenProfile && onOpenProfile() }}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', flexShrink: 0 }}
        aria-label="הצגת פרופיל החבר"
      >
        <Avatar name={fullName} size={50} online={online} photoURL={photoURL} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fullName}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: online ? 'var(--success)' : 'var(--ink-3)',
          display: 'flex', alignItems: 'center', gap: 5, marginTop: 2,
        }}>
          {online && <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#4ADE80',
          }}/>}
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      {/* חץ שמרמז על כניסה לצ'אט */}
      <IconBackRTL size={22} color="#8389A4" />
    </div>
  )
}
