// src/pages/FamilyPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך "המשפחה שלי" — לב לולאת המשפחה.
//
// מציג:
//   • את בני המשפחה המחוברים, עם חיווי גדול וברור מי פעיל עכשיו
//   • שלושה כפתורי ענק לכל אחד: וידאו · שיחה קולית · הודעה
//   • הזמנת בן משפחה חדש בקישור (וואטסאפ / העתקה) או הצטרפות בקוד
//
// המשפחה נשענת על אותה תשתית חברים (friendships) עם תיוג relation:'family',
// וממחזרת את הצ'אט והשיחות הקיימים — אנחנו רק עוטפים אותם במסך ייעודי וחם.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchFamily, watchUser, createFamilyInvite, acceptFamilyInvite,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL, IconVideoLine, IconPhone, IconChatLine, IconShare } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'

const ONLINE_WINDOW_MS = 2 * 60 * 1000

// ── DEMO — בן משפחה לדוגמה (להמחשה בלבד) ──────────────────
// כשהמתג דלוק, מופיע "דנה" בראש הרשימה עם תווית "דוגמה", כדי לראות
// איך המסך נראה ומתנהג. הכפתורים מציגים הסבר במקום לבצע פעולה אמיתית.
// ⚠️ לכבות (false) לפני פרסום — זו תצוגה מקדימה, לא בן משפחה אמיתי.
const SHOW_DEMO_FAMILY = true
const DEMO_FAMILY = [
  { docId: 'demo-dana', otherUid: 'demo-dana', otherName: 'דנה', demo: true, color: '#6B3A4F' },
]

function statusText(online, lastSeenMs) {
  if (online) return 'מחובר/ת עכשיו'
  if (!lastSeenMs) return 'לא מחובר/ת כרגע'
  const diff = Date.now() - lastSeenMs
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'היה/תה פעיל/ה היום'
  if (diff < 2 * day) return 'היה/תה פעיל/ה אתמול'
  return 'היה/תה פעיל/ה לאחרונה'
}

