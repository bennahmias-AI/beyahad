// src/pages/HubPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך הבית הראשי — עיצוב 2026 מודרני.
// HERO מוביל ל-matchmaking. פעילים: קפה, פרלמנט.
// "בקרוב": חוגים, סיפורים, משפחה, אירועי LIVE.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { setPresence } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import {
  IconPhone, IconCoffee, IconPodium, IconUsers,
  IconBook, IconHeart, IconBell, IconBackRTL,
} from '../icons/index.jsx'

export default function HubPage({ onGoMatch, onGoParliament }) {
  const { profile, authUser } = useUserStore()
  const [comingSoon, setComingSoon] = useState(null)

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'בוקר טוב'
             : hour < 17 ? 'צהריים טובים'
             : hour < 20 ? 'אחר צהריים טובים'
             : 'ערב טוב'

  // Mark me as available
  useEffect(() => {
    if (!authUser?.uid) return
    setPresence(authUser.uid, 'available').catch(() => {})

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        setPresence(authUser.uid, 'away').catch(() => {})
      } else {
        setPresence(authUser.uid, 'available').catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [authUser?.uid])

  const showComingSoon = (name) => setComingSoon(name)
  const userName = profile?.name || 'אורח'

  return (
    <div className="scroll-area">
      {/* ── Top: greeting + bell ───────────────────────────── */}
      <div style={{ padding: '18px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={userName} size={54} color="#6B3A4F" />
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
          onClick={() => showComingSoon('התראות')}
          style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            boxShadow: '0 4px 12px -2px rgba(20,23,42,.10), 0 1px 3px rgba(20,23,42,.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}
        >
          <IconBell size={24} color="#1B2540" />
          <span style={{
            position: 'absolute', top: -6, insetInlineStart: -6,
            width: 22, height: 22, borderRadius: 11,
            background: 'var(--mustard)', color: 'var(--ink)',
            fontSize: 12, fontWeight: 800,
            fontFamily: 'var(--font-display)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--ink)',
          }}>3</span>
        </button>
      </div>

      <div style={{ padding: '12px 20px 20px' }}>
        {/* ── HERO — שיחה עם חבר חדש ───────────────────────── */}
        <button onClick={onGoMatch} style={{
          width: '100%', textAlign: 'right',
          background: 'linear-gradient(135deg, #2C5566 0%, #1B2540 60%, #0E1730 100%)',
          border: 'none',
          borderRadius: 26,
          padding: '24px 22px 22px',
          color: '#FBF7EE',
          boxShadow: '0 16px 36px -10px rgba(126,44,46,.55), 0 4px 12px rgba(20,23,42,.08)',
          position: 'relative', overflow: 'hidden',
          display: 'block',
          fontFamily: 'inherit',
        }}>
          {/* soft light bloom top-right */}
          <div style={{
            position: 'absolute', insetInlineEnd: -60, top: -60,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)',
            pointerEvents: 'none',
          }}/>
          {/* second light bloom bottom-left */}
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
              <div className="h-display" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 6, color: '#FBF7EE', letterSpacing: '-0.02em' }}>
                שיחה עם חבר חדש
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.92)', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="live-dot" style={{ background: '#E8C879', width: 8, height: 8 }} />
                <span>המערכת תחבר אותך אוטומטית למי שמחכה</span>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 18,
            background: 'rgba(255,255,255,.16)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.24)',
            borderRadius: 16,
            padding: '13px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 17, fontWeight: 700,
          }}>
            <span>הקש כדי להתחיל</span>
            <IconBackRTL size={22} color="#FBF7EE" />
          </div>
        </button>

        {/* ── 2 featured rooms — קפה + פרלמנט ──────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 14, marginTop: 16,
        }}>
          <RoomTile
            onClick={onGoMatch}
            color="#6E8C6A"
            colorDeep="#4F6B4A"
            icon={<IconCoffee />}
            label="קפה בסלון"
            sub="אחד על אחד"
            badge="התאמה אוטומטית"
          />
          <RoomTile
            onClick={onGoParliament}
            color="#8A4D6A"
            colorDeep="#6B3A4F"
            icon={<IconPodium />}
            label="הפרלמנט"
            sub="חמישה בתור"
            badge="כל אחד דקה לדבר"
            live
          />
        </div>

        {/* ── 3 utility tiles ──────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10, marginTop: 12,
        }}>
          <HomeTileSmall
            onClick={() => showComingSoon('חוגים')}
            color="#2C5566"
            icon={<IconUsers size={24} color="white" />}
            label="חוגים"
            badge="בקרוב"
          />
          <HomeTileSmall
            onClick={() => showComingSoon('סיפורים')}
            color="#B89048"
            icon={<IconBook size={24} color="white" />}
            label="סיפורים"
            badge="בקרוב"
          />
          <HomeTileSmall
            onClick={() => showComingSoon('משפחה')}
            color="#7E2C2E"
            icon={<IconHeart size={24} color="white" />}
            label="משפחה"
            badge="בקרוב"
          />
        </div>

        {/* ── Live now strip ───────────────────────────────── */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 className="h-display" style={{ fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-dot" />
              קורה ממש עכשיו
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: 'var(--burgundy)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              fontFamily: 'var(--font-display)',
            }}>LIVE</span>
          </div>
          <LiveCard
            color="#4F6B4A"
            title="בינגו עם רחל"
            sub="14 משתתפים · התחיל לפני 4 דקות"
            onClick={() => showComingSoon('בינגו עם רחל')}
          />
          <div style={{ height: 10 }}/>
          <LiveCard
            color="#B89048"
            title="שירה בציבור — שירי לאה גולדברג"
            sub="9 משתתפים · נשארו 25 דקות"
            onClick={() => showComingSoon('שירה בציבור')}
          />
        </div>

        <div style={{ height: 24 }}/>
      </div>

      {comingSoon && (
        <ComingSoonModal name={comingSoon} onClose={() => setComingSoon(null)} />
      )}
    </div>
  )
}

