// src/pages/GreetingMaker.jsx
// ─────────────────────────────────────────────────────────────
// מחולל ברכה אישית — בסגנון Canva למובייל.
//
// זרימה:
//   1. כתיבת הברכה (טקסט + מאת)
//   2. בחירת תבנית + עריכה דרך סרגל תחתון עם לשוניות
//
// מבנה מסך העריכה (DesignStep):
//   • למעלה: כותרת + כפתורי שמירה/שיתוף
//   • באמצע: תצוגה מקדימה של הברכה (תופסת רוב המסך)
//   • למטה: סרגל לשוניות (תבניות, טקסט, מאת, פונט, צבע, גודל)
//   • לחיצה על לשונית פותחת bottom sheet עם הבחירות
//
// כל תבנית יודעת איפה בכרטיס לשבץ את הטקסט (top/center/bottom)
// כדי שלא יחפוף לאיור.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { IconBackRTL } from '../icons/index.jsx'

// מטמון לתמונות רקע שכבר הומרו ל-base64 (לפי url)
const bgDataCache = {}

// טוען תמונה וממיר אותה ל-data URL (base64).
// זה הכרחי כדי שהתמונה תופיע בתוך SVG שמוטמע ב-data URL,
// וגם כדי ששמירת ה-PNG תעבוד (canvas לא מזדהם).
function loadBgAsDataURL(url) {
  return new Promise((resolve, reject) => {
    if (bgDataCache[url]) { resolve(bgDataCache[url]); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      try {
        const dataUrl = canvas.toDataURL('image/png')
        bgDataCache[url] = dataUrl
        resolve(dataUrl)
      } catch (e) { reject(e) }
    }
    img.onerror = () => reject(new Error('bg image load failed: ' + url))
    img.src = url
  })
}

const MAX_TEXT = 120

// ═══════════════════════════════════════════════════════════════
// פונטים
// ═══════════════════════════════════════════════════════════════
const FONTS = [
  { id: 'heebo',    name: 'מודרני',    css: "'Heebo', sans-serif",       weight: 800 },
  { id: 'frank',    name: 'קלאסי',     css: "'Frank Ruhl Libre', serif", weight: 900 },
  { id: 'suez',     name: 'חגיגי',     css: "'Suez One', serif",         weight: 400 },
  { id: 'bellefair',name: 'יוקרתי',    css: "'Bellefair', serif",        weight: 400 },
  { id: 'amatic',   name: 'מצויר ביד', css: "'Amatic SC', cursive",      weight: 700 },
  { id: 'secular',  name: 'ידידותי',   css: "'Secular One', sans-serif", weight: 400 },
]

// ═══════════════════════════════════════════════════════════════
// פלטות צבע
// ═══════════════════════════════════════════════════════════════
const PALETTES = [
  { id: 'burgundy', name: 'בורדו',  bg: '#7E2C2E', bgDeep: '#5A1D1E', ink: '#FBF7EE', accent: '#E8C879' },
  { id: 'teal',     name: 'טורקיז', bg: '#2C5566', bgDeep: '#173846', ink: '#FBF7EE', accent: '#E8C879' },
  { id: 'forest',   name: 'ירוק',   bg: '#4F6B4A', bgDeep: '#354D31', ink: '#FBF7EE', accent: '#D9C89A' },
  { id: 'wine',     name: 'יין',    bg: '#6B3A4F', bgDeep: '#482638', ink: '#FBF7EE', accent: '#E8C879' },
  { id: 'cream',    name: 'שמנת',   bg: '#F4EFE6', bgDeep: '#E8DEC8', ink: '#2A2118', accent: '#7E2C2E' },
  { id: 'navy',     name: 'נייבי',  bg: '#1B2540', bgDeep: '#0E1730', ink: '#FBF7EE', accent: '#B89048' },
]

// ═══════════════════════════════════════════════════════════════
// גדלי טקסט
// ═══════════════════════════════════════════════════════════════
const TEXT_SIZES = [
  { id: 'sm', name: 'קטן',   scale: 0.82 },
  { id: 'md', name: 'בינוני', scale: 1.0  },
  { id: 'lg', name: 'גדול',  scale: 1.18 },
]

// ═══════════════════════════════════════════════════════════
// רקעי תמונה — תמונות מאוירות שמונחות ב-public/backgrounds/
// ═══════════════════════════════════════════════════════════
// כל רקע מגדיר:
//   url      — נתיב הקובץ (מתוך public, מתחיל ב-/)
//   textZone — איפה הטקסט ישב: top / center / bottom
//   ink      — צבע הטקסט (כהה לרקע בהיר, בהיר לרקע כהה)
//   accent   — צבע הקו המפריד והעיטורים
//   label    — השם שמופיע למשתמש
//
// להוספת רקע חדש: שמור תמונה ב-public/backgrounds/ והוסף שורה כאן.
//
const BACKGROUNDS = [
  { id: 'bg-shabbat', url: '/backgrounds/Gemini_Generated_Image_sph265sph265sph2.png', textZone: 'top',
    ink: '#5A3D2B', accent: '#B89048', label: 'שבת שלום' },
  { id: 'bg-2', url: '/backgrounds/Gemini_Generated_Image_h9770jh9770jh977.png', textZone: 'top',
    ink: '#5A3D2B', accent: '#B89048', label: 'ברכה' },
]

