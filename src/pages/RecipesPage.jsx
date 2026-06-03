// src/pages/RecipesPage.jsx
// ─────────────────────────────────────────────────────────────
// דף המתכונים — תבנית מובנית ועשירה.
//
// כל מתכון: שם, רשימת מצרכים, שלבי הכנה, זמן בישול/אפייה, עד 3 תמונות.
// שני כפתורים בכל מתכון: "❤️ אהבתי" ו-"🍳 הכנתי את המתכון".
//
// יצירה ידנית: ממלאים שדות מובנים. (בעתיד יתווסף "כתבי הכל ו-AI יסדר".)
// מתכונים ישנים (body חופשי) עדיין מוצגים — תאימות לאחור.
//
// הנתונים נשמרים ב-communityPosts (kind='recipe') ב-Firestore.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  watchCommunityPosts, createCommunityPost, incrementPostViews,
  togglePostLike, toggleRecipeCooked, uploadRecipePhoto, seedCommunityContent,
  updateCommunityPost, deleteCommunityPost,
} from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL, IconHeart } from '../icons/index.jsx'
import HomeButton from '../components/HomeButton.jsx'
import { RECIPE_CATEGORIES, categoryOf } from '../data/recipeCategories.js'

const ACCENT = '#7E2C2E'
const ACCENT_DEEP = '#5A1D1E'