// ── Room Tile (large, 2-column) ─────────────────────────────
function RoomTile({ onClick, color, colorDeep, icon, label, sub, badge, live }) {
  return (
    <button onClick={onClick} style={{
      background: `linear-gradient(135deg, ${color} 0%, ${colorDeep} 100%)`,
      color: '#FBF7EE',
      border: 'none',
      borderRadius: 22, padding: '16px 16px 14px',
      textAlign: 'right',
      boxShadow: `0 12px 28px -8px ${color}66, 0 2px 6px rgba(20,23,42,.06)`,
      minHeight: 168,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'inherit',
    }}>
      {/* soft light bloom */}
      <div style={{
        position: 'absolute', insetInlineEnd: -30, top: -30,
        width: 130, height: 130, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,.20), transparent 70%)',
        pointerEvents: 'none',
      }}/>
      {live && (
        <div style={{
          position: 'absolute', top: 12, insetInlineEnd: 12,
          background: 'rgba(255,255,255,.20)',
          backdropFilter: 'blur(8px)',
          color: '#FBF7EE',
          border: '1px solid rgba(255,255,255,.28)',
          fontSize: 11, fontWeight: 700,
          padding: '4px 10px', borderRadius: 999,
          display: 'flex', alignItems: 'center', gap: 5,
          letterSpacing: '0.02em',
        }}>
          <span className="live-dot" style={{ background: '#E8C879', boxShadow: 'none', width: 6, height: 6 }}/>
          חי
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,.18)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon && (typeof icon.type === 'function'
          ? <icon.type size={28} color="#FBF7EE" />
          : icon)}</div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700, marginBottom: 3, letterSpacing: '0.01em' }}>{sub}</div>
        <div className="h-display" style={{ fontSize: 22, lineHeight: 1.05, marginBottom: 6, color: '#FBF7EE' }}>{label}</div>
        <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 600, lineHeight: 1.3 }}>{badge}</div>
      </div>
    </button>
  )
}

// ── Small utility tile (3-column) ───────────────────────────
function HomeTileSmall({ onClick, color, icon, label, badge, live }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '14px 10px 12px',
      textAlign: 'center',
      minHeight: 116,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      boxShadow: 'var(--shadow-sm)',
      gap: 6,
      fontFamily: 'inherit',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 10px -2px rgba(20,23,42,.18)',
      }}>{icon}</div>
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
function LiveCard({ color, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '14px 14px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'inherit',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 10px -2px rgba(20,23,42,.18)',
      }}>
        <span className="live-dot" style={{ background: '#E8C879', width: 10, height: 10 }}/>
      </div>
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
