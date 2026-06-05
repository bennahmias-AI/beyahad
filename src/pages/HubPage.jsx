// src/pages/HubPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך הבית הראשי — עיצוב 2026.
// כרטיסים בהירים (רקע קרם) עם אייקוני תג-עיגול צבעוניים.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { setPresence, watchOnlineCount, signOut, markNotificationsSeen, cancelAccountDeletion, getUser } from '../services/firebase.js'
import { useNotifications } from '../hooks/useNotifications.js'
import NotificationsPanel from '../components/NotificationsPanel.jsx'
import Avatar from '../components/Avatar.jsx'
import {
  IconPhone, IconCoffee, IconPodium, IconFriends,
  IconKitchen, IconGreeting, IconBell, IconBackRTL, IconLightbulb,
  IconGames, IconRadio, IconTV, IconGroup, IconMusic,
} from '../icons/index.jsx'
import { useRadioStore } from '../stores/radioStore.js'
import { searchStations } from '../services/radio.js'
import { GameIcon } from '../icons/gameIcons.jsx'
import { SEED_RECIPES } from '../data/seedRecipes.js'

// ─── DEMO TOGGLE ─────────────────────────────────────────────
const SHOW_DEMO_FRIENDS = false

const DEMO_FRIENDS = [
  { id: 'd1', name: 'אסתר כהן',  color: '#6B3A4F' },
  { id: 'd2', name: 'יעקב לוי',  color: '#4F6B4A' },
  { id: 'd3', name: 'חנה גולדמן', color: '#2C5566' },
]
// ─────────────────────────────────────────────────────────────

