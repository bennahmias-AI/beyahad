// src/pages/CommunityPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך תוכן קהילתי — משמש גם ל"עצות" וגם ל"מתכונים".
//
// מקבל prop בשם `kind`:  'tip'  → מסך עצות
//                        'recipe' → מסך מתכונים
// אין לשוניות — כל מסך עצמאי לגמרי עם כותרת משלו.
//
// פסיכולוגית: כשמשתמש רואה "42 צפו במתכון שלי" — הוא מרגיש
// נחוץ ומועיל. זו "הותרת חותם" בצורה פרקטית.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchCommunityPosts, createCommunityPost,
  incrementPostViews, togglePostLike, seedCommunityContent,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL, IconHeart } from '../icons/index.jsx'

// הגדרות לכל סוג מסך
const CONFIG = {
  tip: {
    screenTitle: 'עצות',
    emoji: '💡',
    accent: '#B89048',
    accentDeep: '#8A6A2E',
    addLabel: 'הוסף עצה משלך',
    emptyTitle: 'עדיין אין עצות',
    composeTitle: '💡 הוסף עצה משלך',
    composeSub: 'שתף עצה או טיפ מניסיון החיים שלך',
    titlePlaceholder: 'למשל: איך לחסוך בחשמל',
    bodyLabel: 'העצה',
    bodyPlaceholder: 'כתוב כאן את העצה במילים שלך...',
  },
  recipe: {
    screenTitle: 'מתכונים',
    emoji: '🍲',
    accent: '#7E2C2E',
    accentDeep: '#5A1D1E',
    addLabel: 'הוסף מתכון משלך',
    emptyTitle: 'עדיין אין מתכונים',
    composeTitle: '🍲 הוסף מתכון משלך',
    composeSub: 'שתף מתכון אהוב — אחרים ישמחו לנסות',
    titlePlaceholder: 'למשל: עוגת תפוחים של סבתא',
    bodyLabel: 'המתכון',
    bodyPlaceholder: 'מצרכים והוראות הכנה...',
  },
}

