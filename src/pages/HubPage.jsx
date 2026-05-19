// src/pages/HubPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך הבית הראשי - HERO מוביל ישירות ל-matchmaking.
// פעילים: שיחה עם חבר חדש (matchmaking), פרלמנט.
// "בקרוב": משפחה, סיפורים, חוגים, LIVE.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { setPresence } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { colors } from '../design-system/index.js'

export default function HubPage({ onGoMatch, onGoParliament }) {
  const { profile, authUser } = useUserStore()
  const [comingSoon, setComingSoon] = useState(null)

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'בוקר טוב'
             : hour < 17 ? 'צהריים טובים'
             : hour < 20 ? 'ערב טוב'
             : 'לילה טוב'

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

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        padding: '18px 20px 8px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => showComingSoon('התראות')}
          style={{
            width: 52, height: 52, borderRadius: 14,
            background: colors.gold,
            border: `3px solid ${colors.ink}`,
            boxShadow: '3px 4px 0 #1A2547',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, position: 'relative',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          🔔
          <span style={{
            position: 'absolute', top: -6, right: -6,
            background: colors.burgundy, color: 'white',
            borderRadius: '50%', width: 22, height: 22,
            fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${colors.ink}`,
          }}>3</span>
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 12, color: colors.burgundy, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.10em',
            fontFamily: "'Suez One', serif",
          }}>{greet}</div>
          <div style={{
            fontSize: 26, color: colors.ink, lineHeight: 1, marginTop: 2,
            fontFamily: "'Suez One', serif",
          }}>
            {profile?.name || 'אורח'}
          </div>
        </div>

        <Avatar name={profile?.name || ''} size={54} />
      </div>

      <div style={{ padding: '12px 20px 28px' }}>

        {/* ── HERO: שיחה עם חבר חדש - מוביל ל-MATCHMAKING ─── */}
        <button
          onClick={onGoMatch}
          style={{
            width: '100%', textAlign: 'right',
            background: colors.burgundy,
            border: `3px solid ${colors.ink}`,
            borderRadius: 18, padding: '20px 20px 16px',
            color: colors.surface,
            boxShadow: '6px 7px 0 #1A2547',
            position: 'relative', overflow: 'hidden',
            marginBottom: 16,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <div style={{
            position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0,
            width: 28,
            backgroundImage: 'repeating-linear-gradient(45deg, #FFC857 0 8px, #1A2547 8px 16px)',
            opacity: 0.95,
          }}/>
          <div style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            marginInlineStart: 22,
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: 12,
              background: colors.gold, border: `3px solid ${colors.ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '3px 3px 0 #1A2547', fontSize: 28,
            }}>📞</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 24, lineHeight: 1.1, marginBottom: 8,
                fontFamily: "'Suez One', serif",
              }}>
                שיחה עם חבר חדש
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 12 }}>
                המערכת תחבר אותך אוטומטית למישהו שמחכה לשיחה
              </div>
              <div style={{
                background: colors.surface, color: colors.ink,
                border: `2px solid ${colors.ink}`,
                borderRadius: 12, padding: '10px 14px',
                fontSize: 15, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>הקש כדי להתחיל</span>
                <span>←</span>
              </div>
            </div>
          </div>
        </button>

        {/* ── Row 1: פרלמנט + קפה בסלון ─────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 12, marginBottom: 12,
        }}>
          <FeatureCard
            color={colors.wine}
            icon="🏛"
            title="הפרלמנט"
            badge="חי"
            subtitle="חמישה בתור · כל אחד דקה לדבר"
            onClick={onGoParliament}
          />

          <FeatureCard
            color={colors.teal}
            icon="☕"
            title="קפה בסלון"
            subtitle="אחד על אחד · התאמה אוטומטית"
            onClick={onGoMatch}
          />
        </div>

        {/* ── Row 2: משפחה + סיפורים + חוגים ────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10, marginBottom: 16,
        }}>
          <FeatureCardSmall
            color={colors.burgundy}
            icon="❤️"
            title="משפחה"
            subtitle="3 הודעות"
            onClick={() => showComingSoon('משפחה')}
          />

          <FeatureCardSmall
            color={colors.gold}
            icon="📖"
            title="סיפורים"
            subtitle="חדש"
            onClick={() => showComingSoon('סיפורים')}
            darkText
          />

          <FeatureCardSmall
            color={colors.teal}
            icon="👥"
            title="חוגים"
            subtitle="2 חי"
            badge="🔴"
            onClick={() => showComingSoon('חוגים')}
          />
        </div>

        {/* ── LIVE Section ──────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 12,
        }}>
          <div style={{
            background: colors.burgundy, color: 'white',
            padding: '3px 10px', borderRadius: 6,
            fontSize: 11, fontWeight: 800,
            letterSpacing: '0.1em',
          }}>LIVE</div>
          <div style={{
            fontFamily: "'Suez One', serif", fontSize: 18, color: colors.ink,
          }}>
            <span className="live-dot" style={{
              marginInlineEnd: 6, verticalAlign: 'middle', background: colors.burgundy,
            }}/>
            קורה ממש עכשיו
          </div>
        </div>

        <LiveEventCard
          title="בינגו עם רחל"
          subtitle="14 משתתפים · התחיל לפני 4 דקות"
          buttonText="הצטרף"
          onClick={() => showComingSoon('בינגו עם רחל')}
        />

        <LiveEventCard
          title="שירה בציבור — שירי הזמר הישראלי"
          subtitle="בעוד 10 דקות"
          buttonText="הזכר לי"
          variant="upcoming"
          onClick={() => showComingSoon('שירה בציבור')}
        />

        <div style={{ height: 32 }} />
      </div>

      {comingSoon && (
        <ComingSoonModal name={comingSoon} onClose={() => setComingSoon(null)} />
      )}
    </div>
  )
}

function FeatureCard({ color, icon, title, subtitle, badge, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: color, color: 'white',
      border: `3px solid ${colors.ink}`,
      borderRadius: 16, padding: '14px 12px',
      boxShadow: '4px 5px 0 #1A2547',
      minHeight: 130,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      cursor: 'pointer', textAlign: 'right',
      fontFamily: 'inherit', position: 'relative',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: 8, insetInlineEnd: 8,
          background: colors.gold, color: colors.ink,
          padding: '2px 8px', borderRadius: 10,
          fontSize: 10, fontWeight: 800,
          border: `2px solid ${colors.ink}`,
        }}>
          <span style={{ marginInlineEnd: 3, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: colors.burgundy, verticalAlign: 'middle' }}/>
          {badge}
        </div>
      )}
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: colors.gold, border: `3px solid ${colors.ink}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, boxShadow: '2px 2px 0 #1A2547',
      }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 20, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, opacity: 0.92, lineHeight: 1.3, fontWeight: 600 }}>
          {subtitle}
        </div>
      </div>
    </button>
  )
}

function FeatureCardSmall({ color, icon, title, subtitle, badge, onClick, darkText }) {
  const textColor = darkText ? colors.ink : 'white'
  return (
    <button onClick={onClick} style={{
      background: color, color: textColor,
      border: `3px solid ${colors.ink}`,
      borderRadius: 14, padding: '12px 10px',
      boxShadow: '3px 4px 0 #1A2547',
      minHeight: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      cursor: 'pointer', textAlign: 'right',
      fontFamily: 'inherit', position: 'relative',
    }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 15, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{
          fontSize: 10, opacity: 0.92, fontWeight: 600,
        }}>
          {badge && <span style={{ marginInlineEnd: 3 }}>{badge}</span>}
          {subtitle}
        </div>
      </div>
    </button>
  )
}

function LiveEventCard({ title, subtitle, buttonText, variant, onClick }) {
  const isUpcoming = variant === 'upcoming'
  return (
    <div style={{
      background: colors.surface,
      border: `3px solid ${colors.ink}`,
      borderRadius: 16, padding: '12px 14px',
      boxShadow: '0 3px 0 #B89E70',
      marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <button onClick={onClick} style={{
        width: 48, height: 48, borderRadius: 12,
        background: isUpcoming ? colors.gold : colors.teal,
        color: isUpcoming ? colors.ink : 'white',
        border: `3px solid ${colors.ink}`,
        boxShadow: '2px 2px 0 #1A2547',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, cursor: 'pointer', fontFamily: 'inherit',
        flexShrink: 0,
      }}>
        {isUpcoming ? '🔔' : '▶'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Suez One', serif", fontSize: 16, color: colors.ink,
          lineHeight: 1.2, marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: 12, color: colors.ink2 }}>{subtitle}</div>
      </div>
      <button onClick={onClick} style={{
        background: isUpcoming ? 'transparent' : colors.burgundy,
        color: isUpcoming ? colors.burgundy : 'white',
        border: `2px solid ${colors.burgundy}`,
        borderRadius: 10, padding: '8px 14px',
        fontSize: 13, fontWeight: 800,
        cursor: 'pointer', fontFamily: 'inherit',
        flexShrink: 0,
      }}>
        {buttonText}
      </button>
    </div>
  )
}

function ComingSoonModal({ name, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          border: `3px solid ${colors.ink}`,
          borderRadius: 22,
          padding: '24px 24px 20px',
          maxWidth: 340, width: '100%',
          textAlign: 'center',
          boxShadow: '6px 7px 0 #1A2547',
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12 }}>🚧</div>
        <div style={{
          fontFamily: "'Suez One', serif", fontSize: 24,
          color: colors.ink, marginBottom: 8,
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 16, color: colors.ink2,
          marginBottom: 20, lineHeight: 1.4,
        }}>
          הפיצ'ר הזה בבנייה ויהיה זמין בקרוב!
        </div>
        <button
          onClick={onClose}
          className="big-btn big-btn--primary"
          style={{ width: '100%' }}
        >
          הבנתי
        </button>
      </div>
    </div>
  )
}