export default function HubPage({ onGoMatch, onGoParliament, onGoTips, onGoRecipes, onGoRecipe, onGoRadio, onGoTV, onGoGreeting, onGoProfile, onGoSettings, onGoFriends, onGoFamily, onGoGames, onPlayGame, onOpenNotification }) {
  const { profile, authUser, setProfile } = useUserStore()
  const isAdmin = profile?.role === 'admin'
  const [comingSoon, setComingSoon] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [cancelingDeletion, setCancelingDeletion] = useState(false)

  // האם החשבון מתוזמן למחיקה (בתוך חלון 48 השעות)?
  const deletionAt = profile?.deletionScheduledAt || null
  const deletionPending = deletionAt && deletionAt > Date.now()
  const deletionDateText = deletionAt
    ? new Date(deletionAt).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''

  // ביטול המחיקה ישירות ממסך הבית
  const handleCancelDeletion = async () => {
    if (!authUser?.uid) return
    setCancelingDeletion(true)
    await cancelAccountDeletion(authUser.uid)
    try { const fresh = await getUser(authUser.uid); if (fresh) setProfile(fresh) } catch {}
    setCancelingDeletion(false)
  }

  // התראות — בקשות חברות, הזמנות למשחק, הודעות ולייקים
  const { items: notifications, unseenCount } = useNotifications(authUser?.uid)

  // פתיחת רשימת ההתראות — מסמן את הכל כנראה (מאפס את המספר)
  const openNotifications = () => {
    setNotifOpen(true)
    if (authUser?.uid) markNotificationsSeen(authUser.uid).catch(() => {})
  }

  // לחיצה על התראה — סוגרים את הפאנל ומעבירים ל-App לניווט הממוקד
  const handleNotifNavigate = (it) => {
    setNotifOpen(false)
    if (onOpenNotification) onOpenNotification(it)
  }

  const [onlineFriends, setOnlineFriends] = useState(
    SHOW_DEMO_FRIENDS ? DEMO_FRIENDS : []
  )
  const hasFriends = onlineFriends.length > 0

  const [onlineCount, setOnlineCount] = useState(0)

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'בוקר טוב'
             : hour < 17 ? 'צהריים טובים'
             : hour < 20 ? 'אחר צהריים טובים'
             : 'ערב טוב'

  // נגן תחנת רדיו ספציפית ישירות מהבית (חיפוש מהיר ב-API ואז ניגון; נפילה רכה למסך הרדיו)
  const playStationFromStore = useRadioStore(s => s.playStation)
  const playRadio = async (query) => {
    try {
      const list = await searchStations(query)
      if (list && list[0]) { playStationFromStore(list[0]); return }
    } catch {}
    onGoRadio()
  }

  // ─── מאגר ההצעות ל"קורה ממש עכשיו" ───
  // נבנה מכל הקטגוריות: כל משחק × כל מצב, מתכונים בשם, תחנות רדיו ספציפיות, וקיצורי דרך קבועים.

  // משחקים — כל משחק מקבל את האייקון והצבע שלו
  const GAMES = [
    { id: 'bingo',     name: 'בינגו',   color: '#4F6B4A' },
    { id: 'sheshbesh', name: 'שש-בש',   color: '#7E2C2E' },
    { id: 'checkers',  name: 'דמקה',    color: '#2C5566' },
    { id: 'chess',     name: 'שחמט',    color: '#1B2540' },
    { id: 'rummikub',  name: 'רמיקוב',  color: '#B89048' },
    { id: 'connect4',  name: '4 בשורה', color: '#6B3A4F' },
  ]
  const MODE_DEFS = {
    friend: { mode: 'online-friend', label: 'עם חבר קרוב',   sub: 'הזמינו חבר למשחק אישי' },
    online: { mode: 'online-random', label: 'מול שחקן ברשת', sub: 'נמצא לכם יריב מחובר עכשיו' },
    ai:     { mode: 'ai',            label: 'מול המחשב',      sub: 'אימון נעים בקצב שלכם' },
    solo:   { mode: 'solo',          label: 'לבד',            sub: 'המספרים עולים אוטומטית' },
  }
  // בינגו תומך ב"לבד"; שאר המשחקים ב"מול המחשב"
  const GAME_MODES_BY_ID = { bingo: ['friend', 'online', 'solo'] }
  const DEFAULT_MODES = ['friend', 'online', 'ai']
  const gameSuggestions = GAMES.flatMap(g =>
    (GAME_MODES_BY_ID[g.id] || DEFAULT_MODES).map(mk => {
      const md = MODE_DEFS[mk]
      return {
        key: `game-${g.id}-${mk}`,
        title: `שחקו ${g.name} ${md.label}`,
        sub: md.sub,
        icon: <GameBadge id={g.id} color={g.color} />,
        go: () => onPlayGame(g.id, md.mode),
      }
    })
  )

  // מתכונים — מתוך מאגר המתכונים האמיתי, עם פרגון לחבר/ה שכתב/ה אותם
  const recipeSuggestions = SEED_RECIPES.map((r) => {
    const firstName = (r.author || '').split(' ')[0]
    const ownerInTitle = (r.title || '').includes(' של ')   // למשל "מרק עוף של סבתא" — לא להכפיל "של"
    return {
      key: `recipe-${r.id}`,
      title: ownerInTitle ? `נסו את ${r.title}` : `נסו את ${r.title} של ${firstName}`,
      sub: `מהמטבח של ${r.author}`,
      icon: <IconKitchen size={52} />,
      go: () => onGoRecipe(`seed-recipe-${r.id}`),
    }
  })

  // תחנות רדיו — ישראליות וגם מהעולם, כל אחת מנגנת ישירות
  const STATIONS = [
    { name: 'גלגלצ',        q: 'Galgalatz',      sub: 'הלהיטים של הצבא' },
    { name: 'גלי צה"ל',     q: 'Galei Tsahal',   sub: 'חדשות ומוזיקה כל היום' },
    { name: 'כאן 88',        q: 'Kan 88',         sub: 'ג\'אז וישראלית איכותית' },
    { name: 'כאן גימל',     q: 'Kan Gimel',      sub: 'הזהב של הזמר העברי' },
    { name: 'כאן רשת ב',    q: 'Kan Reshet Bet', sub: 'דיבור, אקטואליה ותרבות' },
    { name: 'רדיו תל אביב', q: 'Radio Tel Aviv', sub: 'הפסקול של העיר' },
    { name: '100FM',         q: 'Radius 100FM',   sub: 'מצעד הלהיטים' },
    { name: 'eco99',         q: 'eco99fm',        sub: 'מוזיקה ללא הפסקה' },
    { name: 'רדיו קלאסי',    q: 'classical',      sub: 'יצירות קלאסיות נבחרות' },
    { name: "ג\'אז מהעולם",   q: 'jazz',           sub: "ג\'אז רגוע לכל שעה" },
    { name: 'שירי זהב',      q: 'oldies',         sub: 'הקלאסיקות שאוהבים' },
    { name: "מוזיקת לואנג'", q: 'lounge',         sub: 'רקע נעים ומרגיע' },
    { name: 'רדיו צרפתי',    q: 'France',         sub: 'שאנסונים מפריז' },
    { name: 'רדיו יווני',     q: 'Greek',          sub: 'בוזוקי ושמש' },
    { name: 'רדיו איטלקי',    q: 'Italy',          sub: 'מהפיאצה הישר אליכם' },
  ]
  const radioSuggestions = STATIONS.map((st, i) => ({
    key: `radio-${i}`,
    title: `הדליקו ${st.name}`,
    sub: st.sub,
    icon: <IconRadio size={52} />,
    go: () => playRadio(st.q),
  }))

  // קיצורי דרך קבועים שתמיד שווה להציע
  const STAPLES = [
    { key: 'greeting',   title: 'צור ברכה אישית',      sub: 'ברכה יפה למשפחה ולחברים בלחיצה אחת', icon: <IconGreeting size={52} />,  go: onGoGreeting },
    { key: 'coffee',     title: 'קפה בסלון',            sub: 'שיחת וידאו אחד-על-אחד, עכשיו',        icon: <IconCoffee size={52} />,    go: onGoMatch },
    { key: 'parliament', title: 'הצטרפו לפרלמנט',       sub: 'דיון קבוצתי מתחיל עוד מעט',           icon: <IconPodium size={52} />,    go: onGoParliament },
    { key: 'tips',       title: 'עצה חדשה מהחברים',     sub: 'טיפ שימושי שכדאי להכיר',              icon: <IconLightbulb size={52} />, go: onGoTips },
    { key: 'friends',    title: 'מי מהחברים מחובר?',    sub: 'הציצו ברשימת החברים שלכם',           icon: <IconFriends size={52} />,   go: onGoFriends },
  ]

  const SUGGESTIONS = [
    ...gameSuggestions.map(s => ({ ...s, cat: 'game' })),
    ...recipeSuggestions.map(s => ({ ...s, cat: 'recipe' })),
    ...radioSuggestions.map(s => ({ ...s, cat: 'radio' })),
    ...STAPLES.map(s => ({ ...s, cat: 'staple' })),
  ]

  // בחירה אקראית מאוזנת — 3 הצעות מקטגוריות שונות בכל כניסה למסך
  const [pickIdx] = useState(() => {
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
    const byCat = {}
    SUGGESTIONS.forEach((s, i) => { (byCat[s.cat] = byCat[s.cat] || []).push(i) })
    const chosen = []
    for (const c of shuffle(Object.keys(byCat))) {
      if (chosen.length >= 3) break
      const arr = byCat[c]
      chosen.push(arr[Math.floor(Math.random() * arr.length)])
    }
    if (chosen.length < 3) {
      const rest = shuffle(SUGGESTIONS.map((_, i) => i).filter(i => !chosen.includes(i)))
      while (chosen.length < 3 && rest.length) chosen.push(rest.pop())
    }
    return chosen
  })
  const hourlyPicks = pickIdx.map(i => SUGGESTIONS[i])

  useEffect(() => {
    if (!authUser?.uid) return
    setPresence(authUser.uid, 'available').catch(() => {})

    const beat = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        setPresence(authUser.uid, 'available').catch(() => {})
      }
    }, 60 * 1000)

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        setPresence(authUser.uid, 'away').catch(() => {})
      } else {
        setPresence(authUser.uid, 'available').catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      clearInterval(beat)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [authUser?.uid])

  useEffect(() => {
    const unsub = watchOnlineCount(count => setOnlineCount(count))
    return () => unsub && unsub()
  }, [])

  const showComingSoon = (name) => setComingSoon(name)
  const userName = profile?.name || 'אורח'

  return (
    <div className="scroll-area">
      {/* ── Top: greeting + bell ───────────────────────────── */}
      <div style={{ padding: '18px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setMenuOpen(true)}
          style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '50%' }}
          aria-label="תפריט פרופיל"
        >
          <Avatar name={userName} size={54} color="#6B3A4F" photoURL={profile?.photoURL || null} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, color: 'var(--burgundy)', fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.10em',
            fontFamily: 'var(--font-display)',
          }}>{greet}</div>
          <div className="h-display" style={{ fontSize: 26, color: 'var(--ink)', lineHeight: 1, marginTop: 2 }}>
            {userName}
          </div>
        </div>
        <button
          aria-label="התראות"
          onClick={openNotifications}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'none', border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: 'pointer',
          }}
        >
          <IconBell size={52} />
          {unseenCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, insetInlineStart: -2,
              minWidth: 22, height: 22, borderRadius: 11, padding: '0 5px',
              background: 'var(--mustard)', color: 'var(--ink)',
              fontSize: 12, fontWeight: 800,
              fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--ink)',
            }}>{unseenCount}</span>
          )}
        </button>
      </div>

      <div style={{ padding: '12px 20px 20px' }}>
        {/* ── באנר מחיקת חשבון — מוצג רק אם החשבון מתוזמן למחיקה ── */}
        {deletionPending && (
          <div style={{
            background: 'var(--surface)',
            border: '2px solid var(--danger)',
            borderRadius: 16,
            padding: '16px 18px',
            marginBottom: 16,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>⏳</span>
              <span className="h-display" style={{ fontSize: 18, color: 'var(--danger)' }}>
                החשבון מתוזמן למחיקה
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.6, marginBottom: 14 }}>
              החשבון שלך יימחק בתאריך <strong style={{ color: 'var(--danger)' }}>{deletionDateText}</strong>. אם שינית את דעתך — אפשר לבטל עכשיו והחשבון יישאר פעיל.
            </div>
            <button
              onClick={handleCancelDeletion}
              disabled={cancelingDeletion}
              className="big-btn big-btn--primary"
              style={{ width: '100%', opacity: cancelingDeletion ? 0.7 : 1 }}
            >
              {cancelingDeletion ? 'מבטל...' : '✕ בטל את המחיקה'}
            </button>
          </div>
        )}

        {/* ── באנר ירוק — כמה אנשים מחוברים כעת ────────── */}
        {isAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, #5B7E54 0%, #4F6B4A 100%)',
          borderRadius: 16,
          padding: '12px 16px',
          marginBottom: 16,
          boxShadow: '0 6px 16px -6px rgba(79,107,74,.5)',
        }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#9BE89B',
            boxShadow: '0 0 0 0 rgba(155,232,155,.6)',
            animation: 'livePulse 1.6s infinite',
            flexShrink: 0,
          }}/>
          <span style={{
            color: '#FBF7EE', fontSize: 16, fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}>
            {onlineCount <= 1
              ? 'אתה מחובר — מחכים שעוד יצטרפו'
              : <>יש כעת <strong style={{ fontWeight: 800 }}>{onlineCount}</strong> אנשים מחוברים</>
            }
          </span>
        </div>
        )}

        {/* ── HERO — החברים שלך (מוצג רק אם יש מחוברים) ────── */}
        {hasFriends && (
          <button onClick={onGoMatch} style={{
            width: '100%', textAlign: 'right',
            background: 'linear-gradient(135deg, #2C5566 0%, #1B2540 60%, #0E1730 100%)',
            border: 'none',
            borderRadius: 26,
            padding: '24px 22px 20px',
            color: '#FBF7EE',
            boxShadow: '0 16px 36px -10px rgba(126,44,46,.55), 0 4px 12px rgba(20,23,42,.08)',
            position: 'relative', overflow: 'hidden',
            display: 'block',
            marginBottom: 16,
            fontFamily: 'inherit',
          }}>
            <div style={{
              position: 'absolute', insetInlineEnd: -60, top: -60,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', insetInlineStart: -40, bottom: -80,
              width: 180, height: 180, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,200,87,.18), transparent 70%)',
              pointerEvents: 'none',
            }}/>

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
              <div style={{
                width: 60, height: 60, borderRadius: 18,
                background: 'rgba(255,255,255,.18)',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid rgba(255,255,255,.22)',
              }}>
                <IconPhone size={30} color="#FBF7EE" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="h-display" style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 6, color: '#FBF7EE', letterSpacing: '-0.02em' }}>
                  החברים שלך מחוברים
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.92)', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="live-dot" style={{ background: '#E8C879', width: 8, height: 8 }} />
                  <span>
                    <strong style={{ fontWeight: 800 }}>{onlineFriends.length} </strong>
                    {onlineFriends.length === 1 ? 'חבר מחובר עכשיו' : 'חברים מחוברים עכשיו'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
              position: 'relative',
            }}>
              {onlineFriends.slice(0, 4).map(f => (
                <div key={f.id} style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Avatar name={f.name} size={48} color={f.color} />
                    <span style={{
                      position: 'absolute', insetInlineEnd: 0, bottom: 0,
                      width: 13, height: 13, borderRadius: '50%',
                      background: '#4ADE80',
                      border: '2.5px solid #1B2540',
                    }}/>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, marginTop: 4,
                    color: 'rgba(255,255,255,.85)',
                    maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.name.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16,
              background: 'rgba(255,255,255,.16)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.24)',
              borderRadius: 16,
              padding: '13px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 17, fontWeight: 700,
            }}>
              <span>הקש כדי להתחיל שיחה</span>
              <IconBackRTL size={22} color="#FBF7EE" />
            </div>
          </button>
        )}

        {/* ── 2 featured rooms — קפה + פרלמנט ──────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}>
          <RoomTile
            onClick={onGoMatch}
            icon={<IconCoffee size={60} />}
            label="קפה בסלון"
            sub="אחד על אחד"
            badge="התאמה אוטומטית"
          />
          <RoomTile
            onClick={onGoFamily}
            icon={<IconFriends size={60} />}
            label="המשפחה שלי"
            sub="קרובים אליי"
            badge="שיחה · תמונה · הודעה"
          />
        </div>

        {/* כרטיס חברים (רוחב מלא) */}
        <button onClick={onGoFriends} style={{
          width: '100%', textAlign: 'right',
          marginTop: 12,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 20,
          padding: '14px 16px',
          color: 'var(--ink)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex', flexDirection: 'row-reverse',
          alignItems: 'center', gap: 14,
          fontFamily: 'inherit',
        }}>
          <IconBackRTL size={22} color="#8389A4" />
          <div style={{ flex: 1 }}>
            <div className="h-display" style={{ fontSize: 19, color: 'var(--ink)', lineHeight: 1.15 }}>
              החברים שלי
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginTop: 3 }}>
              מי מחובר עכשיו ושיחה אישית
            </div>
          </div>
          <IconGroup size={50} />
        </button>

        {/* ── שורה: ברכה + משחקים — רשת אחידה ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <FeatureTile
            onClick={onGoGreeting} cream
            icon={<IconGreeting size={48} />} title="ברכה אישית"
          />
          <FeatureTile
            onClick={onGoGames}
            bg="linear-gradient(135deg, #7E2C2E 0%, #5A1D1E 100%)"
            shadow="rgba(126,44,46,.5)" nimbus="rgba(232,200,121,.25)"
            eyebrow="✨ חדש!" icon={<IconGames size={50} />} title="משחקים"
          />
        </div>

        {/* ── שורה: רדיו + טלוויזיה — רשת אחידה ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <FeatureTile
            onClick={onGoRadio}
            bg="linear-gradient(135deg, #6B3A4F 0%, #482638 100%)"
            shadow="rgba(107,58,79,.5)"
            eyebrow="✨ חדש!" icon={<IconRadio size={50} />} title="רדיו"
          />
          <FeatureTile
            onClick={onGoTV}
            bg="linear-gradient(135deg, #2C5566 0%, #16323F 100%)"
            shadow="rgba(44,85,102,.5)"
            eyebrow="✨ חדש!" icon={<IconTV size={50} />} title="טלוויזיה"
          />
        </div>

        {/* ── 3 utility tiles ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginTop: 12,
        }}>
          <HomeTileSmall
            onClick={onGoTips}
            icon={<IconLightbulb size={48} />}
            label="עצות"
            badge="טיפים מהחברים"
          />
          <HomeTileSmall
            onClick={onGoRecipes}
            icon={<IconKitchen size={48} />}
            label="מתכונים"
            badge="מטבח של חברים"
          />
          <HomeTileSmall
            onClick={onGoParliament}
            icon={<IconPodium size={48} />}
            label="הפרלמנט"
            badge="חמישה בתור"
            live
          />
        </div>

        {/* ── Live now strip ───────────────────────────────── */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 className="h-display" style={{ fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-dot" />
              מומלצים לשעה הקרובה
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: 'var(--burgundy)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: 'var(--font-display)',
            }}>עכשיו</span>
          </div>
          {hourlyPicks.map((s, i) => (
            <div key={s.key}>
              {i > 0 && <div style={{ height: 10 }} />}
              <LiveCard icon={s.icon} title={s.title} sub={s.sub} onClick={s.go} />
            </div>
          ))}
        </div>

        <div style={{ height: 24 }}/>
      </div>

      {comingSoon && (
        <ComingSoonModal name={comingSoon} onClose={() => setComingSoon(null)} />
      )}

      {notifOpen && (
        <NotificationsPanel
          items={notifications}
          onClose={() => setNotifOpen(false)}
          onNavigate={handleNotifNavigate}
        />
      )}

      {menuOpen && (
        <ProfileMenu
          userName={userName}
          photoURL={profile?.photoURL || null}
          onClose={() => setMenuOpen(false)}
          onEditProfile={() => { setMenuOpen(false); onGoProfile() }}
          onSettings={() => { setMenuOpen(false); onGoSettings() }}
          onSignOut={async () => {
            setMenuOpen(false)
            try { await signOut() } catch (e) { console.error(e) }
          }}
        />
      )}
    </div>
  )
}

