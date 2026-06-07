// src/pages/HubPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך הבית — כיוון "יוקרתי / קונסיירז'".
// רקע חול-שנהב חם, מבטא שמפניה-זהב, כרטיסי אבן-חן, גופן Fredoka.
// העיצוב מקור: Claude Design ("ביחד - יוקרתי.html"), מותאם לנתונים החיים.
// גיבוי העיצוב הקודם: _design-backups/2026-06-06_2258_pre-luxe/
// כל הסגנונות מתוחמים תחת .lux-hub כדי לא לדלוף לשאר המסכים.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { setPresence, watchOnlineCount, signOut, markNotificationsSeen, cancelAccountDeletion, getUser } from '../services/firebase.js'
import { useNotifications } from '../hooks/useNotifications.js'
import NotificationsPanel from '../components/NotificationsPanel.jsx'
import Avatar from '../components/Avatar.jsx'
import AppLogo from '../components/AppLogo.jsx'
import { IconBackRTL, IconCoffee, IconPodium, IconLightbulb, IconKitchen, IconGreeting, IconRadio, IconFriends } from '../icons/index.jsx'
import { useRadioStore } from '../stores/radioStore.js'
import { searchStations } from '../services/radio.js'
import { GameIcon } from '../icons/gameIcons.jsx'
import { SEED_RECIPES } from '../data/seedRecipes.js'
import { getOccasion } from '../occasion.js'

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
)
const StarChip = () => (
  <span className="chip"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.2 4.9L19 7l-3 3.8L17 16l-5-2.4L7 16l1-5.2L5 7l4.8-.1L12 2Z" /></svg>חדש</span>
)