// דוחס תמונת מתכון: עד 1000px ברוחב, JPEG ~150KB, מחזיר Blob להעלאה ל-Storage.
function compressRecipeImage(file, maxW = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('compress failed')),
          'image/jpeg', 0.78,
        )
      }
      img.onerror = () => reject(new Error('image load failed'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

export default function RecipesPage({ onBack, onHome, initialPostId = null }) {
  const { profile, authUser } = useUserStore()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPost, setOpenPost] = useState(null)
  const [composing, setComposing] = useState(false)
  const [editingPost, setEditingPost] = useState(null)   // מתכון שעורכים כרגע (null = יצירה חדשה)
  const [tab, setTab] = useState('all')                  // 'all' = כל המתכונים / 'mine' = המתכונים שלי
  const [activeCat, setActiveCat] = useState(null)       // קטגוריה נבחרת בלשונית "כל המתכונים" (null = גריד הקטגוריות)
  const [seeding, setSeeding] = useState(false)
  const openedInitialRef = useRef(false)

  useEffect(() => {
    setLoading(true)
    const unsub = watchCommunityPosts('recipe', list => {
      setPosts(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [])

  // הגענו מהתראת לייק — פותחים את המתכון הספציפי
  useEffect(() => {
    if (!initialPostId || openedInitialRef.current || posts.length === 0) return
    const post = posts.find(p => p.id === initialPostId)
    if (post) {
      openedInitialRef.current = true
      setOpenPost(post)
      incrementPostViews(post.id).catch(() => {})
    }
  }, [initialPostId, posts])

  // שומרים את הגרסה החיה של המתכון הפתוח (לייקים/הכנתי מתעדכנים בזמן אמת)
  const liveOpenPost = openPost ? (posts.find(p => p.id === openPost.id) || openPost) : null

  // המתכונים שאני כתבתי (לפי authorUid)
  const myUid = authUser?.uid
  const myRecipes = myUid ? posts.filter(p => p.authorUid === myUid) : []

  // ספירת מתכונים לכל קטגוריה (מתכון ללא קטגוריה → 'other')
  const countByCat = {}
  for (const p of posts) {
    const c = p.category || 'other'
    countByCat[c] = (countByCat[c] || 0) + 1
  }
  // מתכוני הקטגוריה הנבחרת — מתכונים עם תמונה מוצגים ראשונים
  const catRecipes = activeCat
    ? posts
        .filter(p => (p.category || 'other') === activeCat)
        .sort((a, b) => ((b.photos || []).length > 0 ? 1 : 0) - ((a.photos || []).length > 0 ? 1 : 0))
    : []

  const openItem = async (post) => {
    setOpenPost(post)
    await incrementPostViews(post.id)
  }

  // מחיקת מתכון — עם אישור
  const handleDelete = async (post) => {
    if (!window.confirm(`למחוק את המתכון "${post.title}"? לא ניתן לבטל.`)) return
    try {
      await deleteCommunityPost(post.id)
      if (openPost?.id === post.id) setOpenPost(null)
    } catch (e) {
      alert('לא הצלחנו למחוק — נסו שוב')
    }
  }

  const handleSeed = async () => {
    if (seeding) return
    setSeeding(true)
    try { await seedCommunityContent(authUser?.uid) }
    catch (e) { console.error('seed error:', e) }
    setSeeding(false)
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">מתכונים</div>
      </div>

      <div style={{ padding: '8px 20px 28px' }}>
        <button
          onClick={() => { setEditingPost(null); setComposing(true) }}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DEEP} 100%)`,
            color: '#FBF7EE', border: 'none', borderRadius: 18, padding: '15px 18px',
            fontSize: 17, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 8px 20px -8px ${ACCENT}88`, marginBottom: 18,
          }}
        >
          ➕ הוסף מתכון משלך
        </button>

        {/* לשוניות — כל המתכונים / המתכונים שלי */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 18, background: 'var(--surface-2)',
          borderRadius: 14, padding: 5,
        }}>
          <TabButton active={tab === 'all'} onClick={() => { setTab('all'); setActiveCat(null) }}>🍽️ כל המתכונים</TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>📖 המתכונים שלי{myRecipes.length > 0 ? ` (${myRecipes.length})` : ''}</TabButton>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-3)', fontSize: 16 }}>טוען...</div>
        ) : tab === 'mine' ? (
          /* ── לשונית "המתכונים שלי" ── */
          myRecipes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>📝</div>
              <div className="h-display" style={{ fontSize: 20, marginBottom: 6, color: 'var(--ink)' }}>עדיין לא כתבת מתכונים</div>
              <div style={{ fontSize: 15 }}>לחץ על "הוסף מתכון משלך" למעלה</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myRecipes.map(post => (
                <MyRecipeRow
                  key={post.id}
                  post={post}
                  onOpen={() => openItem(post)}
                  onEdit={() => { setEditingPost(post); setComposing(true) }}
                  onDelete={() => handleDelete(post)}
                />
              ))}
            </div>
          )
        ) : (
          /* ── לשונית "כל המתכונים" — מבנה קטגוריות ── */
          posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🍲</div>
              <div className="h-display" style={{ fontSize: 20, marginBottom: 6, color: 'var(--ink)' }}>עדיין אין מתכונים</div>
              <div style={{ fontSize: 15 }}>היה הראשון לשתף — לחץ על הכפתור למעלה</div>
              <button onClick={handleSeed} disabled={seeding} style={{
                marginTop: 24, background: 'var(--surface)', color: 'var(--ink-3)',
                border: '1px dashed var(--line-strong)', borderRadius: 12, padding: '10px 18px',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              }}>{seeding ? 'ממלא...' : '✨ מלא תוכן לדוגמה'}</button>
            </div>
          ) : activeCat ? (
            /* קטגוריה נבחרה — רשימת המתכונים שלה */
            <>
              <CategoryHeader cat={categoryOf(activeCat)} count={catRecipes.length} onBack={() => setActiveCat(null)} />
              {catRecipes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--ink-2)' }}>
                  <div style={{ fontSize: 48, marginBottom: 10 }}>{categoryOf(activeCat).emoji}</div>
                  <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)' }}>עדיין אין מתכונים בקטגוריה זו</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>היה הראשון להוסיף!</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {catRecipes.map(post => (
                    <RecipeCard key={post.id} post={post} myUid={authUser?.uid} onClick={() => openItem(post)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* גריד הקטגוריות */
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>עיינו לפי קטגוריה:</div>
                <button onClick={handleSeed} disabled={seeding} style={{
                  background: 'var(--surface)', color: 'var(--ink-3)',
                  border: '1px dashed var(--line-strong)', borderRadius: 10, padding: '6px 12px',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                }}>{seeding ? 'ממלא...' : '✨ מלא תוכן לדוגמה'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {RECIPE_CATEGORIES.filter(c => c.id !== 'other' || (countByCat['other'] || 0) > 0).map(cat => (
                  <CategoryCard
                    key={cat.id}
                    cat={cat}
                    count={countByCat[cat.id] || 0}
                    onClick={() => setActiveCat(cat.id)}
                  />
                ))}
              </div>
            </>
          )
        )}
      </div>

      {composing && (
        <RecipeComposer
          editPost={editingPost}
          onClose={() => { setComposing(false); setEditingPost(null) }}
          onSubmit={async ({ title, recipe, photos, category }) => {
            if (editingPost) {
              await updateCommunityPost(editingPost.id, { title, recipe, photos, category })
            } else {
              await createCommunityPost({
                kind: 'recipe', title, recipe, photos, category,
                authorUid: authUser?.uid, authorName: profile?.name || 'משתמש',
              })
            }
            setComposing(false); setEditingPost(null)
          }}
          uid={authUser?.uid}
        />
      )}

      {liveOpenPost && (
        <RecipeDetail
          post={liveOpenPost}
          myUid={authUser?.uid}
          onClose={() => setOpenPost(null)}
          onEdit={() => { setEditingPost(liveOpenPost); setComposing(true); setOpenPost(null) }}
          onDelete={() => handleDelete(liveOpenPost)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
// כרטיס מתכון ברשימה
// ════════════════════════════════════════════════════════
// כפתור לשונית (tab) — למעבר בין "כל המתכונים" ל"שלי"
function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '11px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? ACCENT : 'var(--ink-3)',
      boxShadow: active ? 'var(--shadow-sm)' : 'none',
      transition: 'background .15s, color .15s',
    }}>{children}</button>
  )
}