// ── Profile menu (bottom sheet) ───────────────────────────
function ProfileMenu({ userName, photoURL, onClose, onEditProfile, onSettings, onSignOut }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(20,23,42,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-app)',
          borderRadius: '24px 24px 0 0',
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
          width: '100%', maxWidth: 430,
          direction: 'rtl',
        }}
      >
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)',
          margin: '0 auto 18px',
        }}/>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Avatar name={userName} size={56} color="#6B3A4F" photoURL={photoURL} />
          <div>
            <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>
              {userName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
              החשבון שלי
            </div>
          </div>
        </div>

        <button
          onClick={onEditProfile}
          style={{
            width: '100%', textAlign: 'right',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 14, padding: '16px 16px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 24 }}>✏️</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
            עריכת פרופיל
          </span>
          <IconBackRTL size={20} color="#8389A4" />
        </button>

        <button
          onClick={onSettings}
          style={{
            width: '100%', textAlign: 'right',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 14, padding: '16px 16px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 24 }}>⚙️</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
            הגדרות
          </span>
          <IconBackRTL size={20} color="#8389A4" />
        </button>

        <button
          onClick={onSignOut}
          style={{
            width: '100%', textAlign: 'right',
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 14, padding: '16px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 24 }}>🚪</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--danger)' }}>
            התנתק
          </span>
        </button>

        <button onClick={onClose} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
          סגור
        </button>
      </div>
    </div>
  )
}

// ── Room Tile (large, 2-column) — כרטיס בהיר ─────────────────
function RoomTile({ onClick, icon, label, sub, badge, live }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      borderRadius: 20, padding: '16px 16px 14px',
      textAlign: 'right',
      boxShadow: 'var(--shadow-sm)',
      minHeight: 168,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'inherit',
    }}>
      {live && (
        <div style={{
          position: 'absolute', top: 12, insetInlineEnd: 12,
          background: 'var(--burgundy-soft)',
          color: 'var(--burgundy)',
          fontSize: 11, fontWeight: 800,
          padding: '4px 10px', borderRadius: 999,
          display: 'flex', alignItems: 'center', gap: 5,
          letterSpacing: '0.02em',
        }}>
          <span className="live-dot" style={{ width: 6, height: 6 }}/>
          חי
        </div>
      )}

      <div>{icon}</div>

      <div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, marginBottom: 3, letterSpacing: '0.01em' }}>{sub}</div>
        <div className="h-display" style={{ fontSize: 22, lineHeight: 1.05, marginBottom: 6, color: 'var(--ink)' }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.3 }}>{badge}</div>
      </div>
    </button>
  )
}

