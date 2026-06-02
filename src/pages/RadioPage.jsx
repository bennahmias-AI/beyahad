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
import { fetchIsraeliStations, searchStations } from '../services/radio.js'
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
    setSearching(true); setSearched(true)
    const list = await searchStations(term)
    setResults(list)
    setSearching(false)
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
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={term}
                onChange={e => setTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                placeholder="שם תחנה... (למשל: גלגלצ, BBC)"
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
            {searching ? (
              <Loading />
            ) : !searched ? (
              <Empty icon="🌍" title="חפשו תחנה מכל העולם" sub="הקלידו שם תחנה ולחצו על זכוכית המגדלת" />
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
