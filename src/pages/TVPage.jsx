// src/pages/TVPage.jsx
// -----------------------------------------------------------------
// דף הטלוויזיה. מבנה זהה לדף הרדיו:
//   לשוניות: ישראל (ברירת מחדל), עולם (מדינות + קטגוריות), מועדפים.
// בראש הדף נגן וידאו דביק (sticky) שממשיך לנגן בזמן גלילת הרשימה.
//
// נגן: באייפון/ספארי HLS מנוגן ישירות; בשאר הדפדפנים טוענים hls.js.
// אם ערוץ לא זמין (CORS / סטרים נפל) — מציגים הודעה ידידותית.
// -----------------------------------------------------------------
import { useState, useEffect, useRef } from 'react'
import { getAccessibilitySettings } from '../utils/accessibility.js'
import {
  fetchIsraeliTV, fetchTVByCountry, fetchTVByCategory,
  nativeHlsSupported, loadHls, isOfficialIL, TV_COUNTRIES, TV_CATEGORIES,
} from '../services/tv.js'
import { IconBackRTL, IconSearch, IconHeart } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { useUserStore } from '../stores/userStore.js'
import { logActivity } from '../services/firebase.js'

const ACCENT = '#2C5566'
const ACCENT_DEEP = '#16323F'
const FAV_KEY = 'beyahad_tv_favorites'