// ── אריח פיצ'ר לרשת האחידה (דו-טורי) — צבעוני או בהיר (cream) ──
function FeatureTile({ onClick, cream, bg, shadow, nimbus, eyebrow, icon, emoji, title }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: cream ? 'var(--surface)' : bg,
      border: cream ? '1px solid var(--line)' : 'none',
      borderRadius: 20,
      padding: '15px 14px',
      minHeight: 120,
      color: cream ? 'var(--ink)' : '#FBF7EE',
      boxShadow: cream ? 'var(--shadow-sm)' : `0 10px 24px -8px ${shadow || 'rgba(20,23,42,.4)'}`,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'inherit',
    }}>
      {!cream && (
        <div style={{
          position: 'absolute', insetInlineEnd: -28, top: -28,
          width: 104, height: 104, borderRadius: '50%',
          background: `radial-gradient(circle, ${nimbus || 'rgba(255,255,255,.16)'}, transparent 70%)`,
          pointerEvents: 'none',
        }}/>
      )}
      <div style={{ position: 'relative' }}>
        {eyebrow && (
          <div style={{
            fontSize: 10, fontWeight: 800, marginBottom: 3,
            color: '#E8C879', textTransform: 'uppercase', letterSpacing: '0.10em',
            fontFamily: 'var(--font-display)',
          }}>{eyebrow}</div>
        )}
        <div className="h-display" style={{
          fontSize: 19, lineHeight: 1.12,
          color: cream ? 'var(--ink)' : '#FBF7EE', letterSpacing: '-0.01em',
        }}>{title}</div>
      </div>
      <div style={{ alignSelf: 'flex-end', marginTop: 6, position: 'relative' }}>
        {emoji ? <span style={{ fontSize: 46, lineHeight: 1 }}>{emoji}</span> : icon}
      </div>
    </button>
  )
}