export default function HubPage({ onGoMatch, onGoParliament, onGoTips, onGoRecipes, onGoRecipe, onGoRadio, onGoTV, onGoGreeting, onGoProfile, onGoSettings, onGoFriends, onGoGames, onPlayGame, onOpenNotification }) {
  const { profile, authUser, setProfile } = useUserStore()
  const isAdmin = profile?.role === 'admin'
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [cancelingDeletion, setCancelingDeletion] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [now, setNow] = useState(() => new Date())

  // טוען גופן Fredoka פעם אחת
  useEffect(() => {
    const id = 'fredoka-font'
    if (!document.getElementById(id)) {
      const l = document.createElement('link')
      l.id = id; l.rel = 'stylesheet'
      l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@300;400;500;600;700&display=swap'
      document.head.appendChild(l)
    }
  }, [])

  // שעון חי
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // האם החשבון מתוזמן למחיקה (בתוך חלון 48 השעות)?
  const deletionAt = profile?.deletionScheduledAt || null
  const deletionPending = deletionAt && deletionAt > Date.now()
  const deletionDateText = deletionAt
    ? new Date(deletionAt).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''

  const handleCancelDeletion = async () => {
    if (!authUser?.uid) return
    setCancelingDeletion(true)
    await cancelAccountDeletion(authUser.uid)
    try { const fresh = await getUser(authUser.uid); if (fresh) setProfile(fresh) } catch {}
    setCancelingDeletion(false)
  }

  // התראות
  const { items: notifications, unseenCount } = useNotifications(authUser?.uid)
  const openNotifications = () => {
    setNotifOpen(true)
    if (authUser?.uid) markNotificationsSeen(authUser.uid).catch(() => {})
  }
  const handleNotifNavigate = (it) => {
    setNotifOpen(false)
    if (onOpenNotification) onOpenNotification(it)
  }

  const hour = now.getHours()
  const greet = hour < 11 ? 'בוקר טוב'
             : hour < 17 ? 'צהריים טובים'
             : hour < 20 ? 'אחר צהריים טובים'
             : 'ערב טוב'
  const userName = profile?.name || 'אורח'
  const weekday = now.toLocaleDateString('he-IL', { weekday: 'long' })
  const dateStr = `${weekday} · ${now.getDate()} ב${now.toLocaleDateString('he-IL', { month: 'long' })}`
  const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const othersOnline = onlineCount > 1
  const occ = getOccasion(now)   // הזדמנות היום — חג עברי או יום בשבוע

  // נגן תחנת רדיו ישירות מהבית
  const playStationFromStore = useRadioStore(s => s.playStation)
  const playRadio = async (query) => {
    try {
      const list = await searchStations(query)
      if (list && list[0]) { playStationFromStore(list[0]); return }
    } catch {}
    onGoRadio()
  }

  // ─── מאגר "מומלצים לשעה הקרובה" ───
  const GAMES = [
    { id: 'bingo', name: 'בינגו', color: '#4F6B4A' },
    { id: 'sheshbesh', name: 'שש-בש', color: '#7E2C2E' },
    { id: 'checkers', name: 'דמקה', color: '#2C5566' },
    { id: 'chess', name: 'שחמט', color: '#1B2540' },
    { id: 'rummikub', name: 'רמיקוב', color: '#B89048' },
    { id: 'connect4', name: '4 בשורה', color: '#6B3A4F' },
  ]
  const MODE_DEFS = {
    friend: { mode: 'online-friend', label: 'עם חבר קרוב', sub: 'הזמינו חבר למשחק אישי' },
    online: { mode: 'online-random', label: 'מול שחקן ברשת', sub: 'נמצא לכם יריב מחובר עכשיו' },
    ai: { mode: 'ai', label: 'מול המחשב', sub: 'אימון נעים בקצב שלכם' },
    solo: { mode: 'solo', label: 'לבד', sub: 'המספרים עולים אוטומטית' },
  }
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
        cat: 'game',
      }
    })
  )
  const recipeSuggestions = SEED_RECIPES.map((r) => {
    const firstName = (r.author || '').split(' ')[0]
    const ownerInTitle = (r.title || '').includes(' של ')
    return {
      key: `recipe-${r.id}`,
      title: ownerInTitle ? `נסו את ${r.title}` : `נסו את ${r.title} של ${firstName}`,
      sub: `מהמטבח של ${r.author}`,
      icon: <IconKitchen size={48} />,
      go: () => onGoRecipe(`seed-recipe-${r.id}`),
      cat: 'recipe',
    }
  })
  const STATIONS = [
    { name: 'גלגלצ', q: 'Galgalatz', sub: 'הלהיטים של הצבא' },
    { name: 'גלי צה"ל', q: 'Galei Tsahal', sub: 'חדשות ומוזיקה כל היום' },
    { name: 'כאן 88', q: 'Kan 88', sub: 'ג\'אז וישראלית איכותית' },
    { name: 'כאן גימל', q: 'Kan Gimel', sub: 'הזהב של הזמר העברי' },
    { name: 'כאן רשת ב', q: 'Kan Reshet Bet', sub: 'דיבור, אקטואליה ותרבות' },
    { name: '100FM', q: 'Radius 100FM', sub: 'מצעד הלהיטים' },
    { name: 'רדיו קלאסי', q: 'classical', sub: 'יצירות קלאסיות נבחרות' },
    { name: 'שירי זהב', q: 'oldies', sub: 'הקלאסיקות שאוהבים' },
  ]
  const radioSuggestions = STATIONS.map((st, i) => ({
    key: `radio-${i}`,
    title: `הדליקו ${st.name}`,
    sub: st.sub,
    icon: <IconRadio size={48} />,
    go: () => playRadio(st.q),
    cat: 'radio',
  }))
  const STAPLES = [
    { key: 'greeting', title: 'צרו ברכה אישית', sub: 'ברכה יפה למשפחה ולחברים בלחיצה אחת', icon: <IconGreeting size={48} />, go: onGoGreeting, cat: 'staple' },
    { key: 'coffee', title: 'קפה בסלון', sub: 'שיחת וידאו אחד-על-אחד, עכשיו', icon: <IconCoffee size={48} />, go: onGoMatch, cat: 'staple' },
    { key: 'parliament', title: 'הצטרפו לפרלמנט', sub: 'דיון קבוצתי מתחיל עוד מעט', icon: <IconPodium size={48} />, go: onGoParliament, cat: 'staple' },
    { key: 'tips', title: 'עצה חדשה מהחברים', sub: 'טיפ שימושי שכדאי להכיר', icon: <IconLightbulb size={48} />, go: onGoTips, cat: 'staple' },
    { key: 'friends', title: 'מי מהחברים מחובר?', sub: 'הציצו ברשימת החברים שלכם', icon: <IconFriends size={48} />, go: onGoFriends, cat: 'staple' },
  ]
  const SUGGESTIONS = [...gameSuggestions, ...recipeSuggestions, ...radioSuggestions, ...STAPLES]

  const [pickIdx] = useState(() => {
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
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

  // נוכחות + ספירת מחוברים
  useEffect(() => {
    if (!authUser?.uid) return
    setPresence(authUser.uid, 'available').catch(() => {})
    const beat = setInterval(() => {
      if (document.visibilityState !== 'hidden') setPresence(authUser.uid, 'available').catch(() => {})
    }, 60 * 1000)
    const onHide = () => {
      setPresence(authUser.uid, document.visibilityState === 'hidden' ? 'away' : 'available').catch(() => {})
    }
    document.addEventListener('visibilitychange', onHide)
    return () => { clearInterval(beat); document.removeEventListener('visibilitychange', onHide) }
  }, [authUser?.uid])

  useEffect(() => {
    const unsub = watchOnlineCount(count => setOnlineCount(count))
    return () => unsub && unsub()
  }, [])

  return (
    <>
      <div className="scroll-area lux-hub">
        <style>{LUX_CSS}</style>

        <div className="lux-desk">

        {/* ───── Top bar ───── */}
        <header className="bar">
          <div className="brand">
            <span className="logo-slot"><AppLogo size={46} rounded={12} bg="#7E2C2E" bgDeep="#5A1D1E" /></span>
            <div className="bwrap">
              <span className="name">בְּ<b>יחד</b></span>
              <span className="slogan">כל מה שאתם צריכים!</span>
            </div>
          </div>

          <div className="status">
            <div className="ambient">
              <div className="time">{timeStr}</div>
              <div className="meta">{dateStr}</div>
            </div>
            {othersOnline && <div className="live"><span className="d" />{onlineCount} מחוברים</div>}
            <button className="icon-btn" aria-label="התראות" onClick={openNotifications}>
              {unseenCount > 0 && <span className="ndot" />}
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4-1.5 5.5-2.2 6.3-.5.6-.1 1.7.8 1.7h14.8c.9 0 1.3-1.1.8-1.7C19.5 13.5 18 12 18 8a6 6 0 0 0-6-6Zm0 20a2.7 2.7 0 0 0 2.6-2H9.4A2.7 2.7 0 0 0 12 22Z" /></svg>
            </button>
            <button className="av-btn" aria-label="תפריט פרופיל" onClick={() => setMenuOpen(true)}>
              <Avatar name={userName} size={50} color="#6B3A4F" photoURL={profile?.photoURL || null} />
            </button>
          </div>
        </header>

        <div className="wrap">

          {/* באנר מחיקת חשבון */}
          {deletionPending && (
            <div style={{ background: 'rgba(255,255,255,.7)', border: '2px solid var(--danger)', borderRadius: 18, padding: '16px 18px', margin: '20px 0 0' }}>
              <div className="h-display" style={{ fontSize: 18, color: 'var(--danger)', marginBottom: 6 }}>⏳ החשבון מתוזמן למחיקה</div>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 600, lineHeight: 1.6, marginBottom: 14 }}>
                החשבון יימחק בתאריך <strong style={{ color: 'var(--danger)' }}>{deletionDateText}</strong>. אפשר לבטל עכשיו.
              </div>
              <button onClick={handleCancelDeletion} disabled={cancelingDeletion} className="cta-revert">
                {cancelingDeletion ? 'מבטל...' : '✕ בטל את המחיקה'}
              </button>
            </div>
          )}

          {/* באנר אדמין — ספירת מחוברים בזמן אמת (גלוי רק למנהל) */}
          {isAdmin && (
            <div className="admin-live">
              <span className="d" />
              {onlineCount <= 1
                ? 'אתה מחובר — מחכים שעוד יצטרפו'
                : <>יש כעת <b>{onlineCount}</b> אנשים מחוברים</>}
            </div>
          )}

          {/* Hero */}
          <section className="hero">
            <div className="g-label">{greet}</div>
            <h1>{userName}</h1>
            <p className="sub">
              {othersOnline
                ? <>יש עכשיו <b>{onlineCount} אנשים</b> מחוברים ופנויים לשיחה.</>
                : 'מה תרצו לעשות עכשיו? הכול כאן, במקום אחד.'}
            </p>
          </section>

          {/* Greeting spotlight (primary) */}
          <section className="spotlight">
            <button className="greet-card" onClick={onGoGreeting}>
              <div className="badge gold" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /><path d="M12 11.2c-.8-1.2-2.8-1-2.8.6 0 1.2 1.6 2.1 2.8 3.1 1.2-1 2.8-1.9 2.8-3.1 0-1.6-2-1.8-2.8-.6Z" fill="currentColor" stroke="none" /></svg>
              </div>
              <div className="gc-body">
                <div className="kick">הכי אישי</div>
                <h2>צרו ברכה אישית<span className="occ">{occ.label}</span></h2>
                <p>ברכה יפה למשפחה ולחברים — בלחיצה אחת, מוכנה לשליחה לכל מי שאוהבים.</p>
                <div className="chips"><span>יום הולדת שמח</span><span>שבת שלום</span><span>מזל טוב</span><span>חג שמח</span></div>
              </div>
              <span className="cta">בואו נתחיל<Arrow /></span>
            </button>
          </section>

          {/* Featured social */}
          <div className="sec-head"><h2>קרובים אליי</h2><span className="line" /><span className="tag">האנשים שלי</span></div>
          <section className="featured">
            <button className="surface feat" onClick={onGoMatch}>
              <div className="top">
                <div className="badge teal" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2.5a2.5 2.5 0 0 1 0 5H16V9Zm0 1.4v2.2h2.4a1.1 1.1 0 0 0 0-2.2H16Z" /><path d="M5.5 3.2c.7.8.7 1.7 0 2.5M9 3.2c.7.8.7 1.7 0 2.5M12.5 3.2c.7.8.7 1.7 0 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg>
                </div>
                <h3>קפה בסלון</h3>
              </div>
              <p>התאמה אוטומטית לשיחה אחד על אחד — נעים, פשוט, בלי טרחה.</p>
              <div className="foot">
                <span className="pillstat"><span className="d" />{othersOnline ? 'מישהו פנוי עכשיו' : 'התאמה אוטומטית'}</span>
                <span className="arrow"><Arrow /></span>
              </div>
            </button>

            <button className="surface feat" onClick={onGoFriends}>
              <div className="top">
                <div className="badge red" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Zm7 .2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM9 12.6c-3 0-6 1.5-6 4.3V19h12v-2.1c0-2.8-3-4.3-6-4.3Zm7 .2c-.5 0-1 .05-1.5.15 1.2.9 1.9 2.1 1.9 3.65V19h5v-2c0-2.5-2.6-3.9-5.4-4Z" /></svg>
                </div>
                <h3>חברים ומשפחה</h3>
              </div>
              <p>הרשימה שלך — כל מי שיקר לך, במקום אחד מסודר.</p>
              <div className="foot">
                <span className="pillstat" style={{ color: 'var(--ink-faint)' }}>הציצו מי מחובר</span>
                <span className="arrow"><Arrow /></span>
              </div>
            </button>
          </section>

          {/* Jewel features */}
          <div className="sec-head"><h2>מדיה ובידור</h2><span className="line" /><span className="tag">חדש בביחד</span></div>
          <section className="jewels">
            <button className="jewel radio" onClick={onGoRadio}>
              <div className="top">
                <div className="badge ghost" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3-9 4" /><rect x="3" y="7" width="18" height="13" rx="2.5" /><circle cx="16" cy="13.5" r="3.2" /><path d="M7 11h2" /><path d="M7 16h2" /></svg>
                </div>
                <StarChip />
              </div>
              <h3>רדיו</h3>
              <p>תחנות ישראליות ומכל העולם — האזינו תוך כדי תנועה.</p>
              <div className="foot">
                <span className="arrow"><Arrow /></span>
                <div className="eq" aria-hidden="true"><span /><span /><span /><span /></div>
                <span>האזנה חיה</span>
              </div>
            </button>

            <button className="jewel tv" onClick={onGoTV}>
              <div className="top">
                <div className="badge ghost" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="m8 3 4 4 4-4" /><path d="M11 11.5v3l2.5-1.5-2.5-1.5Z" fill="currentColor" stroke="none" /></svg>
                </div>
                <StarChip />
              </div>
              <h3>טלוויזיה</h3>
              <p>ערוצים ישראליים ומכל העולם — לצפייה ישירה.</p>
              <div className="foot">
                <span className="arrow"><Arrow /></span>
                <span>ערוצים נבחרים</span>
              </div>
            </button>

            <button className="jewel games" onClick={onGoGames}>
              <div className="top">
                <div className="badge ghost" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.9 3.7A2.4 2.4 0 0 1 16.3 18l-1.6-2.2a2 2 0 0 0-1.6-.8h-2.2a2 2 0 0 0-1.6.8L7.7 18a2.4 2.4 0 0 1-3.7-1.4l-.9-3.7A4 4 0 0 1 7 8Z" /><path d="M8 11v2.4M6.8 12.2h2.4" /><circle cx="15.5" cy="11.5" r=".5" fill="currentColor" /><circle cx="17" cy="13" r=".5" fill="currentColor" /></svg>
                </div>
                <StarChip />
              </div>
              <h3>זירת המשחקים</h3>
              <p>בינגו, שש-בש, שחמט ועוד — עם חברים, מקוון.</p>
              <div className="foot">
                <span className="arrow"><Arrow /></span>
                <span>שחקו עכשיו</span>
              </div>
            </button>
          </section>

          {/* Small tiles */}
          <div className="sec-head"><h2>עוד בביחד</h2><span className="line" /></div>
          <section className="tiles">
            <button className="surface tile" onClick={onGoParliament}>
              <div className="badge red" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16" /><path d="M5 20V10M9.3 20V10M14.7 20V10M19 20V10" /><path d="M3.5 10h17L12 4 3.5 10Z" fill="currentColor" stroke="none" /></svg>
              </div>
              <div className="body"><h3>הפרלמנט</h3><p>דיון קבוצתי חי</p></div>
            </button>
            <button className="surface tile" onClick={onGoRecipes}>
              <div className="badge teal" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z" /><path d="M2.5 11h19" /><path d="M9 7c0-1 .8-1.4.8-2.4M12 7c0-1 .8-1.4.8-2.4M15 7c0-1 .8-1.4.8-2.4" /></svg>
              </div>
              <div className="body"><h3>מתכונים</h3><p>מטבח של חברים</p></div>
            </button>
            <button className="surface tile" onClick={onGoTips}>
              <div className="badge gold" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.5.4.8 1 .8 1.6V16h6v-.8c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" fill="currentColor" stroke="none" /></svg>
              </div>
              <div className="body"><h3>עצות</h3><p>טיפים מהחברים</p></div>
            </button>
          </section>

          {/* Recommendations */}
          <div className="sec-head"><h2>מומלצים לשעה הקרובה</h2><span className="line" /><span className="tag">עכשיו</span></div>
          <section className="recs">
            {hourlyPicks.map(s => (
              <button key={s.key} className="surface rec" onClick={s.go}>
                <span className="picon">{s.icon}</span>
                <div className="body"><h3>{s.title}</h3><p>{s.sub}</p></div>
                <span className="arrow"><Arrow /></span>
              </button>
            ))}
          </section>

          <div style={{ height: 30 }} />
        </div>
        </div>{/* /lux-desk */}

        <div className="lux-mob">
          <div className="m-brand">
            <span className="logo-slot"><AppLogo size={42} rounded={11} bg="#7E2C2E" bgDeep="#5A1D1E" /></span>
            <div className="bwrap">
              <span className="name">בְּ<b>יחד</b></span>
              <span className="slogan">כל מה שאתם צריכים!</span>
            </div>
            <button className="m-bell" aria-label="התראות" onClick={openNotifications}>
              {unseenCount > 0 && <span className="nd" />}
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6c0 4-1.5 5.5-2.2 6.3-.5.6-.1 1.7.8 1.7h14.8c.9 0 1.3-1.1.8-1.7C19.5 13.5 18 12 18 8a6 6 0 0 0-6-6Zm0 20a2.7 2.7 0 0 0 2.6-2H9.4A2.7 2.7 0 0 0 12 22Z" /></svg>
            </button>
          </div>

          <div className="m-greet">
            <button className="m-av" aria-label="תפריט פרופיל" onClick={() => setMenuOpen(true)}>
              <Avatar name={userName} size={58} color="#6B3A4F" photoURL={profile?.photoURL || null} />
            </button>
            <div>
              <div className="gl">{greet}</div>
              <h1>{userName}</h1>
            </div>
          </div>
          <p className="m-sub">{othersOnline ? <>יש עכשיו <b>{onlineCount} אנשים</b> מחוברים ופנויים לשיחה.</> : 'מה תרצו לעשות עכשיו? הכול כאן, במקום אחד.'}</p>
          {!isAdmin && othersOnline && <div className="m-live"><span className="d" />יש כעת {onlineCount} מחוברים</div>}
          {isAdmin && (
            <div className="admin-live">
              <span className="d" />
              {onlineCount <= 1
                ? 'אתה מחובר — מחכים שעוד יצטרפו'
                : <>יש כעת <b>{onlineCount}</b> אנשים מחוברים</>}
            </div>
          )}

          <button className="m-spot" onClick={onGoGreeting}>
            <div className="row">
              <div className="badge gold" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /><path d="M12 11.2c-.8-1.2-2.8-1-2.8.6 0 1.2 1.6 2.1 2.8 3.1 1.2-1 2.8-1.9 2.8-3.1 0-1.6-2-1.8-2.8-.6Z" fill="currentColor" stroke="none" /></svg></div>
              <div>
                <div className="kick">הכי אישי</div>
                <h3>צרו ברכה אישית<span className="occ">{occ.label}</span></h3>
              </div>
            </div>
            <p>ברכה יפה ומרגשת למשפחה ולחברים — בלחיצה אחת, מוכנה לשליחה.</p>
            <div className="chips"><span>יום הולדת שמח</span><span>שבת שלום</span><span>מזל טוב</span></div>
            <span className="cta">בואו נתחיל<Arrow /></span>
          </button>

          <div className="m-sec"><h2>קרובים אליי</h2><span className="ln" /><span className="tg">האנשים שלי</span></div>
          <div className="m-duo">
            <button className="surface" onClick={onGoMatch}>
              <div className="badge teal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2.5a2.5 2.5 0 0 1 0 5H16V9Zm0 1.4v2.2h2.4a1.1 1.1 0 0 0 0-2.2H16Z" /><path d="M5.5 3.2c.7.8.7 1.7 0 2.5M9 3.2c.7.8.7 1.7 0 2.5M12.5 3.2c.7.8.7 1.7 0 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg></div>
              <div className="kik">אחד על אחד</div>
              <h3>קפה בסלון</h3>
              {othersOnline ? <div className="pst"><span className="d" />מישהו פנוי עכשיו</div> : <p>התאמה אוטומטית</p>}
            </button>
            <button className="surface" onClick={onGoFriends}>
              <div className="badge red" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Zm7 .2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM9 12.6c-3 0-6 1.5-6 4.3V19h12v-2.1c0-2.8-3-4.3-6-4.3Zm7 .2c-.5 0-1 .05-1.5.15 1.2.9 1.9 2.1 1.9 3.65V19h5v-2c0-2.5-2.6-3.9-5.4-4Z" /></svg></div>
              <div className="kik">הרשימה שלי</div>
              <h3>חברים ומשפחה</h3>
              <p>החברים שלי</p>
            </button>
          </div>

          <div className="m-sec"><h2>מדיה ובידור</h2><span className="ln" /><span className="tg">חדש בביחד</span></div>
          <div>
            <button className="m-jewel radio" onClick={onGoRadio}>
              <div className="badge ghost" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3-9 4" /><rect x="3" y="7" width="18" height="13" rx="2.5" /><circle cx="16" cy="13.5" r="3.2" /><path d="M7 11h2" /><path d="M7 16h2" /></svg></div>
              <div className="jb"><StarChip /><h3>רדיו</h3><p>תחנות ישראליות ומכל העולם</p></div>
              <span className="arrow"><Arrow /></span>
            </button>
            <button className="m-jewel tv" onClick={onGoTV}>
              <div className="badge ghost" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="m8 3 4 4 4-4" /><path d="M11 11.5v3l2.5-1.5-2.5-1.5Z" fill="currentColor" stroke="none" /></svg></div>
              <div className="jb"><StarChip /><h3>טלוויזיה</h3><p>ערוצים מכל העולם, לצפייה ישירה</p></div>
              <span className="arrow"><Arrow /></span>
            </button>
            <button className="m-jewel games" onClick={onGoGames}>
              <div className="badge ghost" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.9 3.7A2.4 2.4 0 0 1 16.3 18l-1.6-2.2a2 2 0 0 0-1.6-.8h-2.2a2 2 0 0 0-1.6.8L7.7 18a2.4 2.4 0 0 1-3.7-1.4l-.9-3.7A4 4 0 0 1 7 8Z" /><path d="M8 11v2.4M6.8 12.2h2.4" /><circle cx="15.5" cy="11.5" r=".5" fill="currentColor" /><circle cx="17" cy="13" r=".5" fill="currentColor" /></svg></div>
              <div className="jb"><StarChip /><h3>זירת המשחקים</h3><p>בינגו, שש-בש, שחמט — עם חברים</p></div>
              <span className="arrow"><Arrow /></span>
            </button>
          </div>

          <div className="m-sec"><h2>עוד בביחד</h2><span className="ln" /></div>
          <div className="m-trio">
            <button className="surface" onClick={onGoParliament}>
              <div className="badge red" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16" /><path d="M5 20V10M9.3 20V10M14.7 20V10M19 20V10" /><path d="M3.5 10h17L12 4 3.5 10Z" fill="currentColor" stroke="none" /></svg></div>
              <h3>הפרלמנט</h3><p>דיון חי</p>
            </button>
            <button className="surface" onClick={onGoRecipes}>
              <div className="badge teal" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z" /><path d="M2.5 11h19" /><path d="M9 7c0-1 .8-1.4.8-2.4M12 7c0-1 .8-1.4.8-2.4M15 7c0-1 .8-1.4.8-2.4" /></svg></div>
              <h3>מתכונים</h3><p>מטבח של חברים</p>
            </button>
            <button className="surface" onClick={onGoTips}>
              <div className="badge gold" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.8 10.6c.5.4.8 1 .8 1.6V16h6v-.8c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" fill="currentColor" stroke="none" /></svg></div>
              <h3>עצות</h3><p>טיפים מהחברים</p>
            </button>
          </div>

          <div className="m-sec"><h2>מומלצים לשעה הקרובה</h2><span className="ln" /><span className="tg">עכשיו</span></div>
          <div>
            {hourlyPicks.map(s => (
              <button key={s.key} className="surface m-rec" onClick={s.go}>
                <span className="m-recicon">{s.icon}</span>
                <div className="rb"><h3>{s.title}</h3><p>{s.sub}</p></div>
                <span className="arrow"><Arrow /></span>
              </button>
            ))}
          </div>

          <div style={{ height: 20 }} />
        </div>
      </div>

      {notifOpen && (
        <NotificationsPanel items={notifications} onClose={() => setNotifOpen(false)} onNavigate={handleNotifNavigate} />
      )}
      {menuOpen && (
        <ProfileMenu
          userName={userName}
          photoURL={profile?.photoURL || null}
          onClose={() => setMenuOpen(false)}
          onEditProfile={() => { setMenuOpen(false); onGoProfile() }}
          onSettings={() => { setMenuOpen(false); onGoSettings() }}
          onSignOut={async () => { setMenuOpen(false); try { await signOut() } catch (e) { console.error(e) } }}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// סגנונות מתוחמים תחת .lux-hub (ערכת "יוקרתי" בהירה — שנהב/זהב)
// ─────────────────────────────────────────────────────────────
const LUX_CSS = `
.lux-hub{
  --bg:#e6dac2; --bg-2:#f1e7d4; --surface:#f6eedc; --surface-2:#fcf5e6;
  --hair:rgba(160,126,60,.30); --hair-soft:rgba(160,126,60,.16);
  --ink:#2c271f; --ink-soft:#6c6150; --ink-faint:#9a8e77;
  --gold:#d8b878; --gold-2:#b8924a; --gold-deep:#856828;
  --teal-bg1:#245c66; --teal-bg2:#143942; --plum-bg1:#5d2745; --plum-bg2:#371826;
  --red-bg1:#843333; --red-bg2:#461d1d; --terra:#d8956c;
  --r-xl:28px; --gap:24px; --pad:26px;
  --glow:0 1px 2px rgba(74,52,24,.06), 0 22px 46px -24px rgba(74,52,24,.30);
  font-family:'Fredoka', system-ui, sans-serif; color:var(--ink);
  background:
    radial-gradient(900px 560px at 92% -6%, rgba(184,146,74,.22), transparent 58%),
    radial-gradient(820px 680px at 4% 104%, rgba(44,107,118,.10), transparent 56%),
    linear-gradient(180deg, var(--bg-2), var(--bg));
}
.lux-hub *{ box-sizing:border-box; }
.lux-hub button{ font-family:inherit; cursor:pointer; border:none; }
.lux-hub .cta-revert{ width:100%; padding:14px; border-radius:14px; background:var(--danger); color:#fff; font-weight:700; font-size:1rem; }
.lux-hub .wrap{ position:relative; z-index:1; max-width:1400px; margin:0 auto; padding:0 clamp(16px,4vw,52px) 70px; }

.lux-hub .bar{ position:sticky; top:0; z-index:30; display:flex; align-items:center; justify-content:space-between; gap:18px;
  padding:14px clamp(16px,4vw,52px); background:linear-gradient(180deg, rgba(244,236,214,.92), rgba(244,236,214,.6));
  backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid var(--hair); }
.lux-hub .brand{ display:flex; align-items:center; gap:12px; }
.lux-hub .mark{ width:48px; height:48px; border-radius:14px; flex:none; display:grid; place-items:center;
  background:linear-gradient(150deg, var(--gold), var(--gold-deep)); color:#fff8ee;
  box-shadow:0 6px 18px -8px rgba(184,146,74,.6), inset 0 1px 0 rgba(255,255,255,.4); }
.lux-hub .mark svg{ width:27px; height:27px; }
.lux-hub .logo-slot{ width:46px; height:46px; flex:none; border-radius:12px; box-shadow:var(--glow); overflow:hidden; display:grid; place-items:center; }
.lux-hub .lux-mob .logo-slot{ width:42px; height:42px; border-radius:11px; }
.lux-hub .bwrap{ display:flex; flex-direction:column; line-height:1.05; }
.lux-hub .name{ font-weight:700; font-size:1.55rem; }
.lux-hub .name b{ color:var(--gold-2); font-weight:700; }
.lux-hub .slogan{ font-size:.8rem; color:var(--ink-faint); font-weight:500; margin-top:2px; }
.lux-hub .status{ display:flex; align-items:center; gap:14px; }
.lux-hub .ambient{ text-align:center; line-height:1.15; }
.lux-hub .ambient .time{ font-size:1.15rem; font-weight:700; font-variant-numeric:tabular-nums; }
.lux-hub .ambient .meta{ font-size:.8rem; color:var(--ink-faint); }
.lux-hub .live{ display:flex; align-items:center; gap:9px; padding:9px 15px; border-radius:999px;
  background:rgba(94,115,85,.13); border:1px solid rgba(94,115,85,.42); color:#4c6045; font-weight:600; font-size:.92rem; }
.lux-hub .live .d{ width:9px; height:9px; border-radius:50%; background:#7a9663; box-shadow:0 0 8px 1px rgba(122,150,99,.7); }
.lux-hub .admin-live{ display:flex; align-items:center; justify-content:center; gap:10px; margin:20px 0 0; padding:13px 18px; border-radius:16px; background:linear-gradient(135deg, rgba(94,115,85,.16), rgba(79,107,74,.10)); border:1px solid rgba(94,115,85,.45); color:#4c6045; font-weight:600; font-size:1.02rem; text-align:center; }
.lux-hub .admin-live b{ font-weight:700; color:#3c4f37; }
.lux-hub .admin-live .d{ width:11px; height:11px; border-radius:50%; background:#7a9663; animation:adminPulse 1.6s infinite; flex:none; }
@keyframes adminPulse{ 0%{ box-shadow:0 0 0 0 rgba(122,150,99,.55); } 70%{ box-shadow:0 0 0 10px rgba(122,150,99,0); } 100%{ box-shadow:0 0 0 0 rgba(122,150,99,0); } }
@media (prefers-reduced-motion: reduce){ .lux-hub .admin-live .d{ animation:none; } }
.lux-hub .icon-btn{ width:50px; height:50px; border-radius:50%; border:1px solid var(--hair); background:var(--surface);
  color:var(--gold-2); display:grid; place-items:center; position:relative; flex:none; }
.lux-hub .icon-btn svg{ width:23px; height:23px; }
.lux-hub .icon-btn .ndot{ position:absolute; top:9px; right:11px; width:11px; height:11px; border-radius:50%; background:var(--terra); box-shadow:0 0 0 3px var(--bg-2); }
.lux-hub .av-btn{ width:50px; height:50px; border-radius:50%; flex:none; padding:0; background:none; box-shadow:0 0 0 2px var(--gold); overflow:hidden; }

.lux-hub .hero{ padding:38px 4px 24px; }
.lux-hub .hero .g-label{ font-size:1.05rem; color:var(--gold-2); letter-spacing:3px; font-weight:600; }
.lux-hub .hero h1{ font-weight:700; font-size:clamp(2.3rem,5vw,3.4rem); margin:6px 0 0; line-height:1; }
.lux-hub .hero .sub{ margin-top:12px; font-size:1.18rem; color:var(--ink-soft); }
.lux-hub .hero .sub b{ color:var(--ink); font-weight:700; }

.lux-hub .sec-head{ display:flex; align-items:baseline; gap:12px; margin:38px 4px 16px; }
.lux-hub .sec-head h2{ font-weight:700; font-size:1.45rem; margin:0; }
.lux-hub .sec-head .line{ flex:1; height:1px; background:linear-gradient(90deg, var(--hair), transparent); }
.lux-hub .sec-head .tag{ font-size:.82rem; color:var(--gold-2); letter-spacing:2px; font-weight:600; }

.lux-hub .badge{ border-radius:18px; display:grid; place-items:center; flex:none; position:relative; }
.lux-hub .badge svg{ width:52%; height:52%; }
.lux-hub .badge.teal{ background:linear-gradient(150deg, var(--teal-bg1), var(--teal-bg2)); box-shadow:inset 0 0 0 1px rgba(90,166,176,.45), 0 0 26px -6px rgba(90,166,176,.6); color:#dff0f1; }
.lux-hub .badge.plum{ background:linear-gradient(150deg, var(--plum-bg1), var(--plum-bg2)); box-shadow:inset 0 0 0 1px rgba(192,124,156,.45), 0 0 26px -6px rgba(192,124,156,.55); color:#f6e3ec; }
.lux-hub .badge.red{ background:linear-gradient(150deg, var(--red-bg1), var(--red-bg2)); box-shadow:inset 0 0 0 1px rgba(209,138,120,.45), 0 0 26px -6px rgba(209,138,120,.5); color:#f7e5df; }
.lux-hub .badge.gold{ background:linear-gradient(150deg, var(--gold-2), var(--gold-deep)); box-shadow:inset 0 0 0 1px rgba(220,184,120,.5), 0 0 26px -6px rgba(220,184,120,.55); color:#fff8ee; }
.lux-hub .badge.ghost{ background:rgba(255,255,255,.14); box-shadow:inset 0 0 0 1px rgba(255,255,255,.3); color:#fff; }

.lux-hub .surface{ background:linear-gradient(160deg, var(--surface-2), var(--surface)); border:1px solid var(--hair);
  border-radius:var(--r-xl); box-shadow:var(--glow); position:relative; overflow:hidden; color:inherit; text-align:right; width:100%; transition:transform .2s ease; }
.lux-hub .surface:hover{ transform:translateY(-3px); }
.lux-hub .arrow{ flex:none; width:46px; height:46px; border-radius:50%; display:grid; place-items:center; color:var(--gold-2); background:rgba(184,146,74,.12); border:1px solid var(--hair); }
.lux-hub .arrow svg{ width:22px; height:22px; }

.lux-hub .featured{ display:grid; grid-template-columns:1fr 1fr; gap:var(--gap); }
.lux-hub .feat{ padding:var(--pad); min-height:200px; display:flex; flex-direction:column; }
.lux-hub .feat .top{ display:flex; align-items:center; gap:16px; }
.lux-hub .feat .badge{ width:72px; height:72px; }
.lux-hub .feat h3{ font-weight:700; font-size:1.8rem; margin:0; flex:1; }
.lux-hub .feat p{ margin:14px 0 0; color:var(--ink-soft); font-size:1.05rem; line-height:1.45; }
.lux-hub .feat .foot{ margin-top:auto; padding-top:18px; display:flex; align-items:center; justify-content:space-between; gap:14px; }
.lux-hub .feat .pillstat{ display:flex; align-items:center; gap:9px; font-size:.98rem; font-weight:600; color:#4c6045; }
.lux-hub .feat .pillstat .d{ width:9px; height:9px; border-radius:50%; background:#7a9663; box-shadow:0 0 8px 1px rgba(122,150,99,.7); }

.lux-hub .jewels{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--gap); }
.lux-hub .jewel{ padding:var(--pad); min-height:220px; display:flex; flex-direction:column; border:1px solid var(--hair); border-radius:var(--r-xl);
  position:relative; overflow:hidden; color:#f6efe2; text-align:right; width:100%; box-shadow:var(--glow); transition:transform .2s ease; }
.lux-hub .jewel:hover{ transform:translateY(-3px); }
.lux-hub .jewel::after{ content:""; position:absolute; inset:0; background:radial-gradient(120% 90% at 85% 0%, rgba(255,255,255,.12), transparent 55%); pointer-events:none; }
.lux-hub .jewel.radio{ background:linear-gradient(155deg, var(--plum-bg1), var(--plum-bg2)); box-shadow:var(--glow), 0 0 50px -24px rgba(192,124,156,.8); }
.lux-hub .jewel.tv{ background:linear-gradient(155deg, var(--teal-bg1), var(--teal-bg2)); box-shadow:var(--glow), 0 0 50px -24px rgba(90,166,176,.8); }
.lux-hub .jewel.games{ background:linear-gradient(155deg, var(--red-bg1), var(--red-bg2)); box-shadow:var(--glow), 0 0 50px -24px rgba(209,138,120,.8); }
.lux-hub .jewel .top{ display:flex; align-items:center; justify-content:space-between; }
.lux-hub .jewel .badge{ width:66px; height:66px; }
.lux-hub .jewel .chip{ display:flex; align-items:center; gap:7px; font-weight:700; font-size:.82rem; letter-spacing:1px; color:#241d12;
  background:linear-gradient(150deg, var(--gold), var(--gold-2)); padding:6px 13px; border-radius:999px; }
.lux-hub .jewel .chip svg{ width:13px; height:13px; }
.lux-hub .jewel h3{ font-weight:700; font-size:1.9rem; margin:22px 0 0; }
.lux-hub .jewel p{ margin:9px 0 0; font-size:1.02rem; line-height:1.45; opacity:.9; }
.lux-hub .jewel .foot{ margin-top:auto; padding-top:18px; display:flex; align-items:center; gap:12px; font-weight:600; }
.lux-hub .jewel .arrow{ background:rgba(255,255,255,.16); border-color:rgba(255,255,255,.24); color:#fff; }
.lux-hub .eq{ display:flex; align-items:flex-end; gap:4px; height:22px; }
.lux-hub .eq span{ width:4px; background:rgba(255,255,255,.7); border-radius:2px; animation:luxeq 1.1s ease-in-out infinite; }
.lux-hub .eq span:nth-child(1){ height:40%; animation-delay:0s; }
.lux-hub .eq span:nth-child(2){ height:95%; animation-delay:.2s; }
.lux-hub .eq span:nth-child(3){ height:60%; animation-delay:.4s; }
.lux-hub .eq span:nth-child(4){ height:80%; animation-delay:.1s; }
@keyframes luxeq{ 0%,100%{ transform:scaleY(.45); } 50%{ transform:scaleY(1); } }
@media (prefers-reduced-motion: reduce){ .lux-hub .eq span{ animation:none; } }

.lux-hub .tiles{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--gap); }
.lux-hub .tile{ padding:24px var(--pad); display:flex; align-items:center; gap:16px; }
.lux-hub .tile .badge{ width:60px; height:60px; }
.lux-hub .tile .body{ flex:1; min-width:0; }
.lux-hub .tile h3{ font-weight:700; font-size:1.3rem; margin:0 0 2px; }
.lux-hub .tile p{ margin:0; color:var(--ink-faint); font-size:.92rem; }

.lux-hub .recs{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--gap); }
.lux-hub .rec{ padding:18px var(--pad); display:flex; align-items:center; gap:14px; }
.lux-hub .rec .picon{ width:58px; height:58px; border-radius:16px; flex:none; display:grid; place-items:center; background:rgba(184,146,74,.12); border:1px solid var(--hair); overflow:hidden; }
.lux-hub .rec .body{ flex:1; min-width:0; }
.lux-hub .rec h3{ font-weight:700; font-size:1.12rem; margin:0 0 3px; line-height:1.2; }
.lux-hub .rec p{ margin:0; color:var(--ink-faint); font-size:.92rem; }

.lux-hub .spotlight{ margin-top:6px; }
.lux-hub .greet-card{ position:relative; overflow:hidden; border-radius:var(--r-xl); padding:32px var(--pad); display:flex; align-items:center; gap:26px;
  text-align:right; width:100%; color:#f9f0e3; border:1px solid var(--hair);
  background:linear-gradient(120deg, #5b2644 0%, #813c46 46%, #ac6440 100%);
  box-shadow:var(--glow), 0 0 64px -26px rgba(172,100,64,.75); transition:transform .2s ease; }
.lux-hub .greet-card:hover{ transform:translateY(-3px); }
.lux-hub .greet-card::after{ content:""; position:absolute; inset:0; background:radial-gradient(120% 130% at 90% -15%, rgba(255,255,255,.18), transparent 52%); pointer-events:none; }
.lux-hub .greet-card .badge{ width:86px; height:86px; border-radius:24px; box-shadow:inset 0 0 0 1px rgba(255,255,255,.25), 0 0 30px -6px rgba(0,0,0,.4); }
.lux-hub .greet-card .gc-body{ flex:1; position:relative; z-index:1; min-width:0; }
.lux-hub .greet-card .kick{ font-size:.86rem; letter-spacing:4px; color:#f3dcab; font-weight:700; }
.lux-hub .greet-card .occ{ display:block; color:#f3dcab; font-weight:700; font-size:1.35rem; margin-top:4px; }
.lux-hub .greet-card h2{ font-weight:700; font-size:clamp(1.8rem,3.6vw,2.5rem); margin:7px 0 0; line-height:1.05; color:#fff; }
.lux-hub .greet-card p{ margin:11px 0 0; font-size:1.1rem; line-height:1.5; opacity:.92; }
.lux-hub .greet-card .chips{ display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; }
.lux-hub .greet-card .chips span{ font-size:.95rem; padding:8px 16px; border-radius:999px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.24); white-space:nowrap; }
.lux-hub .greet-card .cta{ flex:none; align-self:center; display:flex; align-items:center; gap:12px;
  background:linear-gradient(150deg, var(--gold), var(--gold-2)); color:#241d12; font-weight:700; font-size:1.15rem; padding:16px 26px; border-radius:18px;
  box-shadow:0 12px 26px -10px rgba(184,146,74,.85), inset 0 1px 0 rgba(255,255,255,.4); }
.lux-hub .greet-card .cta svg{ width:22px; height:22px; }

@media (max-width:1080px){
  .lux-hub .greet-card{ flex-direction:column; align-items:flex-start; }
  .lux-hub .greet-card .cta{ width:100%; justify-content:center; align-self:stretch; }
  .lux-hub .featured{ grid-template-columns:1fr; }
  .lux-hub .jewels{ grid-template-columns:1fr; }
  .lux-hub .tiles{ grid-template-columns:1fr 1fr; }
  .lux-hub .recs{ grid-template-columns:1fr; }
  .lux-hub .ambient{ display:none; }
}
@media (max-width:560px){
  .lux-hub .tiles{ grid-template-columns:1fr; }
  .lux-hub .bar{ gap:10px; }
}

/* Mobile dedicated layout (max 1080) */
.lux-hub .lux-mob{ display:none; }
@media (max-width:1080px){
  .lux-hub .lux-desk{ display:none; }
  .lux-hub .lux-mob{ display:block; padding:18px 16px 36px; }
}
.lux-hub .lux-mob .surface{ border-radius:20px; }
.lux-hub .lux-mob .badge{ border-radius:15px; }
.lux-hub .lux-mob .arrow{ width:38px; height:38px; }
.lux-hub .lux-mob .arrow svg{ width:18px; height:18px; }
.lux-hub .m-brand{ display:flex; align-items:center; gap:11px; }
.lux-hub .m-brand .mark{ width:42px; height:42px; border-radius:12px; flex:none; display:grid; place-items:center; background:linear-gradient(150deg, var(--gold), var(--gold-deep)); color:#fff8ee; box-shadow:var(--glow); }
.lux-hub .m-brand .mark svg{ width:24px; height:24px; }
.lux-hub .m-brand .bwrap{ display:flex; flex-direction:column; line-height:1.05; flex:1; }
.lux-hub .m-brand .name{ font-weight:700; font-size:1.3rem; }
.lux-hub .m-brand .name b{ color:var(--gold-2); }
.lux-hub .m-brand .slogan{ font-size:.74rem; color:var(--ink-faint); margin-top:2px; }
.lux-hub .m-bell{ width:42px; height:42px; border-radius:50%; border:1px solid var(--hair); background:var(--surface); color:var(--gold-2); display:grid; place-items:center; position:relative; flex:none; }
.lux-hub .m-bell svg{ width:21px; height:21px; }
.lux-hub .m-bell .nd{ position:absolute; top:8px; right:9px; width:9px; height:9px; border-radius:50%; background:var(--terra); box-shadow:0 0 0 2.5px var(--bg-2); }
.lux-hub .m-greet{ display:flex; align-items:center; gap:14px; margin-top:22px; }
.lux-hub .m-greet .m-av{ width:58px; height:58px; flex:none; border-radius:50%; padding:0; background:none; box-shadow:0 0 0 2px var(--gold), var(--glow); overflow:hidden; }
.lux-hub .m-greet .gl{ font-size:.92rem; color:var(--gold-2); letter-spacing:2px; font-weight:600; }
.lux-hub .m-greet h1{ font-weight:700; font-size:1.95rem; margin:2px 0 0; line-height:1; }
.lux-hub .m-sub{ margin:14px 2px 0; font-size:1rem; color:var(--ink-soft); line-height:1.45; }
.lux-hub .m-sub b{ color:var(--ink); font-weight:700; }
.lux-hub .m-live{ display:flex; align-items:center; gap:9px; margin-top:16px; padding:11px 16px; border-radius:14px; background:rgba(94,115,85,.12); border:1px solid rgba(94,115,85,.4); color:#4c6045; font-weight:600; font-size:.98rem; }
.lux-hub .m-live .d{ width:9px; height:9px; border-radius:50%; background:#7a9663; box-shadow:0 0 8px 1px rgba(122,150,99,.7); }
.lux-hub .m-sec{ display:flex; align-items:center; gap:10px; margin:26px 2px 13px; }
.lux-hub .m-sec h2{ font-weight:700; font-size:1.2rem; margin:0; }
.lux-hub .m-sec .ln{ flex:1; height:1px; background:linear-gradient(90deg, var(--hair), transparent); }
.lux-hub .m-sec .tg{ font-size:.74rem; color:var(--gold-2); letter-spacing:1.5px; font-weight:600; }
.lux-hub .m-spot{ position:relative; overflow:hidden; border-radius:22px; padding:22px 20px; color:#f9f0e3; border:1px solid var(--hair); margin-top:6px; width:100%; text-align:right; background:linear-gradient(120deg,#5b2644 0%,#813c46 48%,#ac6440 100%); box-shadow:var(--glow), 0 0 50px -24px rgba(172,100,64,.7); display:block; }
.lux-hub .m-spot::after{ content:""; position:absolute; inset:0; background:radial-gradient(120% 120% at 88% -10%, rgba(255,255,255,.18), transparent 52%); pointer-events:none; }
.lux-hub .m-spot .row{ display:flex; align-items:center; gap:14px; position:relative; z-index:1; }
.lux-hub .m-spot .badge{ width:60px; height:60px; border-radius:18px; box-shadow:inset 0 0 0 1px rgba(255,255,255,.25); }
.lux-hub .m-spot .kick{ font-size:.76rem; letter-spacing:3px; color:#f3dcab; font-weight:700; }
.lux-hub .m-spot h3{ font-weight:700; font-size:1.5rem; margin:4px 0 0; line-height:1.1; color:#fff; }
.lux-hub .m-spot .occ{ display:block; color:#f3dcab; font-weight:700; font-size:1.05rem; margin-top:3px; }
.lux-hub .m-spot p{ margin:12px 0 0; font-size:.98rem; line-height:1.5; opacity:.92; position:relative; z-index:1; }
.lux-hub .m-spot .chips{ display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; position:relative; z-index:1; }
.lux-hub .m-spot .chips span{ font-size:.85rem; padding:6px 13px; border-radius:999px; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.24); }
.lux-hub .m-spot .cta{ display:flex; align-items:center; justify-content:center; gap:10px; margin-top:18px; position:relative; z-index:1; background:linear-gradient(150deg, var(--gold), var(--gold-2)); color:#241d12; font-weight:700; font-size:1.08rem; padding:15px; border-radius:15px; box-shadow:inset 0 1px 0 rgba(255,255,255,.4); }
.lux-hub .m-spot .cta svg{ width:21px; height:21px; }
.lux-hub .m-duo{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.lux-hub .m-duo .surface{ padding:18px 14px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:4px; }
.lux-hub .m-duo .badge{ width:54px; height:54px; margin-bottom:6px; }
.lux-hub .m-duo h3{ font-weight:700; font-size:1.18rem; margin:0; }
.lux-hub .m-duo .kik{ font-size:.76rem; color:var(--ink-faint); font-weight:600; }
.lux-hub .m-duo p{ margin:0; font-size:.82rem; color:var(--ink-soft); }
.lux-hub .m-duo .pst{ margin-top:4px; font-size:.78rem; color:#4c6045; font-weight:600; display:flex; align-items:center; gap:5px; }
.lux-hub .m-duo .pst .d{ width:6px; height:6px; border-radius:50%; background:#7a9663; }
.lux-hub .m-jewel{ position:relative; overflow:hidden; border-radius:20px; padding:18px; display:flex; align-items:center; gap:14px; color:#f6efe2; border:1px solid var(--hair); width:100%; text-align:right; box-shadow:var(--glow); margin-bottom:14px; }
.lux-hub .m-jewel:last-child{ margin-bottom:0; }
.lux-hub .m-jewel::after{ content:""; position:absolute; inset:0; background:radial-gradient(120% 90% at 85% 0%, rgba(255,255,255,.12), transparent 55%); pointer-events:none; }
.lux-hub .m-jewel.radio{ background:linear-gradient(150deg, var(--plum-bg1), var(--plum-bg2)); box-shadow:var(--glow), 0 0 40px -22px rgba(192,124,156,.8); }
.lux-hub .m-jewel.tv{ background:linear-gradient(150deg, var(--teal-bg1), var(--teal-bg2)); box-shadow:var(--glow), 0 0 40px -22px rgba(90,166,176,.8); }
.lux-hub .m-jewel.games{ background:linear-gradient(150deg, var(--red-bg1), var(--red-bg2)); box-shadow:var(--glow), 0 0 40px -22px rgba(209,138,120,.8); }
.lux-hub .m-jewel .badge{ width:56px; height:56px; }
.lux-hub .m-jewel .jb{ flex:1; min-width:0; position:relative; z-index:1; }
.lux-hub .m-jewel .chip{ display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:.72rem; letter-spacing:.5px; color:#241d12; background:linear-gradient(150deg, var(--gold), var(--gold-2)); padding:4px 10px; border-radius:999px; margin-bottom:7px; }
.lux-hub .m-jewel .chip svg{ width:11px; height:11px; }
.lux-hub .m-jewel h3{ font-weight:700; font-size:1.4rem; margin:0; }
.lux-hub .m-jewel p{ margin:4px 0 0; font-size:.9rem; line-height:1.4; opacity:.9; }
.lux-hub .m-jewel .arrow{ background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.22); color:#fff; }
.lux-hub .m-trio{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.lux-hub .m-trio .surface{ padding:16px 8px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:3px; }
.lux-hub .m-trio .badge{ width:46px; height:46px; margin-bottom:5px; }
.lux-hub .m-trio h3{ font-weight:700; font-size:1rem; margin:0; }
.lux-hub .m-trio p{ margin:0; font-size:.72rem; color:var(--ink-faint); }
.lux-hub .m-rec{ display:flex; align-items:center; gap:13px; padding:14px 16px; margin-bottom:12px; }
.lux-hub .m-rec:last-child{ margin-bottom:0; }
.lux-hub .m-recicon{ width:48px; height:48px; border-radius:13px; flex:none; display:grid; place-items:center; background:rgba(184,146,74,.12); border:1px solid var(--hair); overflow:hidden; }
.lux-hub .m-rec .rb{ flex:1; min-width:0; }
.lux-hub .m-rec h3{ font-weight:700; font-size:1.02rem; margin:0 0 2px; }
.lux-hub .m-rec p{ margin:0; font-size:.82rem; color:var(--ink-faint); }
`

// ── תג-אייקון צבעוני למשחקים (להצעות "מומלצים") ──
function GameBadge({ id, color }) {
  return (
    <div style={{
      width: 48, height: 48, borderRadius: 14, background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <GameIcon id={id} size={32} />
    </div>
  )
}

// ── תפריט פרופיל (bottom sheet) — משתמש בעיצוב הכללי של האפליקציה ──
function ProfileMenu({ userName, photoURL, onClose, onEditProfile, onSettings, onSignOut }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))', width: '100%', maxWidth: 430, direction: 'rtl',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Avatar name={userName} size={56} color="#6B3A4F" photoURL={photoURL} />
          <div>
            <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)' }}>{userName}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>החשבון שלי</div>
          </div>
        </div>
        <button onClick={onEditProfile} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 24 }}>✏️</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>עריכת פרופיל</span>
          <IconBackRTL size={20} color="#8389A4" />
        </button>
        <button onClick={onSettings} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 24 }}>⚙️</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>הגדרות</span>
          <IconBackRTL size={20} color="#8389A4" />
        </button>
        <button onClick={onSignOut} style={{ width: '100%', textAlign: 'right', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 24 }}>🚪</span>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--danger)' }}>התנתק</span>
        </button>
        <button onClick={onClose} className="big-btn big-btn--ghost" style={{ width: '100%' }}>סגור</button>
      </div>
    </div>
  )
}