// ═══════════════════════════════════════════════════════════════
// תבניות — כל אחת מציינת איפה הטקסט יישב (textZone)
// ═══════════════════════════════════════════════════════════════
// textZone:
//   • 'top'    — איור גדול תופס את האמצע, הטקסט בשליש העליון
//   • 'center' — איור באזורים שוליים, הטקסט באמצע
//   • 'bottom' — איור גדול תופס למעלה, הטקסט בשליש התחתון
//
const TEMPLATES = [
  // ── איורים מובנים ─────────────────────────────────────────
  { id: 't01', type: 'illustration', illust: 'menorah',     textZone: 'bottom',
    defaultPalette: 'navy',     defaultFont: 'frank',     label: 'חנוכייה' },
  { id: 't02', type: 'illustration', illust: 'pomegranate', textZone: 'center',
    defaultPalette: 'burgundy', defaultFont: 'frank',     label: 'רימון' },
  { id: 't03', type: 'illustration', illust: 'flowers',     textZone: 'center',
    defaultPalette: 'cream',    defaultFont: 'amatic',    label: 'פרחים' },

  // ── תמונות לאירועים ───────────────────────────────────────
  { id: 't04', type: 'illustration', illust: 'roses',       textZone: 'top',
    defaultPalette: 'wine',     defaultFont: 'bellefair',  label: 'זר ורדים' },
  { id: 't05', type: 'illustration', illust: 'cake',        textZone: 'top',
    defaultPalette: 'burgundy', defaultFont: 'suez',       label: 'יום הולדת' },
  { id: 't06', type: 'illustration', illust: 'doves',       textZone: 'bottom',
    defaultPalette: 'cream',    defaultFont: 'bellefair',  label: 'חתונה' },

  // ── מינימליסטיים ──────────────────────────────────────────
  { id: 't07', type: 'minimal', shape: 'circle', textZone: 'center',
    defaultPalette: 'teal',   defaultFont: 'heebo',   label: 'עיגול' },
  { id: 't08', type: 'minimal', shape: 'arc',    textZone: 'center',
    defaultPalette: 'forest', defaultFont: 'secular', label: 'קשת' },
  { id: 't09', type: 'minimal', shape: 'stripe', textZone: 'center',
    defaultPalette: 'wine',   defaultFont: 'heebo',   label: 'פס' },

  // ── אלגנטיים ──────────────────────────────────────────────
  { id: 't10', type: 'elegant', frame: 'double',  textZone: 'center',
    defaultPalette: 'forest', defaultFont: 'bellefair', label: 'בוטיק' },
  { id: 't11', type: 'elegant', frame: 'corners', textZone: 'center',
    defaultPalette: 'navy',   defaultFont: 'frank',     label: 'פינות' },
  { id: 't12', type: 'elegant', frame: 'simple',  textZone: 'center',
    defaultPalette: 'cream',  defaultFont: 'bellefair', label: 'הזמנה' },
]

// ═══════════════════════════════════════════════════════════════
// ברכות מוכנות
// ═══════════════════════════════════════════════════════════════
const PRESET_GREETINGS = {
  'ימים': [
    'שבוע טוב ומבורך', 'יום שני מבורך', 'שבת שלום ומבורכת',
    'בוקר טוב ומואר', 'ערב טוב ונעים',
  ],
  'חגים': [
    'שנה טובה ומתוקה', 'גמר חתימה טובה', 'חג סוכות שמח',
    'חנוכה שמח ומואר', 'פורים שמח', 'חג פסח כשר ושמח',
    'חג שבועות שמח',
  ],
  'איחולים': [
    'מזל טוב!', 'יום הולדת שמח', 'רפואה שלמה', 'בהצלחה רבה',
    'באהבה רבה', 'תודה רבה לך',
  ],
}