function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
}
function saveFavs(list) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export default function TVPage({ onBack, onHome }) {
  const [tab, setTab] = useState('israel')        // israel | world | favorites
  const [current, setCurrent] = useState(null)    // הערוץ המתנגן כעת

  const [israeli, setIsraeli] = useState([])
  const [loadingIsraeli, setLoadingIsraeli] = useState(true)
  const [filterIL, setFilterIL] = useState('')
  const [officialOnly, setOfficialOnly] = useState(true)

  // עולם: תת-מסכים — home (רשת) | countries | country | category
  const [view, setView] = useState('home')
  const [country, setCountry] = useState(null)
  const [countryList, setCountryList] = useState([])
  const [loadingCountry, setLoadingCountry] = useState(false)
  const [activeCat, setActiveCat] = useState(null)
  const [catList, setCatList] = useState([])
  const [loadingCat, setLoadingCat] = useState(false)

  const [favorites, setFavorites] = useState(loadFavs)

  const [bigText] = useState(() => {
    const fs = getAccessibilitySettings().fontScale
    return fs === 'large' || fs === 'xlarge'
  })
  const gridCols = bigText ? '1fr' : 'repeat(2, 1fr)'

  useEffect(() => {
    let cancelled = false
    setLoadingIsraeli(true)
    fetchIsraeliTV().then(list => {
      if (!cancelled) { setIsraeli(list); setLoadingIsraeli(false) }
    })
    return () => { cancelled = true }
  }, [])

  const toggleFav = (ch) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.url === ch.url)
      const next = exists ? prev.filter(f => f.url !== ch.url) : [...prev, ch]
      saveFavs(next)
      return next
    })
  }
  const isFav = (ch) => favorites.some(f => f.url === ch.url)

  const onPick = (ch) => {
    setCurrent(ch)
    // רישום לבקרת הניהול — מי צפה ובאיזה ערוץ (best-effort)
    try {
      const { authUser, profile } = useUserStore.getState()
      if (authUser?.uid && ch?.name) {
        logActivity({ uid: authUser.uid, name: profile?.name || '', type: 'tv', detail: ch.name })
      }
    } catch { /* לעולם לא חוסם צפייה */ }
  }

  const pickCategory = async (cat) => {
    if (cat.kind === 'country') { setView('countries'); return }
    setActiveCat(cat); setView('category'); setLoadingCat(true)
    const list = await fetchTVByCategory(cat.cat)
    setCatList(list); setLoadingCat(false)
  }
  const pickCountry = async (c) => {
    setCountry(c); setView('country'); setLoadingCountry(true)
    const list = await fetchTVByCountry(c.code)
    setCountryList(list); setLoadingCountry(false)
  }
  const backToHome = () => {
    setView('home'); setCountry(null); setCountryList([]); setActiveCat(null); setCatList([])
  }

  // רשימה לבנה (ערוצים רשמיים) + סינון טקסט חופשי
  const ilBase = officialOnly ? israeli.filter(isOfficialIL) : israeli
  const filteredIL = filterIL.trim()
    ? ilBase.filter(c => c.name.toLowerCase().includes(filterIL.trim().toLowerCase()))
    : ilBase

  return (
    <div className="scroll-area rise-in" style={{ direction: 'rtl', paddingBottom: 20 }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">טלוויזיה</div>
      </div>

      {/* נגן וידאו דביק */}
      {current && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#000', padding: '0 0 6px',
          boxShadow: '0 6px 16px -8px rgba(0,0,0,.5)',
        }}>
          <TVPlayer channel={current} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 2px',
          }}>
            <div className="h-display" style={{ flex: 1, minWidth: 0, fontSize: 16, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current.name}
            </div>
            <button onClick={() => toggleFav(current)} aria-label="מועדף" style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: 'none', background: 'rgba(255,255,255,.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconHeart size={18} color={isFav(current) ? '#E8884F' : '#fff'} />
            </button>
            <button onClick={() => setCurrent(null)} aria-label="סגור נגן" style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff',
              fontSize: 20, fontWeight: 800, lineHeight: 1,
            }}>×</button>
          </div>
        </div>
      )}

      <div style={{ padding: '8px 20px 28px' }}>
        {/* לשוניות */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--surface-2)', borderRadius: 14, padding: 5 }}>
          <Tab active={tab === 'israel'} onClick={() => setTab('israel')}>🇮🇱 ישראל</Tab>
          <Tab active={tab === 'world'} onClick={() => { setTab('world'); setView('home') }}>🌍 עולם</Tab>
          <Tab active={tab === 'favorites'} onClick={() => setTab('favorites')}>❤ מועדפים{favorites.length ? ` (${favorites.length})` : ''}</Tab>
        </div>

        {/* הערה קצרה על זמינות */}
        <div style={{
          fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.5,
          background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px', marginBottom: 16,
        }}>
          📺 ערוצים ציבוריים מרחבי העולם. חלק מהערוצים עשויים שלא להתנגן בדפדפן או להיות זמינים לפי אזור.
        </div>

        {/* לשונית ישראל */}
        {tab === 'israel' && (
          loadingIsraeli ? <Loading /> :
          israeli.length === 0 ? <Empty icon="📺" title="לא הצלחנו לטעון ערוצים" sub="בדקו את החיבור לאינטרנט ונסו שוב" /> :
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: 'var(--surface-2)', borderRadius: 12, padding: 4 }}>
              <Pill active={officialOnly} onClick={() => setOfficialOnly(true)}>📺 ערוצים רשמיים</Pill>
              <Pill active={!officialOnly} onClick={() => setOfficialOnly(false)}>הכל</Pill>
            </div>
            <SearchBox value={filterIL} onChange={setFilterIL} placeholder="סינון ערוצים ישראליים" />
            {filteredIL.length === 0
              ? <Empty icon="🔎" title="לא נמצא ערוץ" sub={officialOnly ? 'לחצו על ”הכל“ כדי לראות עוד ערוצים' : 'נסו שם אחר'} />
              : <ChannelList channels={filteredIL} current={current} onPick={onPick} isFav={isFav} onFav={toggleFav} />}
          </>
        )}

        {/* לשונית עולם */}
        {tab === 'world' && (
          <>
            {view === 'home' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>עיינו לפי קטגוריה:</div>
                <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 10 }}>
                  {TV_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => pickCategory(cat)} style={catBtnStyle}>
                      <span style={catEmojiStyle}>{cat.emoji}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {view === 'countries' && (
              <>
                <SubHeader title="🌍 לפי מדינה" onBack={backToHome} />
                <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
                  {TV_COUNTRIES.map(c => (
                    <button key={c.code} onClick={() => pickCountry(c)} style={{ ...catBtnStyle, fontSize: 15, padding: '13px 14px' }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{c.flag}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {view === 'country' && country && (
              <>
                <SubHeader title={`${country.flag} ${country.name}`} onBack={() => setView('countries')} />
                {loadingCountry ? <Loading /> :
                  countryList.length === 0 ? <Empty icon={country.flag} title={`לא נמצאו ערוצים ב${country.name}`} sub="נסו מדינה אחרת" /> :
                  <ChannelList channels={countryList} current={current} onPick={onPick} isFav={isFav} onFav={toggleFav} />}
              </>
            )}

            {view === 'category' && activeCat && (
              <>
                <SubHeader title={`${activeCat.emoji} ${activeCat.name}`} onBack={backToHome} />
                {loadingCat ? <Loading /> :
                  catList.length === 0 ? <Empty icon="📺" title={`לא נמצאו ערוצים ב${activeCat.name}`} sub="נסו קטגוריה אחרת" /> :
                  <ChannelList channels={catList} current={current} onPick={onPick} isFav={isFav} onFav={toggleFav} />}
              </>
            )}
          </>
        )}

        {/* לשונית מועדפים */}
        {tab === 'favorites' && (
          favorites.length === 0
            ? <Empty icon="❤" title="עדיין אין מועדפים" sub="לחצו על הלב ליד ערוץ כדי לשמור אותו כאן" />
            : <ChannelList channels={favorites} current={current} onPick={onPick} isFav={isFav} onFav={toggleFav} />
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------
// נגן הווידאו — HLS מובנה (ספארי) או hls.js (אחרים)
// -----------------------------------------------------------------
function TVPlayer({ channel }) {
  const videoRef = useRef(null)
  const hlsRef = useRef(null)
  const [status, setStatus] = useState('loading')  // loading | playing | error

  useEffect(() => {
    const video = videoRef.current
    if (!video || !channel?.url) return
    let destroyed = false
    setStatus('loading')

    // ניקוי נגן קודם
    const cleanup = () => {
      if (hlsRef.current) { try { hlsRef.current.destroy() } catch {} hlsRef.current = null }
      try { video.pause(); video.removeAttribute('src'); video.load() } catch {}
    }
    cleanup()

    const url = channel.url
    const onPlaying = () => { if (!destroyed) setStatus('playing') }
    video.addEventListener('playing', onPlaying)

    const isM3U8 = /\.m3u8(\?|$)/i.test(url)

    if (!isM3U8 || nativeHlsSupported()) {
      // ניגון ישיר (HLS מובנה בספארי, או קובץ וידאו רגיל)
      video.src = url
      video.play().catch(() => { /* ימתין לנגיעת המשתמש */ })
      const onErr = () => { if (!destroyed) setStatus('error') }
      video.addEventListener('error', onErr)
      return () => { destroyed = true; video.removeEventListener('playing', onPlaying); video.removeEventListener('error', onErr); cleanup() }
    }

    // אחרת — טוענים hls.js
    loadHls().then(Hls => {
      if (destroyed) return
      if (Hls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls
        hls.loadSource(url)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data && data.fatal && !destroyed) setStatus('error')
        })
      } else {
        // נפילה אחרונה — ניסיון ניגון ישיר
        video.src = url
        video.play().catch(() => setStatus('error'))
      }
    }).catch(() => { if (!destroyed) setStatus('error') })

    return () => {
      destroyed = true
      video.removeEventListener('playing', onPlaying)
      cleanup()
    }
  }, [channel?.url])

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
      <video
        ref={videoRef}
        controls
        playsInline
        autoPlay
        style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
      />
      {status === 'loading' && (
        <Overlay>
          <div style={{ fontSize: 15, fontWeight: 700 }}>טוען ערוץ…</div>
        </Overlay>
      )}
      {status === 'error' && (
        <Overlay>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📺</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>הערוץ אינו זמין כרגע</div>
          <div style={{ fontSize: 13, opacity: 0.85, textAlign: 'center', lineHeight: 1.5, maxWidth: 280 }}>
            ייתכן שהשידור נפל או חסום בדפדפן. נסו ערוץ אחר.
          </div>
        </Overlay>
      )}
    </div>
  )
}

function Overlay({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', color: '#fff',
      background: 'rgba(0,0,0,.55)', pointerEvents: 'none', padding: 16,
    }}>{children}</div>
  )
}

// -----------------------------------------------------------------
// רשימת ערוצים
// -----------------------------------------------------------------
function ChannelList({ channels, current, onPick, isFav, onFav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {channels.map((ch, i) => {
        const active = current?.url === ch.url
        return (
          <div key={(ch.id || ch.name) + i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14,
            background: active ? 'rgba(44,85,102,.10)' : 'var(--surface)',
            border: `1px solid ${active ? ACCENT : 'var(--line)'}`,
          }}>
            <button onClick={() => onPick(ch)} aria-label="נגן ערוץ" style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0, cursor: 'pointer', border: 'none',
              padding: 0, position: 'relative', overflow: 'hidden',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 0 0 1px var(--line)',
            }}>
              {ch.logo
                ? <img src={ch.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }} onError={e => { e.target.style.display = 'none' }} />
                : <span style={{ fontSize: 26 }}>📺</span>}
            </button>

            <button onClick={() => onPick(ch)} style={{
              flex: 1, minWidth: 0, textAlign: 'right', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0,
            }}>
              <div className="h-display" style={{ fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ch.name}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {active ? '● מתנגן עכשיו' : 'ערוץ טלוויזיה'}
                {ch.quality ? ` · ${ch.quality}` : ''}
                {ch.geo ? ' · אזורי' : ''}
                {ch.needsHeaders ? ' · יתכן שלא יעבוד בדפדפן' : ''}
              </div>
            </button>

            <button onClick={() => onFav(ch)} aria-label="מועדף" style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: '1px solid var(--line)', background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconHeart size={19} color={isFav(ch) ? ACCENT : '#8389A4'} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// -----------------------------------------------------------------
// רכיבי עזר
// -----------------------------------------------------------------
function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px 6px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? ACCENT : 'var(--ink-3)',
      boxShadow: active ? 'var(--shadow-sm)' : 'none',
    }}>{children}</button>
  )
}

// מתג קטן (רשמיים / הכל)
function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800,
      background: active ? ACCENT : 'transparent',
      color: active ? '#fff' : 'var(--ink-3)',
    }}>{children}</button>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, fontSize: 16, fontFamily: 'inherit', padding: '12px 16px', borderRadius: 12,
          border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', direction: 'rtl',
        }}
      />
      <span style={{
        width: 52, flexShrink: 0, borderRadius: 12,
        background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconSearch size={22} color="#fff" />
      </span>
    </div>
  )
}

function SubHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} aria-label="חזרה" style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBackRTL size={20} color="#1B2540" />
      </button>
      <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
    </div>
  )
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>טוען ערוצים...</div>
}

function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-2)' }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>{icon}</div>
      <div className="h-display" style={{ fontSize: 20, marginBottom: 6, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 15 }}>{sub}</div>
    </div>
  )
}

const catBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 16, fontWeight: 800, textAlign: 'right',
  border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)',
  boxShadow: 'var(--shadow-sm)',
}
const catEmojiStyle = {
  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
  background: 'rgba(44,85,102,.10)', fontSize: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