// ── Small utility tile (3-column) — כרטיס בהיר ───────────────
function HomeTileSmall({ onClick, icon, label, badge, live }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '18px 10px 14px',
      textAlign: 'center',
      minHeight: 132,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: 'var(--shadow-sm)',
      gap: 8,
      fontFamily: 'inherit',
    }}>
      <div>{icon}</div>
      <div className="h-display" style={{ fontSize: 17, lineHeight: 1, color: 'var(--ink)' }}>{label}</div>
      <div style={{
        fontSize: 12, color: live ? 'var(--live)' : 'var(--ink-3)',
        fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {live && <span className="live-dot" style={{ width: 7, height: 7 }}/>}
        {badge}
      </div>
    </button>
  )
}

// ── Live event card ─────────────────────────────────────────
// ── תג-אייקון צבעוני למשחקים (האייקון לבן — צריך רקע צבעוני) ──
function GameBadge({ id, color }) {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 15,
      background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 10px -2px rgba(20,23,42,.22)',
    }}>
      <GameIcon id={id} size={36} />
    </div>
  )
}

function LiveCard({ icon, color, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '12px 14px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'inherit',
    }}>
      {icon ? (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      ) : (
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px -2px rgba(20,23,42,.18)',
        }}>
          <span className="live-dot" style={{ background: '#E8C879', width: 10, height: 10 }}/>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>{sub}</div>
      </div>
      <IconBackRTL size={20} color="#8389A4" />
    </button>
  )
}

// ── Coming Soon modal ───────────────────────────────────────
function ComingSoonModal({ name, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 24,
          padding: '28px 24px 22px',
          maxWidth: 340, width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12 }}>🚧</div>
        <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>
          {name}
        </div>
        <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.4, fontWeight: 500 }}>
          הפיצ'ר הזה בבנייה ויהיה זמין בקרוב!
        </div>
        <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%' }}>
          הבנתי
        </button>
      </div>
    </div>
  )
}
