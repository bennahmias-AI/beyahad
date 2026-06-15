// src/pages/FriendSearchPage.jsx
// ─────────────────────────────────────────────────────────────
// "חיפוש חברים" — מסך חיפוש משתמשים חדשים להוספה לרשימת החברים.
//
// מציג:
//  • שדה חיפוש לפי שם פרטי/משפחה (טוקן בודד מספיק).
//  • אנימציית "רדאר" של 3 שניות בכניסה הראשונה, ואז:
//  • רשימה של עד 10 משתמשים מחוברים רנדומליים (לא חברים שלי, לא חסומים).
//  • כל שורה — תמונה + שם פרטי + אות ראשונה של שם משפחה (פרטיות), + כפתור "הוסף".
//  • כשהמשתמש מקליד בשדה — מציג תוצאות חיפוש בלי הרדאר.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import Avatar from '../components/Avatar.jsx'
import { useUserStore } from '../stores/userStore.js'
import {
  findOnlineStrangers, searchUsersByName, sendFriendRequest, watchFriendships,
} from '../services/firebase.js'

export default function FriendSearchPage({ onBack, onHome }) {
  const { authUser, profile } = useUserStore()
  const myUid = authUser?.uid

  const [searchText, setSearchText] = useState('')
  const [randomUsers, setRandomUsers] = useState([])      // הרשימה הראשונית הרנדומלית
  const [searchResults, setSearchResults] = useState([])  // תוצאות חיפוש לפי שם
  const [scanning, setScanning] = useState(true)          // אנימציית הרדאר הראשונית
  const [sentRequests, setSentRequests] = useState({})    // { uid: 'sending'|'sent'|'error' }
  const [friendUids, setFriendUids] = useState(new Set())

  // רשימת החברים — להוצאתם מתוצאות החיפוש (אם כבר חברים, אין טעם להוסיף)
  useEffect(() => {
    if (!myUid) return
    const unsub = watchFriendships(myUid, ({ friends }) => {
      setFriendUids(new Set((friends || []).map(f => f.otherUid)))
    })
    return () => unsub && unsub()
  }, [myUid])

  // סריקה ראשונית עם אנימציית רדאר של 3 שניות
  useEffect(() => {
    if (!myUid) return
    setScanning(true)
    const start = Date.now()
    findOnlineStrangers(myUid, friendUids, 10).then(list => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 3000 - elapsed) // לפחות 3 שניות אנימציה
      setTimeout(() => {
        setRandomUsers(list)
        setScanning(false)
      }, remaining)
    })
    // eslint-disable-next-line
  }, [myUid])

  // חיפוש לפי שם — debounce 350ms
  useEffect(() => {
    if (!searchText.trim() || !myUid) { setSearchResults([]); return }
    const t = setTimeout(() => {
      searchUsersByName(searchText, myUid).then(setSearchResults)
    }, 350)
    return () => clearTimeout(t)
  }, [searchText, myUid])

  // הצגת שם פרטי + אות ראשונה של שם משפחה (פרטיות — לא חושפים שם מלא של זרים)
  const displayName = (u) => {
    const first = u.name || ''
    const lastInitial = u.lastName ? `${u.lastName.charAt(0)}.` : ''
    return [first, lastInitial].filter(Boolean).join(' ').trim() || 'משתמש'
  }

  const handleAddFriend = async (u) => {
    if (sentRequests[u.id] === 'sending' || sentRequests[u.id] === 'sent') return
    setSentRequests(prev => ({ ...prev, [u.id]: 'sending' }))
    try {
      await sendFriendRequest(
        { uid: myUid, name: profile?.name || '', photoURL: profile?.photoURL || '' },
        { uid: u.id, name: u.name || '', photoURL: u.photoURL || '' },
      )
      setSentRequests(prev => ({ ...prev, [u.id]: 'sent' }))
    } catch (e) {
      console.error('sendFriendRequest error:', e)
      setSentRequests(prev => ({ ...prev, [u.id]: 'error' }))
    }
  }

  const searching = !!searchText.trim()
  // מסננים חברים קיימים מהתצוגה — המסך הזה למציאת חברים חדשים. אם מישהו כבר חבר — מוצאים אותו דרך עמוד החברים הרגיל.
  const displayed = (searching ? searchResults : randomUsers).filter(u => !friendUids.has(u.id))

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">חיפוש חברים</div>
      </div>

      <div style={{ padding: '12px 18px 32px' }}>
        {/* שדה חיפוש */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '1px solid var(--line-strong)',
          borderRadius: 14, padding: '11px 14px', marginBottom: 18,
        }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="שם פרטי או שם משפחה..."
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'none',
              fontSize: 16, fontFamily: 'inherit', color: 'var(--ink)', direction: 'rtl',
            }}
          />
          {searchText && (
            <button onClick={() => setSearchText('')} aria-label="נקה" style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', fontSize: 20, padding: 0,
            }}>✕</button>
          )}
        </div>

        {/* אנימציית רדאר — רק כשסורקים והמשתמש לא חיפש (חיפוש מציג תוצאות מיידית) */}
        {scanning && !searching && <RadarAnimation />}

        {/* תוצאות */}
        {(!scanning || searching) && (
          <>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 700, margin: '4px 4px 10px' }}>
              {searching
                ? (searchResults.length > 0
                    ? `נמצאו ${searchResults.length} תוצאות`
                    : 'אין תוצאות לחיפוש')
                : `💡 משתמשים מחוברים עכשיו (${randomUsers.length})`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayed.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  displayName={displayName(u)}
                  isFriend={friendUids.has(u.id)}
                  requestState={sentRequests[u.id]}
                  onAdd={() => handleAddFriend(u)}
                />
              ))}

              {!searching && displayed.length === 0 && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 14, padding: '24px 20px', textAlign: 'center',
                  color: 'var(--ink-3)', fontSize: 15,
                }}>
                  😔 אין כרגע משתמשים חדשים מחוברים. נסה לחפש לפי שם.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// שורה של משתמש בודד — תמונה + שם + סטטוס מחובר + כפתור הוסף
