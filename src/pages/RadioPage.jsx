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
import { fetchIsraeliStations, searchStations, fetchStationsByCountry, RADIO_COUNTRIES } from '../services/radio.js'
import { IconBackRTL, IconSearch, IconPlay, IconPause, IconHeart } from '../icons/index.jsx'

const ACCENT = '#6B3A4F'
const ACCENT_DEEP = '#482638'

export default function RadioPage({ onBack }) {
  const { station, playing, playStation, togglePlay, favorites, toggleFavorite } = useRadioStore()
  const [tab, setTab] = useState('israel')   // israel | search | favorites
  const [israeli, setIsraeli] = useState([])
  const [loadingIsraeli, setLoadingIsraeli] = useState(true)

  // חיפוש
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  // מדינה נבחרת לחיפוש לפי מדינה
  const [country, setCountry] = useState(null)         // { code, flag, name } או null
  const [countryStations, setCountryStations] = useState([])
  const [loadingCountry, setLoadingCountry] = useState(false)

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
    setCountry(null)   // חיפוש חופשי מבטל בחירת מדינה
    setSearching(true); setSearched(true)
    const list = await searchStations(term)
    setResults(list)
    setSearching(false)
  }

  // בחירת מדינה — טוען את התחנות שלה (או מנקה אם לוחצה שוב)
  const pickCountry = async (c) => {
    if (country?.code === c.code) {
      setCountry(null); setCountryStations([])
      return
    }
    setCountry(c)
    setTerm('')
    setLoadingCountry(true)
    const list = await fetchStationsByCountry(c.code)
    setCountryStations(list)
    setLoadingCountry(false)
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
        <div className="screen-header__title">רדיו</div>
      </div>

      <div style={{ padding: '8px 20px 28px' }}>
        {/* לשוניות */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 18, background: 'var(--surface-2)',
          borderRadius: 14, padding: 5,
        }}>
          <Tab active={tab === 'israel'} onClick={() => setTab('israel')}>🇮🇱 ישראל</Tab>
          <Tab active={tab === 'search'} onClick={() => setTab('search')}>🔎 חיפוש</Tab>
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
            {/* בורר מדינות — רשת דגלים נפרשת לאורך */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>לפי מדינה:</div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
              }}>
                {RADIO_COUNTRIES.map(c => {
                  const sel = country?.code === c.code
                  return (
                    <button key={c.code} onClick={() => pickCountry(c)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 15, fontWeight: 700, textAlign: 'right',
                      border: `1.5px solid ${sel ? ACCENT : 'var(--line-strong)'}`,
                      background: sel ? ACCENT : 'var(--surface)',
                      color: sel ? '#fff' : 'var(--ink)',
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{c.flag}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* חיפוש חופשי לפי שם */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={term}
                onChange={e => setTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                placeholder="או חפשו שם תחנה..."
                style={{
                  flex: 1, fontSize: 16, fontFamily: 'inherit', padding: '12px 16px', borderRadius: 12,
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

            {/* תוכן — אם נבחרה מדינה מציגים את התחנות שלה, אחרת תוצאות חיפוש */}
            {country ? (
              loadingCountry ? (
                <Loading />
              ) : countryStations.length === 0 ? (
                <Empty icon={country.flag} title={`לא נמצאו תחנות ב${country.name}`} sub="נסו מדינה אחרת" />
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>
                    {country.flag} תחנות מ{country.name} ({countryStations.length})
                  </div>
                  <StationList stations={countryStations} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
                </>
              )
            ) : searching ? (
              <Loading />
            ) : !searched ? (
              <Empty icon="🌍" title="בחרו מדינה או חפשו תחנה" sub="לחצו על דגל למעלה, או הקלידו שם תחנה" />
            ) : results.length === 0 ? (
              <Empty icon="🔎" title="לא נמצאו תחנות" sub="נסו שם אחר" />
            ) : (
              <StationList stations={results} current={station} playing={playing} onPick={onPick} favorites={favorites} onFav={toggleFavorite} />
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