// ═══════════════════════════════════════════════════════════════
// המסך הראשי
// ═══════════════════════════════════════════════════════════════
export default function GreetingMaker({ onBack }) {
  const { profile } = useUserStore()
  const [step, setStep] = useState('text')

  const [text, setText] = useState('')
  const [senderName, setSenderName] = useState(profile?.name || '')

  const [templateId, setTemplateId] = useState('t07')
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0]
  const [paletteId, setPaletteId] = useState(tpl.defaultPalette)
  const [fontId, setFontId] = useState(tpl.defaultFont)
  const [sizeId, setSizeId] = useState('md')

  const selectTemplate = (id) => {
    const t = TEMPLATES.find(x => x.id === id)
    if (!t) return
    setTemplateId(id)
    setPaletteId(t.defaultPalette)
    setFontId(t.defaultFont)
  }

  const goBack = () => step === 'design' ? setStep('text') : onBack()

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {step === 'text' ? (
        <>
          <div className="screen-header">
            <button className="screen-header__back" onClick={goBack} aria-label="חזרה">
              <IconBackRTL size={24} color="#1B2540" />
            </button>
            <div className="screen-header__title">ברכה אישית</div>
          </div>
          <div style={{ padding: '8px 20px 32px' }}>
            <TextStep
              text={text} setText={setText}
              onNext={() => setStep('design')}
            />
          </div>
        </>
      ) : (
        <DesignStep
          onBack={goBack}
          text={text} setText={setText}
          senderName={senderName} setSenderName={setSenderName}
          templateId={templateId} selectTemplate={selectTemplate}
          paletteId={paletteId} setPaletteId={setPaletteId}
          fontId={fontId} setFontId={setFontId}
          sizeId={sizeId} setSizeId={setSizeId}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — כתיבת הטקסט (ללא שינוי מהותי)
// ═══════════════════════════════════════════════════════════════
function TextStep({ text, setText, onNext }) {
  const [openCat, setOpenCat] = useState('ימים')

  return (
    <>
      <p style={{
        fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.5,
        marginTop: 0, marginBottom: 16, fontWeight: 500,
      }}>
        כתבו ברכה משלכם, או בחרו מהמוכנות:
      </p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
        rows={3}
        maxLength={MAX_TEXT}
        placeholder="כתבו כאן את הברכה שלכם..."
        style={{
          width: '100%', fontSize: 18, fontFamily: 'inherit',
          padding: '14px', borderRadius: 14,
          border: '2px solid var(--line-strong)',
          background: 'var(--surface)', color: 'var(--ink)',
          marginBottom: 6, direction: 'rtl', resize: 'vertical',
          lineHeight: 1.4,
        }}
      />

      <div style={{
        textAlign: 'left', fontSize: 13, fontWeight: 600,
        color: text.length >= MAX_TEXT ? 'var(--burgundy)' : 'var(--ink-3)',
        marginBottom: 18,
      }}>
        {text.length} / {MAX_TEXT} תווים
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {Object.keys(PRESET_GREETINGS).map(cat => (
          <button key={cat} onClick={() => setOpenCat(cat)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 12,
            background: openCat === cat ? 'var(--burgundy)' : 'var(--surface)',
            color: openCat === cat ? 'white' : 'var(--ink-2)',
            border: openCat === cat ? 'none' : '1px solid var(--line)',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          }}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {PRESET_GREETINGS[openCat].map((g, i) => (
          <button key={i} onClick={() => setText(g)} style={{
            width: '100%', textAlign: 'right',
            background: text === g ? 'var(--burgundy-soft)' : 'var(--surface)',
            border: text === g ? '2px solid var(--burgundy)' : '1px solid var(--line)',
            borderRadius: 12, padding: '13px 14px',
            fontSize: 16, fontWeight: 600, color: 'var(--ink)',
            fontFamily: 'inherit',
          }}>
            {g}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!text.trim()}
        className="big-btn big-btn--primary"
        style={{ width: '100%', opacity: text.trim() ? 1 : 0.5 }}
      >
        המשך לעיצוב ←
      </button>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// STEP 2 — מסך עיצוב בסגנון Canva
// ═══════════════════════════════════════════════════════════════
function DesignStep({
  onBack, text, setText, senderName, setSenderName,
  templateId, selectTemplate,
  paletteId, setPaletteId, fontId, setFontId, sizeId, setSizeId,
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // איזו לשונית פתוחה ב-bottom sheet (null = סגור)
  const [activeTab, setActiveTab] = useState(null)
  // רקע תמונה נבחר (null = משתמשים בצבע/תבנית רגילה)
  const [bgId, setBgId] = useState(null)
  const bgMeta = BACKGROUNDS.find(b => b.id === bgId) || null
  // ה-base64 של תמונת הרקע (נטען אסינכרונית)
  const [bgData, setBgData] = useState(null)

  // כשבוחרים רקע — טוענים את התמונה וממירים ל-base64
  useEffect(() => {
    if (!bgMeta) { setBgData(null); return }
    let cancelled = false
    loadBgAsDataURL(bgMeta.url)
      .then(d => { if (!cancelled) setBgData(d) })
      .catch(() => { if (!cancelled) setBgData(null) })
    return () => { cancelled = true }
  }, [bgMeta])

  // אובייקט הרקע שמועבר ל-buildSVG: משלב מטה-data עם ה-base64
  const bg = (bgMeta && bgData) ? { ...bgMeta, dataUrl: bgData } : null

  const palette = PALETTES.find(p => p.id === paletteId) || PALETTES[0]
  const font = FONTS.find(f => f.id === fontId) || FONTS[0]
  const size = TEXT_SIZES.find(s => s.id === sizeId) || TEXT_SIZES[1]
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0]
  // השם אופציונלי — אם ריק, לא מופיע כלל בכרטיס
  const cardName = senderName.trim()

  const svg = buildSVG({ text, cardName, tpl, palette, font, size, bg })
  const previewSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

  const buildThumb = (t) => {
    const p = PALETTES.find(x => x.id === t.defaultPalette) || PALETTES[0]
    const f = FONTS.find(x => x.id === t.defaultFont) || FONTS[0]
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      buildSVG({ text: text || 'ברכה', cardName, tpl: t, palette: p, font: f, size: TEXT_SIZES[1] })
    )
  }

  const renderPNG = () => new Promise((resolve, reject) => {
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1080; canvas.height = 1080
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 1080, 1080)
        URL.revokeObjectURL(url)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
      img.src = url
    } catch (e) { reject(e) }
  })

  const handleSave = async () => {
    setBusy(true); setMsg('')
    try {
      const blob = await renderPNG()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'ברכה-אישית.png'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMsg('✓ נשמר!')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      console.error(e); setMsg('שגיאה בשמירה')
    }
    setBusy(false)
  }

  const handleShare = async () => {
    setBusy(true); setMsg('')
    try {
      const blob = await renderPNG()
      const file = new File([blob], 'ברכה-אישית.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: text, text })
      } else if (navigator.share) {
        await navigator.share({ title: text, text })
      } else {
        const t = encodeURIComponent(text + '\n\nנוצר באמצעות אפליקציית ביחד')
        window.open(`https://wa.me/?text=${t}`, '_blank')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') { console.error(e); setMsg('שיתוף נכשל') }
    }
    setBusy(false)
  }

  // ── הלשוניות של הסרגל התחתון ─────────────────────────────
  const TABS = [
    { id: 'templates', label: 'תבניות', emoji: '🎨' },
    { id: 'backgrounds', label: 'רקע', emoji: '🖼️' },
    { id: 'text',      label: 'טקסט',   emoji: '✏️' },
    { id: 'sender',    label: 'שם המאחל', emoji: '👤' },
    { id: 'font',      label: 'פונט',   emoji: '🔤' },
    { id: 'color',     label: 'צבע',    emoji: '🎨' },
    { id: 'size',      label: 'גודל',   emoji: '🔠' },
  ]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', maxHeight: '100vh', overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ─── כותרת עליונה: חזרה + שמירה/שיתוף ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px',
        background: 'var(--bg-app)',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="חזרה" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <IconBackRTL size={20} color="#1B2540" />
        </button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
          עצבו את הברכה
        </div>
        <button onClick={handleShare} disabled={busy} style={{
          padding: '10px 16px', borderRadius: 12,
          background: 'var(--burgundy)', color: 'white',
          border: 'none', fontSize: 14, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer',
          opacity: busy ? 0.6 : 1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          📲 שתף
        </button>
        <button onClick={handleSave} disabled={busy} aria-label="שמור" style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 18,
          opacity: busy ? 0.6 : 1,
        }}>
          📥
        </button>
      </div>

      {/* הודעת מצב */}
      {msg && (
        <div style={{
          textAlign: 'center', padding: '6px 16px',
          background: 'var(--burgundy-soft)', color: 'var(--burgundy)',
          fontSize: 14, fontWeight: 700,
        }}>{msg}</div>
      )}

      {/* ─── תצוגה מקדימה גדולה ─── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'var(--bg-page)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: '100%', maxWidth: 'min(100%, calc(100vh - 280px))',
          aspectRatio: '1',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          background: palette.bgDeep,
        }}>
          <img src={previewSrc} alt="תצוגה מקדימה"
               style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      {/* ─── סרגל לשוניות תחתון ─── */}
      <div style={{
        flexShrink: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          padding: '8px 4px',
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 4px', border: 'none',
              background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4,
              fontFamily: 'inherit',
              color: 'var(--ink)',
            }}>
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── רצועת בחירות — נפתחת מעל הסרגל לפי הלשונית הפעילה ─── */}
      {activeTab && (
        <EditStrip
          title={TABS.find(t => t.id === activeTab)?.label}
          onClose={() => setActiveTab(null)}
        >
          {activeTab === 'templates' && (
            <HScroll>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { setBgId(null); selectTemplate(t.id) }} style={{
                  padding: 0,
                  border: (t.id === templateId && !bg) ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                  borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  background: 'var(--surface)',
                  width: 92, height: 92, flexShrink: 0,
                }}>
                  <img src={buildThumb(t)} alt={t.label}
                       style={{ width: '100%', height: '100%', display: 'block' }} />
                </button>
              ))}
            </HScroll>
          )}

          {activeTab === 'backgrounds' && (
            <HScroll>
              {/* אפשרות "ללא רקע" — חוזרים לצבע/תבנית */}
              <button onClick={() => setBgId(null)} style={{
                padding: 0,
                border: !bg ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                borderRadius: 12, cursor: 'pointer',
                background: 'var(--surface)',
                width: 92, height: 92, flexShrink: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
                color: 'var(--ink-2)', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 22 }}>✕</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>ללא רקע</span>
              </button>
              {BACKGROUNDS.map(b => (
                <button key={b.id} onClick={() => setBgId(b.id)} style={{
                  padding: 0,
                  border: bg?.id === b.id ? '3px solid var(--burgundy)' : '2px solid var(--line)',
                  borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  background: 'var(--surface)',
                  width: 92, height: 92, flexShrink: 0,
                  position: 'relative',
                }}>
                  <img src={b.url} alt={b.label}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </HScroll>
          )}

          {activeTab === 'text' && (
            <div style={{ width: '100%' }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_TEXT))}
                rows={2}
                maxLength={MAX_TEXT}
                placeholder="כתבו כאן את הברכה..."
                style={{
                  width: '100%', fontSize: 16, fontFamily: 'inherit',
                  padding: '10px 12px', borderRadius: 10,
                  border: '1.5px solid var(--line-strong)',
                  background: 'var(--bg-app)', color: 'var(--ink)',
                  direction: 'rtl', resize: 'none', lineHeight: 1.4,
                }}
              />
              <div style={{
                textAlign: 'left', fontSize: 12, fontWeight: 600, marginTop: 4,
                color: text.length >= MAX_TEXT ? 'var(--burgundy)' : 'var(--ink-3)',
              }}>
                {text.length} / {MAX_TEXT}
              </div>
            </div>
          )}

          {activeTab === 'sender' && (
            <input
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="השם שלך"
              style={{
                width: '100%', fontSize: 16, fontFamily: 'inherit',
                padding: '12px 14px', borderRadius: 10,
                border: '1.5px solid var(--line-strong)',
                background: 'var(--bg-app)', color: 'var(--ink)',
                direction: 'rtl',
              }}
            />
          )}

          {activeTab === 'font' && (
            <HScroll>
              {FONTS.map(f => (
                <button key={f.id} onClick={() => setFontId(f.id)} style={{
                  padding: '10px 16px', borderRadius: 12,
                  background: fontId === f.id ? 'var(--burgundy)' : 'var(--surface)',
                  color: fontId === f.id ? 'white' : 'var(--ink)',
                  border: fontId === f.id ? 'none' : '1px solid var(--line)',
                  fontFamily: f.css, fontWeight: f.weight,
                  fontSize: 18, flexShrink: 0,
                  minWidth: 92, height: 56,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.name}
                </button>
              ))}
            </HScroll>
          )}

          {activeTab === 'color' && (
            <HScroll>
              {PALETTES.map(p => (
                <button key={p.id} onClick={() => setPaletteId(p.id)} style={{
                  padding: 0,
                  background: p.bg,
                  border: p.id === paletteId ? '3px solid var(--ink)' : '2px solid var(--line)',
                  borderRadius: 14, cursor: 'pointer',
                  width: 56, height: 56, flexShrink: 0,
                }} aria-label={p.name} />
              ))}
            </HScroll>
          )}

          {activeTab === 'size' && (
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              {TEXT_SIZES.map(s => (
                <button key={s.id} onClick={() => setSizeId(s.id)} style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  background: sizeId === s.id ? 'var(--burgundy)' : 'var(--surface)',
                  color: sizeId === s.id ? 'white' : 'var(--ink)',
                  border: sizeId === s.id ? 'none' : '1px solid var(--line)',
                  fontSize: s.id === 'sm' ? 14 : s.id === 'md' ? 17 : 20,
                  fontWeight: 700, fontFamily: 'inherit',
                }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </EditStrip>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// EditStrip — רצועה קטנה מעל הסרגל, לא מכסה את התצוגה
// ═══════════════════════════════════════════════════════════════
function EditStrip({ title, onClose, children }) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(82px + env(safe-area-inset-bottom))',
      left: 0, right: 0,
      background: 'var(--bg-app)',
      borderTop: '1px solid var(--line)',
      boxShadow: '0 -8px 24px -8px rgba(20,23,42,.12)',
      padding: '10px 14px 14px',
      zIndex: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>
          {title}
        </div>
        <button onClick={onClose} aria-label="סגור" style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, color: 'var(--ink-2)', lineHeight: 1,
        }}>×</button>
      </div>
      {children}
    </div>
  )
}

// רצועה אופקית אופקית — אפשר לגלול שמאלה לראות עוד אפשרויות
function HScroll({ children }) {
  return (
    <div style={{
      display: 'flex', gap: 8,
      overflowX: 'auto', overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: 4,
      // מסתיר את פס הגלילה המכוער
      scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// בוני SVG — איורים מובנים
// ═══════════════════════════════════════════════════════════════

function illustMenorah(W, H, accent, ink) {
  // חנוכייה למעלה (כדי שהטקסט יושב למטה — textZone: 'bottom')
  const cx = W / 2, cy = H * 0.26
  let g = ''
  g += `<rect x="${cx - 220}" y="${cy + 150}" width="440" height="30" rx="8" fill="${accent}" opacity="0.92"/>`
  g += `<rect x="${cx - 140}" y="${cy + 110}" width="280" height="48" rx="6" fill="${accent}" opacity="0.92"/>`
  g += `<rect x="${cx - 8}" y="${cy - 30}" width="16" height="140" fill="${accent}" opacity="0.92"/>`
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue
    const x = cx + i * 50
    g += `<path d="M ${cx} ${cy + 50} Q ${cx + i * 25} ${cy - 30} ${x} ${cy - 30} L ${x} ${cy + 50}" fill="none" stroke="${accent}" stroke-width="6" opacity="0.92"/>`
    g += `<rect x="${x - 6}" y="${cy - 60}" width="12" height="30" fill="${accent}" opacity="0.9"/>`
    g += `<ellipse cx="${x}" cy="${cy - 72}" rx="6" ry="14" fill="${ink}" opacity="0.95"/>`
    g += `<ellipse cx="${x}" cy="${cy - 74}" rx="3" ry="8" fill="${accent}"/>`
  }
  g += `<rect x="${cx - 6}" y="${cy - 70}" width="12" height="40" fill="${accent}" opacity="0.92"/>`
  g += `<ellipse cx="${cx}" cy="${cy - 86}" rx="8" ry="18" fill="${ink}" opacity="0.95"/>`
  g += `<ellipse cx="${cx}" cy="${cy - 88}" rx="4" ry="11" fill="${accent}"/>`
  return g
}

function illustPomegranate(W, H, accent, ink) {
  // רימונים בפינות עליונות וימין-תחתון — לא בולעים מרכז
  return `
    <g transform="translate(${W * 0.18}, ${H * 0.18})">
      <ellipse cx="0" cy="0" rx="110" ry="120" fill="${accent}" opacity="0.92"/>
      <path d="M -10 -105 L 0 -130 L 10 -105 M -20 -100 L -10 -125 L 0 -105 M 0 -105 L 10 -125 L 20 -100"
            stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.92"/>
      <circle cx="-30" cy="-20" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="20" cy="0" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="-10" cy="35" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="40" cy="40" r="9" fill="${ink}" opacity="0.65"/>
      <circle cx="-40" cy="50" r="9" fill="${ink}" opacity="0.65"/>
    </g>
    <g transform="translate(${W * 0.82}, ${H * 0.82}) scale(0.55)">
      <ellipse cx="0" cy="0" rx="110" ry="120" fill="${accent}" opacity="0.7"/>
      <path d="M -10 -105 L 0 -130 L 10 -105 M -20 -100 L -10 -125 L 0 -105 M 0 -105 L 10 -125 L 20 -100"
            stroke="${accent}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>
    </g>`
}

function illustFlowers(W, H, accent, ink) {
  // 4 פרחים רק בפינות — האמצע פנוי לטקסט
  const flower = (cx, cy, r, color) => {
    let g = ''
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      g += `<ellipse cx="${cx + Math.cos(a) * r * 0.55}" cy="${cy + Math.sin(a) * r * 0.55}" rx="${r * 0.36}" ry="${r * 0.52}" fill="${color}" opacity="0.85" transform="rotate(${a * 180 / Math.PI} ${cx + Math.cos(a) * r * 0.55} ${cy + Math.sin(a) * r * 0.55})"/>`
    }
    g += `<circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="${ink}" opacity="0.8"/>`
    return g
  }
  return `
    ${flower(W * 0.14, H * 0.14, 72, accent)}
    ${flower(W * 0.86, H * 0.16, 60, accent)}
    ${flower(W * 0.12, H * 0.86, 65, accent)}
    ${flower(W * 0.86, H * 0.86, 72, accent)}
  `
}

// זר ורדים — למעלה (כי textZone: 'top' = הטקסט בחלק העליון... רגע, הפוך!)
// textZone: 'top' אומר שהטקסט בחלק העליון של הכרטיס,
// אז האיור צריך להיות בחלק התחתון.
function illustRoseBouquet(W, H, accent, ink) {
  // הזר בחצי התחתון של הכרטיס
  const cx = W / 2, cy = H * 0.85
  const rose = (x, y, r, fill, depth) => `
    <g transform="translate(${x},${y})">
      <circle r="${r}" fill="${depth}"/>
      <path d="M -${r * 0.45} 0 A ${r * 0.45} ${r * 0.45} 0 0 1 ${r * 0.45} 0 A ${r * 0.7} ${r * 0.7} 0 0 0 -${r * 0.45} 0 Z" fill="${fill}"/>
      <path d="M -${r * 0.25} -${r * 0.15} A ${r * 0.3} ${r * 0.3} 0 0 1 ${r * 0.25} -${r * 0.15} A ${r * 0.4} ${r * 0.4} 0 0 0 -${r * 0.25} -${r * 0.15} Z" fill="${depth}"/>
      <circle cy="-${r * 0.1}" r="${r * 0.18}" fill="${fill}"/>
    </g>`
  let g = ''
  // גבעולים
  g += `<path d="M ${cx} ${cy - 20} L ${cx - 100} ${H + 50} L ${cx + 100} ${H + 50} Z" fill="${ink}" opacity="0.5"/>`
  // סרט
  g += `<rect x="${cx - 130}" y="${cy - 50}" width="260" height="20" rx="6" fill="${accent}" opacity="0.85"/>`
  // עלים
  g += `<ellipse cx="${cx - 150}" cy="${cy - 70}" rx="45" ry="22" fill="${accent}" opacity="0.55" transform="rotate(-30 ${cx - 150} ${cy - 70})"/>`
  g += `<ellipse cx="${cx + 150}" cy="${cy - 70}" rx="45" ry="22" fill="${accent}" opacity="0.55" transform="rotate(30 ${cx + 150} ${cy - 70})"/>`
  // ורדים
  g += rose(cx - 95, cy - 65, 42, accent, ink)
  g += rose(cx - 30, cy - 80, 45, accent, ink)
  g += rose(cx + 30, cy - 80, 45, accent, ink)
  g += rose(cx + 95, cy - 65, 42, accent, ink)
  g += rose(cx - 60, cy - 130, 40, accent, ink)
  g += rose(cx,      cy - 145, 46, accent, ink)
  g += rose(cx + 60, cy - 130, 40, accent, ink)
  return g
}

// עוגת יום הולדת — בחצי התחתון (textZone: 'top' = טקסט למעלה)
function illustBirthdayCake(W, H, accent, ink) {
  const cx = W / 2, cy = H * 0.62
  let g = ''
  // מגש
  g += `<rect x="${cx - 200}" y="${cy + 200}" width="400" height="24" rx="6" fill="${ink}" opacity="0.5"/>`
  // קומה תחתונה
  g += `<rect x="${cx - 180}" y="${cy + 100}" width="360" height="100" rx="8" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx - 180} ${cy + 100} Q ${cx - 160} ${cy + 80} ${cx - 140} ${cy + 100} Q ${cx - 120} ${cy + 80} ${cx - 100} ${cy + 100} Q ${cx - 80} ${cy + 80} ${cx - 60} ${cy + 100} Q ${cx - 40} ${cy + 80} ${cx - 20} ${cy + 100} Q ${cx} ${cy + 80} ${cx + 20} ${cy + 100} Q ${cx + 40} ${cy + 80} ${cx + 60} ${cy + 100} Q ${cx + 80} ${cy + 80} ${cx + 100} ${cy + 100} Q ${cx + 120} ${cy + 80} ${cx + 140} ${cy + 100} Q ${cx + 160} ${cy + 80} ${cx + 180} ${cy + 100} L ${cx + 180} ${cy + 110} L ${cx - 180} ${cy + 110} Z" fill="${ink}" opacity="0.85"/>`
  // קומה אמצעית
  g += `<rect x="${cx - 140}" y="${cy + 20}" width="280" height="85" rx="6" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx - 140} ${cy + 20} Q ${cx - 120} ${cy + 5} ${cx - 100} ${cy + 20} Q ${cx - 80} ${cy + 5} ${cx - 60} ${cy + 20} Q ${cx - 40} ${cy + 5} ${cx - 20} ${cy + 20} Q ${cx} ${cy + 5} ${cx + 20} ${cy + 20} Q ${cx + 40} ${cy + 5} ${cx + 60} ${cy + 20} Q ${cx + 80} ${cy + 5} ${cx + 100} ${cy + 20} Q ${cx + 120} ${cy + 5} ${cx + 140} ${cy + 20} L ${cx + 140} ${cy + 30} L ${cx - 140} ${cy + 30} Z" fill="${ink}" opacity="0.85"/>`
  // קומה עליונה
  g += `<rect x="${cx - 100}" y="${cy - 50}" width="200" height="70" rx="6" fill="${accent}" opacity="0.95"/>`
  // נרות
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * 60
    g += `<rect x="${x - 5}" y="${cy - 110}" width="10" height="60" fill="${ink}" opacity="0.9"/>`
    g += `<ellipse cx="${x}" cy="${cy - 122}" rx="7" ry="16" fill="${ink}" opacity="0.7"/>`
    g += `<ellipse cx="${x}" cy="${cy - 124}" rx="4" ry="11" fill="${accent}"/>`
    g += `<ellipse cx="${x}" cy="${cy - 126}" rx="2" ry="6" fill="#FFF7C8"/>`
  }
  // סוכריות
  const sprinkles = [
    [cx - 80, cy + 60], [cx - 30, cy + 75], [cx + 50, cy + 65], [cx + 95, cy + 80],
    [cx - 60, cy + 145], [cx + 20, cy + 155], [cx + 90, cy + 140], [cx - 110, cy + 160],
  ]
  sprinkles.forEach(([x, y]) => {
    g += `<circle cx="${x}" cy="${y}" r="4" fill="${ink}" opacity="0.7"/>`
  })
  return g
}

// יונים — למעלה (textZone: 'bottom' = הטקסט בחלק התחתון)
function illustDovesWithFlowers(W, H, accent, ink) {
  let g = ''
  const tinyFlower = (cx, cy, r, color) => {
    let f = ''
    for (let i = 0; i < 5; i++) {
      const a = i * 2 * Math.PI / 5 - Math.PI / 2
      f += `<circle cx="${cx + Math.cos(a) * r * 0.55}" cy="${cy + Math.sin(a) * r * 0.55}" r="${r * 0.42}" fill="${color}" opacity="0.85"/>`
    }
    f += `<circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="${ink}" opacity="0.7"/>`
    return f
  }
  // יונים בחצי העליון
  const cx1 = W * 0.32, cy1 = H * 0.22
  g += `<ellipse cx="${cx1}" cy="${cy1}" rx="55" ry="40" fill="${accent}" opacity="0.95"/>`
  g += `<circle cx="${cx1 - 45}" cy="${cy1 - 16}" r="20" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx1 - 65} ${cy1 - 16} L ${cx1 - 82} ${cy1 - 13} L ${cx1 - 65} ${cy1 - 8} Z" fill="#E8A93B"/>`
  g += `<circle cx="${cx1 - 50}" cy="${cy1 - 20}" r="2.5" fill="${ink}"/>`
  g += `<path d="M ${cx1 + 8} ${cy1 - 8} Q ${cx1 + 28} ${cy1 - 36} ${cx1 + 50} ${cy1 - 3} Q ${cx1 + 32} ${cy1 + 4} ${cx1 + 8} ${cy1 - 8} Z" fill="${ink}" opacity="0.25"/>`
  g += `<path d="M ${cx1 + 50} ${cy1 + 3} L ${cx1 + 85} ${cy1 + 16} L ${cx1 + 80} ${cy1 + 20} L ${cx1 + 50} ${cy1 + 10} Z" fill="${accent}" opacity="0.95"/>`

  const cx2 = W * 0.68, cy2 = H * 0.22
  g += `<ellipse cx="${cx2}" cy="${cy2}" rx="55" ry="40" fill="${accent}" opacity="0.95"/>`
  g += `<circle cx="${cx2 + 45}" cy="${cy2 - 16}" r="20" fill="${accent}" opacity="0.95"/>`
  g += `<path d="M ${cx2 + 65} ${cy2 - 16} L ${cx2 + 82} ${cy2 - 13} L ${cx2 + 65} ${cy2 - 8} Z" fill="#E8A93B"/>`
  g += `<circle cx="${cx2 + 50}" cy="${cy2 - 20}" r="2.5" fill="${ink}"/>`
  g += `<path d="M ${cx2 - 8} ${cy2 - 8} Q ${cx2 - 28} ${cy2 - 36} ${cx2 - 50} ${cy2 - 3} Q ${cx2 - 32} ${cy2 + 4} ${cx2 - 8} ${cy2 - 8} Z" fill="${ink}" opacity="0.25"/>`
  g += `<path d="M ${cx2 - 50} ${cy2 + 3} L ${cx2 - 85} ${cy2 + 16} L ${cx2 - 80} ${cy2 + 20} L ${cx2 - 50} ${cy2 + 10} Z" fill="${accent}" opacity="0.95"/>`

  // זר פרחים בין היונים (חלק עליון)
  g += tinyFlower(W * 0.5, H * 0.16, 38, accent)
  g += tinyFlower(W * 0.5 - 50, H * 0.13, 28, accent)
  g += tinyFlower(W * 0.5 + 50, H * 0.13, 28, accent)
  return g
}

// ═══════════════════════════════════════════════════════════════
// בונה SVG ראשי
// ═══════════════════════════════════════════════════════════════
function buildSVG({ text, cardName, tpl, palette, font, size, bg }) {
  const W = 1080, H = 1080

  // כשיש רקע תמונה — הוא גובר על הצבע/תבנית.
  const ink = bg ? bg.ink : palette.ink
  const accent = bg ? bg.accent : palette.accent

  // גלישת טקסט + גודל
  const len = text.trim().length
  let bigFont = len > 80 ? 50 : len > 50 ? 60 : len > 26 ? 72 : len > 16 ? 88 : 104
  bigFont = Math.round(bigFont * size.scale)
  const maxCharsPerLine = Math.floor(760 / (bigFont * 0.56))
  const lines = wrapText(text.trim(), maxCharsPerLine)
  if (lines.length > 4) bigFont = Math.max(40, bigFont - (lines.length - 4) * 8)
  const lineHeight = bigFont * 1.32

  const blockHeight = lines.length * lineHeight

  // ── מרכז אנכי של הטקסט לפי textZone ─────────────────────
  // top    = 25% (איור בחצי התחתון)
  // center = 50% (איור בפינות / לא חופף)
  // bottom = 72% (איור בחצי העליון)
  const zone = (bg ? bg.textZone : tpl.textZone) || 'center'
  const centerY = zone === 'top'    ? H * 0.27
                : zone === 'bottom' ? H * 0.72
                : H * 0.50

  const firstLineY = centerY - blockHeight / 2 + lineHeight / 2
  const textLines = lines.map((ln, i) =>
    `<tspan x="${W / 2}" y="${firstLineY + i * lineHeight}">${escapeXML(ln)}</tspan>`
  ).join('')

  const dividerY = firstLineY + (lines.length - 1) * lineHeight + bigFont * 0.85
  const senderY = dividerY + 70

  // ── רקע + דקורציה ─────────────────────────────────────────
  let background = ''
  let decoration = ''
  let topLine = ''

  // רקע תמונה גובר על הכל — ללא שכבת הצללה, ללא איורים
  if (bg) {
    background = `<image href="${bg.dataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
  }
  else if (tpl.type === 'illustration') {
    background = `<rect width="${W}" height="${H}" fill="${palette.bg}"/>`
    if (tpl.illust === 'menorah')          decoration = illustMenorah(W, H, palette.accent, palette.ink)
    else if (tpl.illust === 'pomegranate') decoration = illustPomegranate(W, H, palette.accent, palette.ink)
    else if (tpl.illust === 'flowers')     decoration = illustFlowers(W, H, palette.accent, palette.ink)
    else if (tpl.illust === 'roses')       decoration = illustRoseBouquet(W, H, palette.accent, palette.ink)
    else if (tpl.illust === 'cake')        decoration = illustBirthdayCake(W, H, palette.accent, palette.ink)
    else if (tpl.illust === 'doves')       decoration = illustDovesWithFlowers(W, H, palette.accent, palette.ink)
  }
  else if (tpl.type === 'minimal') {
    background = `<rect width="${W}" height="${H}" fill="${palette.bg}"/>`
    if (tpl.shape === 'circle') {
      decoration = `<circle cx="${W * 0.18}" cy="${H * 0.18}" r="180" fill="${palette.accent}" opacity="0.35"/>
                    <circle cx="${W * 0.85}" cy="${H * 0.85}" r="120" fill="${palette.accent}" opacity="0.25"/>`
    } else if (tpl.shape === 'arc') {
      decoration = `<path d="M 0 0 Q ${W * 0.3} ${H * 0.18} 0 ${H * 0.32} Z" fill="${palette.accent}" opacity="0.3"/>
                    <path d="M ${W} ${H} Q ${W * 0.7} ${H * 0.82} ${W} ${H * 0.68} Z" fill="${palette.accent}" opacity="0.3"/>`
    } else {
      decoration = `<rect x="0" y="${H * 0.12}" width="${W}" height="14" fill="${palette.accent}"/>
                    <rect x="0" y="${H * 0.86}" width="${W}" height="14" fill="${palette.accent}"/>`
    }
  }
  else if (tpl.type === 'elegant') {
    background = `<rect width="${W}" height="${H}" fill="${palette.bg}"/>`
    if (tpl.frame === 'double') {
      decoration = `<rect x="44" y="44" width="${W - 88}" height="${H - 88}" rx="0" fill="none" stroke="${palette.accent}" stroke-width="2" opacity="0.85"/>
                    <rect x="68" y="68" width="${W - 136}" height="${H - 136}" rx="0" fill="none" stroke="${palette.accent}" stroke-width="0.7" opacity="0.6"/>`
    } else if (tpl.frame === 'corners') {
      const cl = 90
      decoration = `
        <path d="M 60 ${60 + cl} L 60 60 L ${60 + cl} 60" fill="none" stroke="${palette.accent}" stroke-width="3"/>
        <path d="M ${W - 60 - cl} 60 L ${W - 60} 60 L ${W - 60} ${60 + cl}" fill="none" stroke="${palette.accent}" stroke-width="3"/>
        <path d="M 60 ${H - 60 - cl} L 60 ${H - 60} L ${60 + cl} ${H - 60}" fill="none" stroke="${palette.accent}" stroke-width="3"/>
        <path d="M ${W - 60 - cl} ${H - 60} L ${W - 60} ${H - 60} L ${W - 60} ${H - 60 - cl}" fill="none" stroke="${palette.accent}" stroke-width="3"/>`
    } else {
      decoration = `<rect x="50" y="50" width="${W - 100}" height="${H - 100}" rx="0" fill="none" stroke="${palette.accent}" stroke-width="1.5" opacity="0.7"/>`
    }
    topLine = `<text x="${W / 2}" y="${firstLineY - bigFont * 1.2}" font-family="${font.css}" font-size="22" fill="${palette.accent}" text-anchor="middle" letter-spacing="6" direction="rtl">בּ ר כ ה</text>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${background}
  ${decoration}
  ${topLine}

  <text font-family="${font.css}" font-size="${bigFont}" font-weight="${font.weight}"
        fill="${ink}" text-anchor="middle" direction="rtl">${textLines}</text>

  <line x1="${W / 2 - 120}" y1="${dividerY}" x2="${W / 2 + 120}" y2="${dividerY}"
        stroke="${accent}" stroke-width="2" opacity="${cardName ? 0.8 : 0}"/>

  ${cardName ? `<text x="${W / 2}" y="${senderY}" font-family="${font.css}"
        font-size="40" font-weight="${Math.min(font.weight, 700)}" fill="${ink}" text-anchor="middle"
        direction="rtl" opacity="0.92">${escapeXML(cardName)}</text>` : ''}

  <!-- כיתוב שיווקי — מיקום קבוע גם אם אין שם מאחל -->
  <text x="${W / 2}" y="${cardName ? senderY + 56 : dividerY + 30}"
        font-family="'Heebo', sans-serif" font-size="22" font-weight="500"
        fill="${ink}" text-anchor="middle"
        opacity="0.5" direction="rtl" letter-spacing="0.5">ברכה זו נוצרה באמצעות אפליקציית ביחד</text>
</svg>`
}

// ── עזר ──────────────────────────────────────────────────────
function wrapText(text, maxChars) {
  const rawWords = text.split(/\s+/).filter(Boolean)
  if (rawWords.length === 0) return ['']
  const words = []
  for (const w of rawWords) {
    if (w.length <= maxChars) words.push(w)
    else for (let i = 0; i < w.length; i += maxChars) words.push(w.slice(i, i + maxChars))
  }
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word
    if (candidate.length > maxChars && current) { lines.push(current); current = word }
    else current = candidate
  }
  if (current) lines.push(current)
  return lines
}

function escapeXML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