function UserRow({ user, displayName, isFriend, requestState, onAdd }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 14, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <Avatar name={displayName} size={48} photoURL={user.photoURL} online />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{
          fontSize: 16, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {displayName}
        </div>
        <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
          🟢 מחובר עכשיו
        </div>
      </div>
      {isFriend ? (
        <span style={{
          background: 'var(--surface-2, #f4eed8)', color: 'var(--ink-2)',
          padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
        }}>✓ חבר</span>
      ) : requestState === 'sent' ? (
        <span style={{
          background: 'var(--success, #2f9e3f)', color: '#fff',
          padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
        }}>✓ נשלח</span>
      ) : (
        <button
          onClick={onAdd}
          disabled={requestState === 'sending'}
          style={{
            background: 'var(--burgundy, #7E2C2E)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 700,
            fontFamily: 'inherit', cursor: requestState === 'sending' ? 'default' : 'pointer',
            opacity: requestState === 'sending' ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >{requestState === 'sending' ? 'שולח...' : '+ הוסף'}</button>
      )}
    </div>
  )
}

// אנימציית רדאר ירוק — שכבת רקע סטטית + שכבה מסתובבת של פלח sweep + נקודה אדומה במרכז
function RadarAnimation() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 0 12px', gap: 18,
    }}>
      <style>{`
        @keyframes radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes radarPing {
          0%   { transform: scale(0.4); opacity: 0.7; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
      <div style={{ position: 'relative', width: 200, height: 200 }}>
        {/* רקע — מעגלים + צלב */}
        <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1d557f" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0a1b28" stopOpacity="0.95" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="96" fill="url(#radarBg)" stroke="rgba(80,200,120,0.55)" strokeWidth="2" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(80,200,120,0.30)" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="44" fill="none" stroke="rgba(80,200,120,0.30)" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="20" fill="none" stroke="rgba(80,200,120,0.30)" strokeWidth="1.5" />
          <line x1="6" y1="100" x2="194" y2="100" stroke="rgba(80,200,120,0.22)" strokeWidth="1" />
          <line x1="100" y1="6" x2="100" y2="194" stroke="rgba(80,200,120,0.22)" strokeWidth="1" />
        </svg>

        {/* שכבת ה-sweep המסתובבת */}
        <svg viewBox="0 0 200 200" style={{
          width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
          animation: 'radarSweep 1.6s linear infinite', transformOrigin: '50% 50%',
        }}>
          <defs>
            <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(80,200,120,0)" />
              <stop offset="60%" stopColor="rgba(80,200,120,0.25)" />
              <stop offset="100%" stopColor="rgba(80,200,120,0.85)" />
            </linearGradient>
          </defs>
          <path d="M 100,100 L 196,100 A 96,96 0 0,1 100,196 Z" fill="url(#radarSweepGrad)" />
        </svg>

        {/* נקודה במרכז + פולסי הד */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 12, height: 12, borderRadius: '50%', background: '#7ee07e',
          boxShadow: '0 0 14px rgba(126,224,126,0.9)',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', marginLeft: -16, marginTop: -16,
          width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(126,224,126,0.6)',
          animation: 'radarPing 1.8s ease-out infinite',
        }} />
      </div>

      <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', textAlign: 'center' }}>
        מחפש חברים בסביבה...
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.5 }}>
        סורקים מי מחובר עכשיו ויכול להיות חבר טוב
      </div>
    </div>
  )
}