export default function CommunityPage({ onBack, kind = 'tip' }) {
  const { profile, authUser } = useUserStore()
  const cfg = CONFIG[kind] || CONFIG.tip

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPost, setOpenPost] = useState(null)
  const [composing, setComposing] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // Watch posts of this kind
  useEffect(() => {
    setLoading(true)
    const unsub = watchCommunityPosts(kind, list => {
      setPosts(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [kind])

  const openItem = async (post) => {
    setOpenPost(post)
    await incrementPostViews(post.id)
  }

  // Temporary one-time seed of starter content
  const handleSeed = async () => {
    if (seeding) return
    setSeeding(true)
    try {
      await seedCommunityContent(authUser?.uid)
    } catch (e) {
      console.error('seed error:', e)
    }
    setSeeding(false)
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">{cfg.screenTitle}</div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ padding: '8px 20px 28px' }}>
        {/* Add button */}
        <button
          onClick={() => setComposing(true)}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${cfg.accent} 0%, ${cfg.accentDeep} 100%)`,
            color: '#FBF7EE', border: 'none',
            borderRadius: 18, padding: '15px 18px',
            fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 8px 20px -8px ${cfg.accent}88`,
            marginBottom: 18,
          }}
        >
          ➕ {cfg.addLabel}
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>
            טוען...
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px 20px',
            color: 'var(--ink-2)',
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{cfg.emoji}</div>
            <div className="h-display" style={{ fontSize: 20, marginBottom: 6, color: 'var(--ink)' }}>
              {cfg.emptyTitle}
            </div>
            <div style={{ fontSize: 15 }}>
              היה הראשון לשתף — לחץ על הכפתור למעלה
            </div>

            {/* כפתור הזרעה זמני — ממלא תוכן פתיחה */}
            <button
              onClick={handleSeed}
              disabled={seeding}
              style={{
                marginTop: 24,
                background: 'var(--surface)',
                color: 'var(--ink-3)',
                border: '1px dashed var(--line-strong)',
                borderRadius: 12, padding: '10px 18px',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {seeding ? 'ממלא...' : '✨ מלא תוכן לדוגמה'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                accent={cfg.accent}
                myUid={authUser?.uid}
                onClick={() => openItem(post)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Compose modal ──────────────────────────────────── */}
      {composing && (
        <ComposeModal
          cfg={cfg}
          onClose={() => setComposing(false)}
          onSubmit={async ({ title, body }) => {
            await createCommunityPost({
              kind, title, body,
              authorUid: authUser?.uid,
              authorName: profile?.name || 'משתמש',
            })
            setComposing(false)
          }}
        />
      )}

      {/* ── Post detail modal ──────────────────────────────── */}
      {openPost && (
        <PostDetailModal
          post={openPost}
          accent={cfg.accent}
          myUid={authUser?.uid}
          onClose={() => setOpenPost(null)}
        />
      )}
    </div>
  )
}

// ── Post card (in list) ─────────────────────────────────────
function PostCard({ post, accent, myUid, onClick }) {
  const likeCount = (post.likes || []).length
  const iLiked = myUid && (post.likes || []).includes(myUid)

  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '14px 16px',
      boxShadow: 'var(--shadow-sm)',
      fontFamily: 'inherit',
      display: 'block',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={post.authorName} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{
            fontSize: 18, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 3,
          }}>
            {post.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
            מאת {post.authorName}
          </div>
        </div>
      </div>

      {/* preview of body */}
      <div style={{
        fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {post.body}
      </div>

      {/* stats row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, marginTop: 10,
        fontSize: 13, color: 'var(--ink-3)', fontWeight: 600,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          👁 {post.views || 0} צפיות
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 4,
          color: iLiked ? accent : 'var(--ink-3)',
        }}>
          <IconHeart size={15} color={iLiked ? accent : '#8389A4'} />
          {likeCount}
        </span>
        <span style={{ marginInlineStart: 'auto', color: accent, fontWeight: 700 }}>
          קרא עוד ←
        </span>
      </div>
    </button>
  )
}

// ── Compose modal ───────────────────────────────────────────
function ComposeModal({ cfg, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const canSubmit = title.trim().length > 0 && body.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      await onSubmit({ title, body })
    } catch (e) {
      console.error(e)
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)',
        borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto',
        direction: 'rtl',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)',
          margin: '0 auto 18px',
        }}/>

        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>
          {cfg.composeTitle}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
          {cfg.composeSub}
        </div>

        {/* Title */}
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
          כותרת
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={cfg.titlePlaceholder}
          style={{
            width: '100%', fontSize: 17, fontFamily: 'inherit',
            padding: '13px 14px', borderRadius: 14,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--ink)',
            marginBottom: 16, direction: 'rtl',
          }}
        />

        {/* Body */}
        <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
          {cfg.bodyLabel}
        </label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={7}
          placeholder={cfg.bodyPlaceholder}
          style={{
            width: '100%', fontSize: 16, fontFamily: 'inherit',
            padding: '13px 14px', borderRadius: 14,
            border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--ink)',
            marginBottom: 20, direction: 'rtl', resize: 'vertical',
            lineHeight: 1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="big-btn"
            style={{
              flex: 2,
              background: canSubmit ? `linear-gradient(135deg, ${cfg.accent}, ${cfg.accentDeep})` : 'var(--line-strong)',
              color: 'white',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'מפרסם...' : 'פרסם'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Post detail modal ───────────────────────────────────────
function PostDetailModal({ post, accent, myUid, onClose }) {
  const [likes, setLikes] = useState(post.likes || [])
  const iLiked = myUid && likes.includes(myUid)

  const handleLike = async () => {
    if (!myUid) return
    setLikes(prev => prev.includes(myUid)
      ? prev.filter(u => u !== myUid)
      : [...prev, myUid])
    await togglePostLike(post.id, myUid)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001,
      background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)',
        borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430,
        maxHeight: '88vh', overflowY: 'auto',
        direction: 'rtl',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)',
          margin: '0 auto 18px',
        }}/>

        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Avatar name={post.authorName} size={52} />
          <div>
            <div className="h-display" style={{ fontSize: 16, color: 'var(--ink)' }}>
              {post.authorName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>
              👁 {post.views || 0} צפיות
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="h-display" style={{
          fontSize: 24, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 14,
        }}>
          {post.title}
        </div>

        {/* Body */}
        <div style={{
          fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', marginBottom: 24,
        }}>
          {post.body}
        </div>

        {/* Like + close */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleLike}
            className="big-btn"
            style={{
              flex: 1,
              background: iLiked ? accent : 'var(--surface)',
              color: iLiked ? 'white' : 'var(--ink)',
              border: iLiked ? 'none' : '1px solid var(--line-strong)',
            }}
          >
            <IconHeart size={20} color={iLiked ? 'white' : accent} />
            אהבתי · {likes.length}
          </button>
          <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}