// ── כרטיס קטגוריה (גריד) — תמונת שער ריאליסטית עם fallback לגרדיאנט ──
function CategoryCard({ cat, count, onClick }) {
  const [imgOk, setImgOk] = useState(Boolean(cat.img))
  const showImg = cat.img && imgOk
  return (
    <button onClick={onClick} style={{
      border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
      borderRadius: 18, overflow: 'hidden', position: 'relative',
      aspectRatio: '1 / 0.82', boxShadow: 'var(--shadow-sm)',
      background: `linear-gradient(145deg, ${cat.grad[0]}, ${cat.grad[1]})`,
      display: 'block', width: '100%',
    }}>
      {/* תמונה ריאליסטית (אם קיימת ונטענה בהצלחה) */}
      {showImg && (
        <img
          src={cat.img}
          alt={cat.name}
          loading="lazy"
          onError={() => setImgOk(false)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      {/* אימוג'י גדול שקוף — רק כשאין תמונה (על הגרדיאנט) */}
      {!showImg && (
        <span style={{
          position: 'absolute', insetInlineStart: -6, bottom: -14, fontSize: 88,
          opacity: 0.28, lineHeight: 1, transform: 'rotate(-8deg)',
        }}>{cat.emoji}</span>
      )}
      {/* טקסט — עם הכהה תחתונה לקריאות על התמונה */}
      <div style={{
        position: 'absolute', inset: 0, padding: '14px 15px',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        textAlign: 'right',
        background: showImg
          ? 'linear-gradient(to top, rgba(20,23,42,.78) 0%, rgba(20,23,42,.15) 55%, rgba(20,23,42,0) 100%)'
          : 'linear-gradient(to top, rgba(20,23,42,.30) 0%, rgba(20,23,42,0) 60%)',
      }}>
        <div style={{ color: '#fff', fontSize: 19, fontWeight: 900, lineHeight: 1.15, textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
          {cat.name}
        </div>
        <div style={{ color: 'rgba(255,255,255,.92)', fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>
          {count} {count === 1 ? 'מתכון' : 'מתכונים'}
        </div>
      </div>
    </button>
  )
}

// ── כותרת קטגוריה (מעל רשימת המתכונים) עם כפתור חזרה ──
function CategoryHeader({ cat, count, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} aria-label="חזרה לקטגוריות" style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconBackRTL size={20} color="#1B2540" />
      </button>
      <span style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, fontSize: 22,
        background: `linear-gradient(145deg, ${cat.grad[0]}, ${cat.grad[1]})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{cat.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 21, color: 'var(--ink)', lineHeight: 1.1 }}>{cat.name}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>{count} {count === 1 ? 'מתכון' : 'מתכונים'}</div>
      </div>
    </div>
  )
}

function MyRecipeRow({ post, onOpen, onEdit, onDelete }) {
  const cover = (post.photos || [])[0] || null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 14, padding: '10px 12px',
    }}>
      <button onClick={onOpen} style={{
        width: 52, height: 52, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
        background: 'var(--surface-2)', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {cover
          ? <img src={cover} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 24 }}>🍲</span>}
      </button>
      <button onClick={onOpen} style={{
        flex: 1, minWidth: 0, textAlign: 'right', background: 'none', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>
        <div className="h-display" style={{
          fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{post.title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
          ❤ {(post.likes || []).length} · 🍳 {(post.cooked || []).length}
        </div>
      </button>
      <button onClick={onEdit} aria-label="ערוך" title="ערוך" style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 18,
      }}>✏️</button>
      <button onClick={onDelete} aria-label="מחק" title="מחק" style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
        border: '1px solid var(--line)', background: 'var(--surface-2)', fontSize: 18,
      }}>🗑️</button>
    </div>
  )
}

function RecipeCard({ post, myUid, onClick }) {
  const likeCount = (post.likes || []).length
  const cookedCount = (post.cooked || []).length
  const iLiked = myUid && (post.likes || []).includes(myUid)
  const cover = (post.photos || [])[0] || null
  const ingredientCount = post.recipe?.ingredients?.length || 0

  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'right', background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)', fontFamily: 'inherit', display: 'block', padding: 0,
    }}>
      {/* תמונת שער אם יש */}
      {cover && (
        <div style={{ width: '100%', height: 160, overflow: 'hidden', background: 'var(--surface-2)' }}>
          <img src={cover} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>
        {/* תגית קטגוריה */}
        {post.category && (
          <span style={{
            display: 'inline-block', fontSize: 11.5, fontWeight: 800, color: ACCENT,
            background: 'var(--burgundy-soft)', padding: '3px 10px', borderRadius: 999, marginBottom: 8,
          }}>{categoryOf(post.category).name}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Avatar name={post.authorName} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-display" style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 3 }}>
              {post.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>מאת {post.authorName}</div>
          </div>
        </div>

        {/* תקציר — מצרכים אם מובנה, אחרת body */}
        {ingredientCount > 0 ? (
          <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, fontWeight: 600 }}>
            🧺 {ingredientCount} מצרכים{post.recipe?.cookTime ? ` · ⏱ ${post.recipe.cookTime}` : ''}
          </div>
        ) : (
          <div style={{
            fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{post.body}</div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginTop: 10,
          fontSize: 13, color: 'var(--ink-3)', fontWeight: 600,
        }}>
          <span>👁 {post.views || 0}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: iLiked ? ACCENT : 'var(--ink-3)' }}>
            <IconHeart size={15} color={iLiked ? ACCENT : '#8389A4'} /> {likeCount}
          </span>
          {cookedCount > 0 && <span>🍳 {cookedCount} הכינו</span>}
          <span style={{ marginInlineStart: 'auto', color: ACCENT, fontWeight: 700 }}>למתכון ←</span>
        </div>
      </div>
    </button>
  )
}

// ════════════════════════════════════════════════════════
// מסך יצירת מתכון — תבנית מובנית
// ════════════════════════════════════════════════════════
function RecipeComposer({ onClose, onSubmit, uid, editPost = null }) {
  const [title, setTitle] = useState(editPost?.title || '')
  const [category, setCategory] = useState(editPost?.category || 'cakes')
  // מצרכים ושלבים כטקסט חופשי — שורה לכל פריט (הרבה יותר נוח מהפלוס)
  const [ingredientsText, setIngredientsText] = useState(
    (editPost?.recipe?.ingredients || []).join('\n')
  )
  const [stepsText, setStepsText] = useState(
    (editPost?.recipe?.steps || []).join('\n')
  )
  const [photos, setPhotos] = useState(
    (editPost?.photos || []).map((url, i) => ({ url, uploading: false, key: `existing-${i}` }))
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const canSubmit = title.trim().length > 0
    && ingredientsText.trim().length > 0
    && stepsText.trim().length > 0

  // מפצלים טקסט לשורות, מנקים שורות ריקות
  const splitLines = (text) =>
    text.split('\n').map(l => l.trim()).filter(Boolean)

  // ── תמונות ──
  const handlePhotoPick = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const room = 3 - photos.length
    const toAdd = files.slice(0, room)
    for (const file of toAdd) {
      if (!file.type.startsWith('image/')) continue
      const placeholder = { url: null, uploading: true, key: Date.now() + Math.random() }
      setPhotos(prev => [...prev, placeholder])
      try {
        const blob = await compressRecipeImage(file)
        const url = await uploadRecipePhoto({ uid, blob })
        setPhotos(prev => prev.map(p => p.key === placeholder.key ? { ...p, url, uploading: false } : p))
      } catch (e2) {
        console.error('recipe photo upload error:', e2)
        setPhotos(prev => prev.filter(p => p.key !== placeholder.key))
        setErr('לא הצלחנו להעלות את התמונה')
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  const removePhoto = (key) => setPhotos(prev => prev.filter(p => p.key !== key))

  const handleSubmit = async () => {
    if (!canSubmit || saving) return
    if (photos.some(p => p.uploading)) { setErr('יש תמונה שעוד נטענת — רגע'); return }
    setSaving(true); setErr('')
    try {
      await onSubmit({
        title,
        category,
        recipe: {
          ingredients: splitLines(ingredientsText),
          steps: splitLines(stepsText),
          cookTime: '',
        },
        photos: photos.map(p => p.url).filter(Boolean),
      })
    } catch (e) {
      console.error(e); setSaving(false); setErr('לא הצלחנו לפרסם — נסו שוב')
    }
  }

  const inputStyle = {
    width: '100%', fontSize: 16, fontFamily: 'inherit', padding: '12px 14px', borderRadius: 12,
    border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', direction: 'rtl',
  }
  const labelStyle = { fontSize: 15, fontWeight: 800, color: 'var(--ink)', display: 'block', marginBottom: 4, marginTop: 18 }
  const hintStyle = { fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
        padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430, maxHeight: '92vh', overflowY: 'auto', direction: 'rtl',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '0 auto 18px' }} />
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>{editPost ? '✏️ עריכת מתכון' : '🍲 מתכון חדש'}</div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 6 }}>מלאו את הפרטים — אחרים ישמחו לנסות</div>

        {/* שם המתכון */}
        <label style={labelStyle}>שם המתכון</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="למשל: עוגת תפוחים של ענת" style={inputStyle} />

        {/* קטגוריה — צ'יפים נבחרים */}
        <label style={labelStyle}>קטגוריה</label>
        <div style={hintStyle}>בחרו לאיזה סוג מתאים המתכון</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {RECIPE_CATEGORIES.filter(c => c.id !== 'other').map(c => {
            const sel = category === c.id
            return (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14.5, fontWeight: 700,
                border: `1.5px solid ${sel ? ACCENT : 'var(--line-strong)'}`,
                background: sel ? ACCENT : 'var(--surface)',
                color: sel ? '#fff' : 'var(--ink)',
              }}>
                <span style={{ fontSize: 17 }}>{c.emoji}</span>
                <span>{c.name}</span>
              </button>
            )
          })}
        </div>

        {/* מצרכים — שדה טקסט חופשי, שורה לכל מצרך */}
        <label style={labelStyle}>🧺 מצרכים</label>
        <div style={hintStyle}>כתבו כל מצרך בשורה נפרדת</div>
        <textarea
          value={ingredientsText}
          onChange={e => setIngredientsText(e.target.value)}
          placeholder={'2 כוסות קמח\n1 כוס סוכר\n3 ביצים\n100 גרם חמאה'}
          rows={6}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
        />

        {/* אופן ההכנה — שדה טקסט חופשי */}
        <label style={labelStyle}>👩‍🍳 אופן ההכנה</label>
        <div style={hintStyle}>כתבו כל שלב בשורה נפרדת</div>
        <textarea
          value={stepsText}
          onChange={e => setStepsText(e.target.value)}
          placeholder={'מחממים את התנור ל-180 מעלות\nמערבבים את החומרים היבשים\nמוסיפים את הביצים ומערבבים\nאופים 45 דקות'}
          rows={7}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
        />

        {/* תמונות */}
        <label style={labelStyle}>📷 תמונות (עד 3)</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {photos.map(p => (
            <div key={p.key} style={{
              width: 90, height: 90, borderRadius: 12, overflow: 'hidden', position: 'relative',
              background: 'var(--surface-2)', border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {p.uploading ? (
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>טוען...</span>
              ) : (
                <>
                  <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removePhoto(p.key)} aria-label="הסר תמונה" style={{
                    position: 'absolute', top: 4, insetInlineEnd: 4, width: 24, height: 24, borderRadius: '50%',
                    background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
                </>
              )}
            </div>
          ))}
          {photos.length < 3 && (
            <button onClick={() => fileRef.current?.click()} style={{
              width: 90, height: 90, borderRadius: 12, border: '2px dashed var(--line-strong)',
              background: 'var(--surface)', color: 'var(--ink-3)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 24 }}>📷</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>הוסף</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoPick} style={{ display: 'none' }} />
        </div>

        {err && (
          <div style={{ background: 'var(--burgundy-soft)', color: ACCENT, padding: '10px', borderRadius: 10, fontSize: 14, fontWeight: 700, marginTop: 16, textAlign: 'center' }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} className="big-btn big-btn--ghost" style={{ flex: 1 }}>ביטול</button>
          <button onClick={handleSubmit} disabled={!canSubmit || saving} className="big-btn" style={{
            flex: 2, background: canSubmit ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` : 'var(--line-strong)',
            color: 'white', opacity: saving ? 0.7 : 1,
          }}>{saving ? 'שומר...' : (editPost ? 'שמור שינויים' : 'פרסם מתכון')}</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך צפייה במתכון
// ════════════════════════════════════════════════════════
function RecipeDetail({ post, myUid, onClose, onEdit, onDelete }) {
  const likes = post.likes || []
  const cooked = post.cooked || []
  const iLiked = myUid && likes.includes(myUid)
  const iCooked = myUid && cooked.includes(myUid)
  const isMine = myUid && post.authorUid === myUid
  const photos = post.photos || []
  const recipe = post.recipe || null
  const [photoIdx, setPhotoIdx] = useState(0)

  const handleLike = async () => {
    if (!myUid) return
    await togglePostLike(post.id, myUid)
  }
  const handleCooked = async () => {
    if (!myUid) return
    await toggleRecipeCooked(post.id, myUid)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1001, background: 'rgba(20,23,42,0.55)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-app)', borderRadius: '24px 24px 0 0',
        padding: '0 0 calc(22px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 430, maxHeight: '92vh', overflowY: 'auto', direction: 'rtl',
      }}>
        {/* תמונה גדולה למעלה (אם יש) */}
        {photos.length > 0 && (
          <div style={{ position: 'relative', width: '100%', height: 240, background: 'var(--surface-2)', overflow: 'hidden' }}>
            <img src={photos[photoIdx]} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 10, insetInline: 0, display: 'flex',
                justifyContent: 'center', gap: 6,
              }}>
                {photos.map((_, i) => (
                  <button key={i} onClick={() => setPhotoIdx(i)} aria-label={`תמונה ${i + 1}`} style={{
                    width: 9, height: 9, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: i === photoIdx ? '#fff' : 'rgba(255,255,255,.5)',
                  }} />
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '20px' }}>
          <div style={{
            width: 40, height: 4, borderRadius: 2, background: 'var(--line-strong)',
            margin: photos.length > 0 ? '0 auto 16px' : '4px auto 16px',
          }} />

          {/* מחבר */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <Avatar name={post.authorName} size={48} />
            <div>
              <div className="h-display" style={{ fontSize: 16, color: 'var(--ink)' }}>{post.authorName}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600 }}>👁 {post.views || 0} צפיות</div>
            </div>
          </div>

          {/* שם */}
          {post.category && (
            <span style={{
              display: 'inline-block', fontSize: 12, fontWeight: 800, color: ACCENT,
              background: 'var(--burgundy-soft)', padding: '4px 12px', borderRadius: 999, marginBottom: 10,
            }}>{categoryOf(post.category).name}</span>
          )}
          <div className="h-display" style={{ fontSize: 26, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8 }}>
            {post.title}
          </div>

          {/* זמן בישול */}
          {recipe?.cookTime && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)',
              borderRadius: 999, padding: '6px 14px', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 18,
            }}>⏱ {recipe.cookTime}</div>
          )}

          {recipe ? (
            <>
              {/* מצרכים */}
              {recipe.ingredients?.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div className="h-display" style={{ fontSize: 19, color: ACCENT, marginBottom: 10 }}>🧺 מצרכים</div>
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px',
                  }}>
                    {recipe.ingredients.map((ing, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0',
                        borderBottom: i < recipe.ingredients.length - 1 ? '1px solid var(--line)' : 'none',
                        fontSize: 16, color: 'var(--ink)', lineHeight: 1.4,
                      }}>
                        <span style={{ color: ACCENT, fontWeight: 800, flexShrink: 0 }}>•</span>
                        <span>{ing}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* אופן ההכנה */}
              {recipe.steps?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div className="h-display" style={{ fontSize: 19, color: ACCENT, marginBottom: 10 }}>👩‍🍳 אופן ההכנה</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recipe.steps.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          width: 32, height: 32, borderRadius: '50%', background: ACCENT, color: '#fff',
                          fontSize: 16, fontWeight: 800, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</span>
                        <div style={{ flex: 1, fontSize: 16, color: 'var(--ink)', lineHeight: 1.6, paddingTop: 4 }}>{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // מתכון ישן — body חופשי (תאימות לאחור)
            <div style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 24 }}>
              {post.body}
            </div>
          )}

          {/* שני הכפתורים — אהבתי / הכנתי */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button onClick={handleLike} className="big-btn" style={{
              flex: 1, background: iLiked ? ACCENT : 'var(--surface)', color: iLiked ? 'white' : 'var(--ink)',
              border: iLiked ? 'none' : '1px solid var(--line-strong)',
            }}>
              <IconHeart size={20} color={iLiked ? 'white' : ACCENT} />
              אהבתי · {likes.length}
            </button>
            <button onClick={handleCooked} className="big-btn" style={{
              flex: 1, background: iCooked ? 'var(--forest)' : 'var(--surface)', color: iCooked ? 'white' : 'var(--ink)',
              border: iCooked ? 'none' : '1px solid var(--line-strong)',
            }}>
              🍳 {iCooked ? 'הכנתי!' : 'הכנתי את המתכון'}{cooked.length > 0 ? ` · ${cooked.length}` : ''}
            </button>
          </div>
          <button onClick={onClose} className="big-btn big-btn--ghost" style={{ width: '100%' }}>סגור</button>

          {/* כפתורי עריכה/מחיקה — רק למתכון שלי */}
          {isMine && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={onEdit} className="big-btn" style={{
                flex: 1, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line-strong)',
              }}>✏️ ערוך</button>
              <button onClick={onDelete} className="big-btn" style={{
                flex: 1, background: 'var(--surface)', color: 'var(--danger)', border: '1px solid var(--danger)',
              }}>🗑️ מחק</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
