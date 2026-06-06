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
  watchUser, sendFriendRequest, getSuggestedFriends, getGallery,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import { IconBackRTL } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'

export default function FriendsPage({ onBack, onHome, onMessageFriend, onVideoCallFriend, onCallFriend }) {
  const { authUser, profile } = useUserStore()
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [sentReqs, setSentReqs] = useState({})
  const [quickFriend, setQuickFriend] = useState(null)

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
        </div>

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
                      onOpenQuick={() => setQuickFriend(f)}
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

      {quickFriend && (
        <FriendQuickView
          friend={quickFriend}
          onClose={() => setQuickFriend(null)}
          onMessage={() => onMessageFriend && onMessageFriend(quickFriend)}
          onVideoCall={() => onVideoCallFriend && onVideoCallFriend(quickFriend)}
          onVoiceCall={() => onCallFriend && onCallFriend(quickFriend)}
        />
      )}
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
function FriendRow({ friend, onOpen, onOpenQuick }) {
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
        onClick={e => { e.stopPropagation(); onOpenQuick && onOpenQuick() }}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', flexShrink: 0 }}
        aria-label="הצגת פרטי החבר"
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

// חלונית פעולות מהירה לחבר (בסגנון וואטסאפ) — נפתחת בלחיצה על תמונת החבר.
// מעל הרשימה המעומעמת: תמונה גדולה + שיחה/וידאו/הודעה/פרטים.
function FriendQuickView({ friend, onClose, onMessage, onVideoCall, onVoiceCall }) {
  const uid = friend?.otherUid
  const [prof, setProf] = useState(null)
  const [gallery, setGallery] = useState([])
  const [showItems, setShowItems] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    if (!uid) return
    const unsub = watchUser(uid, u => setProf(u || null))
    getGallery(uid).then(setGallery).catch(() => {})
    return () => unsub && unsub()
  }, [uid])

  const fullName = prof
    ? ([prof.name, prof.lastName].filter(Boolean).join(' ') || friend?.otherName || '')
    : (friend?.otherName || '')
  const photoURL = prof?.photoURL || null
  const about = prof?.about || ''

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(20,20,24,.62)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, direction: 'rtl',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 320, background: 'var(--surface)', borderRadius: 18,
          overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,.4)',
          maxHeight: '88%', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            background: '#7E2C2E', color: '#FBF7EE', padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div className="h-display" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullName}</div>
            <button onClick={onClose} aria-label="סגירה" style={{
              border: 'none', background: 'rgba(255,255,255,.18)', color: '#FBF7EE',
              width: 30, height: 30, borderRadius: '50%', fontSize: 16, cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0, marginInlineStart: 10,
            }}>✕</button>
          </div>

          <button
            onClick={() => photoURL && setLightbox(photoURL)}
            style={{
              border: 'none', background: photoURL ? '#000' : '#F3E3E1', padding: 0,
              cursor: photoURL ? 'zoom-in' : 'default', width: '100%', aspectRatio: '1',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="הצגת התמונה בגודל מלא"
          >
            {photoURL
              ? <img src={photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <span style={{ fontSize: 92, fontWeight: 800, color: '#7E2C2E', fontFamily: 'inherit' }}>{(fullName || '?').trim().charAt(0)}</span>}
          </button>

          <div style={{ display: 'flex', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <QuickAction emoji="📞" label="שיחה" onClick={() => { onClose(); onVoiceCall && onVoiceCall() }} />
            <QuickAction emoji="📹" label="וידאו" onClick={() => { onClose(); onVideoCall && onVideoCall() }} />
            <QuickAction emoji="💬" label="הודעה" onClick={() => { onClose(); onMessage && onMessage() }} />
            <QuickAction emoji="👤" label="פרטים" active={showItems} onClick={() => setShowItems(s => !s)} />
          </div>

          {showItems && (
            <div style={{ padding: '14px 16px', overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 5 }}>מעט עליו</div>
              <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {about || 'לא מולא/ה עדיין פרטים.'}
              </div>
              {gallery.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-3)', margin: '14px 0 8px' }}>תמונות</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {gallery.map(p => (
                      <button key={p.id} onClick={() => setLightbox(p.dataURL)} style={{
                        aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: 'none',
                        padding: 0, background: 'var(--surface-2)', cursor: 'pointer',
                      }} aria-label="הצגת התמונה בגודל מלא">
                        <img src={p.dataURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  )
}

// כפתור פעולה יחיד בשורת הפעולות של החלונית.
function QuickAction({ emoji, label, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, border: 'none', background: active ? '#F3E3E1' : 'transparent',
      padding: '12px 4px', cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</span>
    </button>
  )
}
