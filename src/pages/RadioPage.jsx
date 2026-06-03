// src/pages/RadioPage.jsx
// ─────────────────────────────────────────────────────────────
// דף הרדיו המלא.
//
// שלוש לשוניות: תחנות ישראליות (ברירת מחדל), חיפוש בעולם, ומועדפים.
// לחיצה על תחנה מנגנת אותה דרך radioStore — והנגן הצף הגלובלי
// (RadioPlayer) ממשיך לנגן גם כשעוזבים את הדף.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useRadioStore } from '../stores/radioStore.js'
import { fetchIsraeliStations, searchStations, fetchStationsByCountry, fetchStationsByTag, RADIO_COUNTRIES, RADIO_CATEGORIES } from '../services/radio.js'
import { IconBackRTL, IconSearch, IconPlay, IconPause, IconHeart } from '../icons/index.jsx'
import { RadioCatIcon } from '../icons/radioIcons.jsx'
import HomeButton from '../components/HomeButton.jsx'

const ACCENT = '#6B3A4F'
const ACCENT_DEEP = '#482638'

export default function RadioPage({ onBack, onHome }) {
  const { station, playing, playStation, togglePlay, favorites, toggleFavorite } = useRadioStore()
  const [tab, setTab] = useState('israel')   // israel | search | favorites
  const [israeli, setIsraeli] = useState([])
  const [loadingIsraeli, setLoadingIsraeli] = useState(true)

  // חיפוש — מבנה תת-מסכים:
  //   view: 'home' = שדה חיפוש + רשת קטגוריות (ברירת מחדל)
  //         'countries' = רשת כל המדינות
  //         'country' = תחנות של מדינה נבחרת
  //         'tag' = תחנות לפי קטגוריה (עשור/סוגה)
  //         'search' = תוצאות חיפוש חופשי
  const [view, setView] = useState('home')
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  // מדינה נבחרת
  const [country, setCountry] = useState(null)         // { code, flag, name } או null
  const [countryStations, setCountryStations] = useState([])
  const [loadingCountry, setLoadingCountry] = useState(false)
  // קטגוריה (תגית) נבחרת
  const [activeCat, setActiveCat] = useState(null)     // { id, emoji, name, tag } או null
  const [catStations, setCatStations] = useState([])
  const [loadingCat, setLoadingCat] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingIsraeli(true)
    fetchIsraeliStations().then(list => {
      if (!cancelled) { setIsraeli(list); setLoadingIsraeli(false) }
    })
    return () => { cancelled = true }
  }, [])

  const runSearch = async () => {
    if (!term.trim()) return
    setView('search')
    setSearching(true)
    const list = await searchStations(term)
    setResults(list)
    setSearching(false)
  }

  // בחירת קטגוריה מהרשת: מדינה → מסך מדינות; תגית → חיפוש לפי תגית
  const pickCategory = async (cat) => {
    if (cat.kind === 'country') {
      setView('countries')
      return
    }
    // קטגוריית תגית (עשור/סוגה)
    setActiveCat(cat)
    setView('tag')
    setLoadingCat(true)
    const list = await fetchStationsByTag(cat.tag)
    setCatStations(list)
    setLoadingCat(false)
  }

  // בחירת מדינה — טוען את התחנות שלה ועובר לתצוגת תחנות
  const pickCountry = async (c) => {
    setCountry(c)
    setView('country')
    setLoadingCountry(true)
    const list = await fetchStationsByCountry(c.code)
    setCountryStations(list)
    setLoadingCountry(false)
  }

  // חזרה למסך הקטגוריות (מתוך תת-מסך)
  const backToHome = () => {
    setView('home')
    setCountry(null); setCountryStations([])
    setActiveCat(null); setCatStations([])
    setResults([])
  }

  const onPick = (s) => {
    // אם זו אותה תחנה — toggle ניגון; אחרת מנגנים חדשה
    if (station?.id === s.id) togglePlay()
    else playStation(s)
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl', paddingBottom: station ? 90 : 0 }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">רדיו</div>
      </div>

      <div style={{ padding: '8px 20px 28px' }}>
        {/* לשוניות */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 18, background: 'var(--surface-2)',
          borderRadius: 14, padding: 5,
        }}>
          <Tab active={tab === 'israel'} onClick={() => setTab('israel')}>🇮🇱 ישראל</Tab>
          <Tab active={tab === 'search'} onClick={() => { setTab('search'); setView('home') }}>🔎 חיפוש</Tab>
          <Tab active={tab === 'favorites'} onClick={() => setTab('favorites')}>❤ מועדפים{favorites.length > 0 ? ` (${favorites.length})` : ''}</Tab>
        </div>

        {/* ── לשונית ישראל ── */}
        {tab === 'israel' && (
          loadingIsraeli ? (
            <Loading />
          ) : israeli.length === 0 ? (
            <Empty icon="📻" title="לא הצלחנו לטעון תחנות" sub="בדקו את החיבור לאינטרנט ונסו שוב" />
          ) : (
            <StationList stations={israeli} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
          )
        )}

        {/* ── לשונית חיפוש ── */}
        {tab === 'search' && (
          <>
            {/* מסך הבית של החיפוש: שדה חיפוש + רשת קטגוריות */}
            {view === 'home' && (
              <>
                {/* חיפוש חופשי לפי שם — למעלה */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <input
                    value={term}
                    onChange={e => setTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSearch()}
                    placeholder="חיפוש חופשי"
                    style={{
                      flex: 1, minWidth: 0, fontSize: 16, fontFamily: 'inherit', padding: '12px 16px', borderRadius: 12,
                      border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', direction: 'rtl',
                    }}
                  />
                  <button onClick={runSearch} aria-label="חפש" style={{
                    width: 52, flexShrink: 0, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconSearch size={22} color="#fff" />
                  </button>
                </div>

                {/* רשת קטגוריות */}
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>עיינו לפי קטגוריה:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {RADIO_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => pickCategory(cat)} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 16, fontWeight: 800, textAlign: 'right',
                      border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)',
                      boxShadow: 'var(--shadow-sm)',
                    }}>
                      <span style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: 'rgba(107,58,79,.10)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <RadioCatIcon id={cat.id} size={24} color={ACCENT} />
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* תת-מסך: רשת כל המדינות */}
            {view === 'countries' && (
              <>
                <SubHeader title="🌍 לפי מדינה" onBack={backToHome} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {RADIO_COUNTRIES.map(c => (
                    <button key={c.code} onClick={() => pickCountry(c)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '13px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 15, fontWeight: 700, textAlign: 'right',
                      border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{c.flag}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* תת-מסך: תחנות של מדינה נבחרת */}
            {view === 'country' && country && (
              <>
                <SubHeader title={`${country.flag} ${country.name}`} onBack={() => setView('countries')} />
                {loadingCountry ? (
                  <Loading />
                ) : countryStations.length === 0 ? (
                  <Empty icon={country.flag} title={`לא נמצאו תחנות ב${country.name}`} sub="נסו מדינה אחרת" />
                ) : (
                  <StationList stations={countryStations} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
                )}
              </>
            )}

            {/* תת-מסך: תחנות לפי קטגוריה (עשור/סוגה) */}
            {view === 'tag' && activeCat && (
              <>
                <SubHeader title={activeCat.name} iconId={activeCat.id} onBack={backToHome} />
                {loadingCat ? (
                  <Loading />
                ) : catStations.length === 0 ? (
                  <Empty icon="📻" title={`לא נמצאו תחנות ב${activeCat.name}`} sub="נסו קטגוריה אחרת" />
                ) : (
                  <StationList stations={catStations} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
                )}
              </>
            )}

            {/* תת-מסך: תוצאות חיפוש חופשי */}
            {view === 'search' && (
              <>
                <SubHeader title={`🔎 תוצאות עבור “${term}”`} onBack={backToHome} />
                {searching ? (
                  <Loading />
                ) : results.length === 0 ? (
                  <Empty icon="🔎" title="לא נמצאו תחנות" sub="נסו שם אחר" />
                ) : (
                  <StationList stations={results} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
                )}
              </>
            )}
          </>
        )}

        {/* ── לשונית מועדפים ── */}
        {tab === 'favorites' && (
          favorites.length === 0 ? (
            <Empty icon="❤" title="עדיין אין מועדפים" sub="לחצו על הלב ליד תחנה כדי לשמור אותה כאן" />
          ) : (
            <StationList stations={favorites} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
          )
        )}
      </div>
    </div>
  )
}

// ── לשונית ──
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

// ── כותרת תת-מסך עם כפתור חזרה ──
function SubHeader({ title, iconId, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} aria-label="חזרה" style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBackRTL size={20} color="#1B2540" />
      </button>
      {iconId && (
        <span style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: 'rgba(107,58,79,.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RadioCatIcon id={iconId} size={22} color={ACCENT} />
        </span>
      )}
      <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </div>
    </div>
  )
}

// ── רשימת תחנות ──
function StationList({ stations, current, playing, onPick, favorites, onFav }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stations.map(s => {
        const isCurrent = current?.id === s.id
        const isFav = favorites.find(f => f.id === s.id)
        return (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 14,
            background: isCurrent ? 'var(--burgundy-soft)' : 'var(--surface)',
            border: `1px solid ${isCurrent ? ACCENT : 'var(--line)'}`,
          }}>
            {/* נגן/השהה — עם לוגו התחנה ברקע אם יש */}
            <button onClick={() => onPick(s)} aria-label="נגן תחנה" style={{
              width: 50, height: 50, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', border: 'none',
              padding: 0, position: 'relative', overflow: 'hidden',
              background: isCurrent && playing ? ACCENT : `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* לוגו התחנה ברקע (מעומעם מעט כדי שהאייקון ייראה מעליו) */}
              {s.favicon && (
                <img src={s.favicon} alt="" style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  opacity: isCurrent ? 0.35 : 0.55,
                }} onError={e => { e.target.style.display = 'none' }} />
              )}
              <span style={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: '50%',
                background: 'rgba(72,38,56,.55)',
              }}>
                {isCurrent && playing ? <IconPause size={18} color="#fff" /> : <IconPlay size={18} color="#fff" />}
              </span>
            </button>

            {/* פרטי תחנה */}
            <button onClick={() => onPick(s)} style={{
              flex: 1, minWidth: 0, textAlign: 'right', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: 0,
            }}>
              <div className="h-display" style={{
                fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{s.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isCurrent ? (playing ? '● משדר עכשיו' : 'מושהה') : (s.tags ? s.tags.split(',').slice(0, 2).join(' · ') : (s.country || 'רדיו'))}
              </div>
            </button>

            {/* מועדף */}
            <button onClick={() => onFav(s)} aria-label="מועדף" style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: '1px solid var(--line)', background: 'var(--surface-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconHeart size={19} color={isFav ? ACCENT : '#8389A4'} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function Loading() {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>טוען תחנות...</div>
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