export default function FamilyPage({ onBack, onHome, onMessageFamily, onVideoCall, onAudioCall, onGoFriends }) {
  const { authUser, profile } = useUserStore()
  const [family, setFamily] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authUser?.uid) return
    const unsub = watchFamily(authUser.uid, (list) => {
      setFamily(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [authUser?.uid])

  // הרשימה המוצגת — כולל בן משפחה לדוגמה אם המתג דלוק
  const shownFamily = SHOW_DEMO_FAMILY ? [...DEMO_FAMILY, ...family] : family

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">המשפחה שלי</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>
            טוען...
          </div>
        ) : (
          <>
            {shownFamily.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px 8px', color: 'var(--ink-2)' }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
                <div className="h-display" style={{ fontSize: 21, marginBottom: 8, color: 'var(--ink)' }}>
                  המשפחה שלך — במקום אחד
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                  הזמינו את הילדים, הנכדים והאחים. הם פותחים קישור אחד —
                  ומאותו רגע אתם במרחק כפתור: שיחה, הודעה ותמונה.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {shownFamily.map(m => (
                  <FamilyCard
                    key={m.docId}
                    member={m}
                    onVideo={() => onVideoCall && onVideoCall(m)}
                    onAudio={() => onAudioCall && onAudioCall(m)}
                    onMessage={() => onMessageFamily && onMessageFamily(m)}
                  />
                ))}
              </div>
            )}

            {/* ── הזמנת בן משפחה ── */}
            <InviteSection
              uid={authUser?.uid}
              name={profile?.name || ''}
            />

            {/* ── מעבר לחברים ── */}
            {onGoFriends && (
              <button
                onClick={onGoFriends}
                style={{
                  width: '100%', marginTop: 14, background: 'none', border: 'none',
                  color: 'var(--ink-3)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
                }}
              >
                החברים שלי
                <IconBackRTL size={18} color="#8389A4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── כרטיס בן משפחה — מאזין לסטטוס החי (מחובר / פעיל לאחרונה) ──
function FamilyCard({ member, onVideo, onAudio, onMessage }) {
  const [online, setOnline] = useState(Boolean(member.demo))
  const [prof, setProf] = useState(null)
  const [demoNote, setDemoNote] = useState(false)

  useEffect(() => {
    if (member.demo || !member.otherUid) return
    const unsub = watchUser(member.otherUid, u => {
      const seen = u?.lastSeenAt
      const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
      const fresh = seenMs && (Date.now() - seenMs) < ONLINE_WINDOW_MS
      setOnline(Boolean(fresh) && ['available', 'busy'].includes(u?.status))
      setProf({
        name: u?.name || '',
        lastName: u?.lastName || '',
        photoURL: u?.photoURL || null,
        lastSeenMs: seenMs,
      })
    })
    return () => unsub && unsub()
  }, [member.otherUid, member.demo])

  const fullName = member.demo
    ? member.otherName
    : (prof ? ([prof.name, prof.lastName].filter(Boolean).join(' ') || member.otherName) : member.otherName)

  // כפתורי הדוגמה מציגים הסבר במקום לבצע פעולה אמיתית
  const act = (fn) => () => {
    if (member.demo) {
      setDemoNote(true)
      setTimeout(() => setDemoNote(false), 3500)
      return
    }
    fn && fn()
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: member.demo ? '1px dashed var(--line-strong, #D8CDB3)' : '1px solid var(--line)',
      borderRadius: 18, padding: '14px 14px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar name={fullName} size={54} online={online} color={member.color || undefined} photoURL={prof?.photoURL || null} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="h-display" style={{
              fontSize: 19, color: 'var(--ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {fullName}
            </div>
            {member.demo && (
              <span style={{
                fontSize: 11, fontWeight: 800, color: 'var(--ink-3)',
                background: '#EFE7D6', borderRadius: 999, padding: '2px 8px', flexShrink: 0,
              }}>דוגמה</span>
            )}
          </div>
          <div style={{
            fontSize: 13.5, fontWeight: 700, marginTop: 2,
            color: online ? 'var(--success)' : 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {online && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80' }} />}
            {member.demo ? 'מחוברת עכשיו' : statusText(online, prof?.lastSeenMs)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <ActionBtn bg="#4F6B4A" icon={<IconVideoLine size={24} color="#FBF7EE" />} label="וידאו" onClick={act(onVideo)} />
        <ActionBtn bg="#2C5566" icon={<IconPhone size={22} color="#FBF7EE" />} label="שיחה" onClick={act(onAudio)} />
        <ActionBtn bg="#6B3A4F" icon={<IconChatLine size={23} color="#FBF7EE" />} label="הודעה" onClick={act(onMessage)} />
      </div>

      {demoNote && (
        <div style={{
          marginTop: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)',
          background: '#EFE7D6', borderRadius: 10, padding: '10px 12px', lineHeight: 1.5, textAlign: 'center',
        }}>
          זו דוגמה להמחשה 🙂 כדי לדבר עם בן משפחה אמיתי — הזמינו אותו דרך הקישור למטה.
        </div>
      )}
    </div>
  )
}

function ActionBtn({ bg, icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: bg, border: 'none', borderRadius: 14,
      padding: '12px 4px', color: '#FBF7EE', fontFamily: 'inherit',
      fontWeight: 800, fontSize: 14, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {icon}
      {label}
    </button>
  )
}

// ── הזמנת בן משפחה — יוצר קישור ומשתף בוואטסאפ / מעתיק, או מצטרף בקוד ──
function InviteSection({ uid, name }) {
  const [code, setCode] = useState(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMsg, setJoinMsg] = useState('')

  const link = code ? `${window.location.origin}/?join=${code}` : ''
  const shareText = `הזמנה ל"ביחד" 💛 לחצו על הקישור כדי להתחבר אליי: ${link}`

  const handleCreate = async () => {
    if (!uid) return
    setCreating(true)
    try {
      const res = await createFamilyInvite({ uid, name })
      if (res?.code) setCode(res.code)
    } catch (e) { console.error(e) }
    setCreating(false)
  }

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch { /* ignore */ }
  }

  const handleJoin = async () => {
    if (!joinCode.trim() || !uid) return
    setJoining(true); setJoinMsg('')
    const res = await acceptFamilyInvite({ code: joinCode, me: { uid, name } })
    setJoining(false)
    if (res?.ok) {
      setJoinMsg(`התחברת ל${res.inviterName} ✓`)
      setJoinCode('')
    } else if (res?.reason === 'not-found') {
      setJoinMsg('קוד לא נמצא — בדקו שוב')
    } else if (res?.reason === 'self') {
      setJoinMsg('זה הקוד שלך :)')
    } else {
      setJoinMsg('משהו השתבש — נסו שוב')
    }
  }

  return (
    <div style={{
      marginTop: 18,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '18px 16px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div className="h-display" style={{ fontSize: 19, color: 'var(--ink)', marginBottom: 4 }}>
        הזמן בן משפחה
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
        שלחו קישור — הם פותחים, מתחברים, ומופיעים כאן.
      </div>

      {!code ? (
        <button
          onClick={handleCreate}
          disabled={creating}
          className="big-btn big-btn--primary"
          style={{ width: '100%', opacity: creating ? 0.7 : 1 }}
        >
          {creating ? 'יוצר קישור...' : '＋ צור קישור הזמנה'}
        </button>
      ) : (
        <>
          <div style={{
            background: '#EFE7D6', border: '1px dashed var(--brass, #B89048)',
            borderRadius: 12, padding: '12px 14px', textAlign: 'center',
            fontSize: 15, fontWeight: 800, color: 'var(--ink)',
            direction: 'ltr', letterSpacing: '0.04em', wordBreak: 'break-all',
          }}>
            {link}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={shareWhatsApp}
              style={{
                flex: 2, background: '#25D366', color: '#fff', border: 'none',
                borderRadius: 14, padding: '13px', fontFamily: 'inherit', fontWeight: 800,
                fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }}
            >
              <IconShare size={20} color="#fff" />
              שיתוף בוואטסאפ
            </button>
            <button
              onClick={copyLink}
              className="big-btn big-btn--ghost"
              style={{ flex: 1, padding: '13px' }}
            >
              {copied ? 'הועתק ✓' : 'העתק'}
            </button>
          </div>
        </>
      )}

      {/* הצטרפות בקוד — למי שקיבל קוד ידני */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
        {!showJoin ? (
          <button
            onClick={() => setShowJoin(true)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}
          >
            קיבלת קוד? לחץ להצטרפות
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>
              הקלד את הקוד שקיבלת:
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="לדוגמה 7K2Q9M"
                maxLength={6}
                style={{
                  flex: 1, border: '1px solid var(--line)', borderRadius: 12,
                  padding: '12px 14px', fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
                  textAlign: 'center', letterSpacing: '0.1em', direction: 'ltr',
                }}
              />
              <button
                onClick={handleJoin}
                disabled={joining || !joinCode.trim()}
                className="big-btn big-btn--primary"
                style={{ padding: '12px 20px', opacity: (joining || !joinCode.trim()) ? 0.7 : 1 }}
              >
                {joining ? '...' : 'הצטרף'}
              </button>
            </div>
            {joinMsg && (
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginTop: 8, textAlign: 'center' }}>
                {joinMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
