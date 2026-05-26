// src/pages/GreetingMaker.jsx
// ─────────────────────────────────────────────────────────────
// עורך ברכה אישית — המשתמש מעצב בעצמו.
//
// שלבים:
//   1. בחירת/כתיבת טקסט הברכה
//   2. עיצוב — רקע, קישוטים, פריסה, צבע, מסגרת (תצוגה חיה)
//   3. שמירה / שיתוף
//
// אין גרירה — הכל בחירות פשוטות, מתאים לקהל 65+.
// כל כרטיס נושא כיתוב שיווקי בתחתית.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { IconBackRTL } from '../icons/index.jsx'

// ─── ברכות מוכנות (לבחירה מהירה) ─────────────────────────────
const PRESET_GREETINGS = {
  'ימים': [
    'שבוע טוב ומבורך', 'יום שני מבורך', 'יום שלישי, פעמיים כי טוב',
    'יום רביעי מבורך ומלא בבשורות טובות', 'יום חמישי מבורך',
    'שבת שלום ומבורכת', 'שבת שלום', 'בוקר טוב ומואר', 'ערב טוב ונעים',
  ],
  'חגים': [
    'שנה טובה ומתוקה', 'גמר חתימה טובה', 'חג סוכות שמח', 'חנוכה שמח ומואר',
    'ט״ו בשבט שמח', 'פורים שמח', 'חג פסח כשר ושמח', 'ל״ג בעומר שמח',
    'חג שבועות שמח',
  ],
  'איחולים': [
    'מזל טוב!', 'יום הולדת שמח', 'רפואה שלמה', 'בהצלחה רבה',
    'חודש מבורך', 'באהבה רבה', 'תודה רבה לך', 'מתגעגעים אליך',
  ],
}

// ─── רקעים ───────────────────────────────────────────────────
const BACKGROUNDS = [
  { id: 'gold',    name: 'זהב',     bg1: '#D4A94E', bg2: '#7A5410', ink: '#FFFDF5' },
  { id: 'rose',    name: 'ורוד',    bg1: '#D98BA3', bg2: '#6B3147', ink: '#FFF5F8' },
  { id: 'teal',    name: 'תכלת',    bg1: '#4593A6', bg2: '#10333F', ink: '#F2FBFD' },
  { id: 'forest',  name: 'ירוק',    bg1: '#6B9560', bg2: '#26381F', ink: '#F4FAEF' },
  { id: 'sunset',  name: 'שקיעה',   bg1: '#D2734F', bg2: '#5A2014', ink: '#FFF4ED' },
  { id: 'royal',   name: 'סגול',    bg1: '#7E5AA0', bg2: '#2C1842', ink: '#F8F2FC' },
  { id: 'sky',     name: 'שמיים',   bg1: '#6FA8D4', bg2: '#1E3A52', ink: '#F2F9FD' },
  { id: 'cream',   name: 'שמנת',    bg1: '#E8D9B8', bg2: '#A88B४E'.replace('४','4'), ink: '#3A2E18' },
  { id: 'coral',   name: 'אלמוג',   bg1: '#E08A6E', bg2: '#7A3320', ink: '#FFF4EF' },
  { id: 'mint',    name: 'מנטה',    bg1: '#7DC4A8', bg2: '#234A3C', ink: '#F0FBF6' },
  { id: 'wine',    name: 'יין',     bg1: '#A0506A', bg2: '#3A1626', ink: '#FBF0F4' },
  { id: 'night',   name: 'לילה',    bg1: '#3D4A6B', bg2: '#12182B', ink: '#EEF1FA' },
]

// ─── מוטיבים של קישוטים ──────────────────────────────────────
const MOTIFS = [
  { id: 'roses',   name: 'ורדים',    emoji: '🌹' },
  { id: 'flowers', name: 'פרחים',    emoji: '🌸' },
  { id: 'candles', name: 'נרות',     emoji: '🕯️' },
  { id: 'stars',   name: 'כוכבים',   emoji: '✡️' },
  { id: 'leaves',  name: 'עלים',     emoji: '🍃' },
  { id: 'wheat',   name: 'שיבולים',  emoji: '🌾' },
  { id: 'hearts',  name: 'לבבות',    emoji: '❤️' },
  { id: 'butterflies', name: 'פרפרים', emoji: '🦋' },
  { id: 'sparkles',name: 'נצנוצים',  emoji: '✨' },
  { id: 'none',    name: 'ללא',      emoji: '⬜' },
]

// ─── צבעי קישוטים ────────────────────────────────────────────
const ACCENT_COLORS = [
  { id: 'cream', name: 'שמנת',  c: '#FFF0C8', soft: '#FFE9B0' },
  { id: 'pink',  name: 'ורוד',  c: '#FFB3CC', soft: '#FF9FBC' },
  { id: 'gold',  name: 'זהב',   c: '#FFD24A', soft: '#E8B82E' },
  { id: 'white', name: 'לבן',   c: '#FFFFFF', soft: '#F0F0F0' },
  { id: 'green', name: 'ירוק',  c: '#AEDFA0', soft: '#8FCF7E' },
  { id: 'sky',   name: 'תכלת',  c: '#A8DCEC', soft: '#88CCE0' },
]

// ─── פריסות ──────────────────────────────────────────────────
const LAYOUTS = [
  { id: 'corners', name: 'פינות' },
  { id: 'frame',   name: 'מסגרת' },
  { id: 'lavish',  name: 'שפע' },
  { id: 'minimal', name: 'עדין' },
]

// ─── סגנונות מסגרת ───────────────────────────────────────────
const FRAMES = [
  { id: 'double', name: 'כפולה' },
  { id: 'single', name: 'יחידה' },
  { id: 'rounded',name: 'מעוגלת' },
  { id: 'none',   name: 'ללא' },
]

export default function GreetingMaker({ onBack }) {
  const { profile } = useUserStore()
  const [step, setStep] = useState('text')   // text | design

  // ── design state ──
  const [text, setText] = useState('')
  const [senderName, setSenderName] = useState(profile?.name || '')
  const [bgIdx, setBgIdx] = useState(0)
  const [motif, setMotif] = useState('roses')
  const [accentIdx, setAccentIdx] = useState(0)
  const [layout, setLayout] = useState('corners')
  const [frame, setFrame] = useState('double')

  const goBack = () => {
    if (step === 'design') setStep('text')
    else onBack()
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={goBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">
          {step === 'text' ? 'ברכה אישית' : 'עצבו את הברכה'}
        </div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {step === 'text' && (
          <TextStep
            text={text}
            setText={setText}
            onNext={() => setStep('design')}
          />
        )}
        {step === 'design' && (
          <DesignStep
            text={text}
            senderName={senderName} setSenderName={setSenderName}
            bgIdx={bgIdx} setBgIdx={setBgIdx}
            motif={motif} setMotif={setMotif}
            accentIdx={accentIdx} setAccentIdx={setAccentIdx}
            layout={layout} setLayout={setLayout}
            frame={frame} setFrame={setFrame}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 — choose or write the greeting text
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

      {/* free text input */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="כתבו כאן את הברכה שלכם..."
        style={{
          width: '100%', fontSize: 18, fontFamily: 'inherit',
          padding: '14px', borderRadius: 14,
          border: '2px solid var(--line-strong)',
          background: 'var(--surface)', color: 'var(--ink)',
          marginBottom: 18, direction: 'rtl', resize: 'vertical',
          lineHeight: 1.4,
        }}
      />

      {/* preset categories */}
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
// STEP 2 — design the card with live preview
// ═══════════════════════════════════════════════════════════════
function DesignStep({
  text, senderName, setSenderName,
  bgIdx, setBgIdx, motif, setMotif,
  accentIdx, setAccentIdx, layout, setLayout, frame, setFrame,
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editingName, setEditingName] = useState(false)

  const bg = BACKGROUNDS[bgIdx]
  const accent = ACCENT_COLORS[accentIdx]
  const cardName = senderName.trim() || 'מאחל/ת באהבה'

  const svg = buildSVG({ text, cardName, bg, accent, motif, layout, frame })
  const previewSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

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
      setMsg('✓ התמונה נשמרה!')
    } catch (e) {
      console.error(e); setMsg('לא הצלחנו לשמור — נסו שוב')
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
        setMsg('')
      } else if (navigator.share) {
        await navigator.share({ title: text, text })
      } else {
        const t = encodeURIComponent(text + '\n\nנוצר באמצעות אפליקציית ביחד')
        window.open(`https://wa.me/?text=${t}`, '_blank')
        setMsg('שיתוף ישיר לא נתמך — נפתח וואטסאפ עם הטקסט')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') { console.error(e); setMsg('השיתוף בוטל או נכשל') }
    }
    setBusy(false)
  }

  return (
    <>
      {/* Live preview */}
      <div style={{
        borderRadius: 24, overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)', marginBottom: 16,
        aspectRatio: '1', background: bg.bg2,
      }}>
        <img src={previewSrc} alt="תצוגה מקדימה"
             style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Name editor */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 14, padding: '12px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>מאת:</span>
        {editingName ? (
          <input
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
            onBlur={() => setEditingName(false)}
            autoFocus placeholder="השם שלך"
            style={{
              flex: 1, fontSize: 16, fontFamily: 'inherit',
              padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--line-strong)',
              background: 'var(--bg-app)', color: 'var(--ink)', direction: 'rtl',
            }}
          />
        ) : (
          <button onClick={() => setEditingName(true)} style={{
            flex: 1, textAlign: 'right', fontSize: 16, fontWeight: 600,
            color: 'var(--ink)', fontFamily: 'inherit',
          }}>
            {cardName} <span style={{ color: 'var(--burgundy)', fontSize: 13 }}>✎ ערוך</span>
          </button>
        )}
      </div>

      {/* ── Background picker ── */}
      <PickerSection title="🎨 רקע">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BACKGROUNDS.map((b, i) => (
            <button key={b.id} onClick={() => setBgIdx(i)} style={{
              width: 48, height: 48, borderRadius: 11,
              background: `linear-gradient(135deg, ${b.bg1}, ${b.bg2})`,
              border: i === bgIdx ? '3px solid var(--ink)' : '2px solid var(--line)',
              cursor: 'pointer', flexShrink: 0,
            }} aria-label={b.name} />
          ))}
        </div>
      </PickerSection>

      {/* ── Motif picker ── */}
      <PickerSection title="🌸 קישוטים">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MOTIFS.map(m => (
            <button key={m.id} onClick={() => setMotif(m.id)} style={{
              padding: '8px 12px', borderRadius: 12,
              background: motif === m.id ? 'var(--burgundy)' : 'var(--surface)',
              color: motif === m.id ? 'white' : 'var(--ink)',
              border: motif === m.id ? 'none' : '1px solid var(--line)',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 16 }}>{m.emoji}</span>
              {m.name}
            </button>
          ))}
        </div>
      </PickerSection>

      {/* ── Accent color picker ── */}
      <PickerSection title="✨ צבע הקישוטים">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map((a, i) => (
            <button key={a.id} onClick={() => setAccentIdx(i)} style={{
              width: 44, height: 44, borderRadius: 10,
              background: a.c,
              border: i === accentIdx ? '3px solid var(--ink)' : '2px solid var(--line)',
              cursor: 'pointer', flexShrink: 0,
            }} aria-label={a.name} />
          ))}
        </div>
      </PickerSection>

      {/* ── Layout picker ── */}
      <PickerSection title="📐 פריסת הקישוטים">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LAYOUTS.map(l => (
            <ChipButton key={l.id} active={layout === l.id}
              onClick={() => setLayout(l.id)} label={l.name} />
          ))}
        </div>
      </PickerSection>

      {/* ── Frame picker ── */}
      <PickerSection title="🎀 מסגרת">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FRAMES.map(f => (
            <ChipButton key={f.id} active={frame === f.id}
              onClick={() => setFrame(f.id)} label={f.name} />
          ))}
        </div>
      </PickerSection>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        <button onClick={handleShare} disabled={busy}
          className="big-btn big-btn--primary"
          style={{ width: '100%', opacity: busy ? 0.7 : 1 }}>
          📲 שתף ברכה
        </button>
        <button onClick={handleSave} disabled={busy}
          className="big-btn big-btn--ghost"
          style={{ width: '100%', opacity: busy ? 0.7 : 1 }}>
          📥 שמור תמונה
        </button>
      </div>

      {msg && (
        <div style={{
          textAlign: 'center', marginTop: 12, fontSize: 14,
          fontWeight: 600, color: 'var(--ink-2)',
        }}>{msg}</div>
      )}
    </>
  )
}

// ── small UI helpers ────────────────────────────────────────
function PickerSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function ChipButton({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 16px', borderRadius: 12,
      background: active ? 'var(--burgundy)' : 'var(--surface)',
      color: active ? 'white' : 'var(--ink)',
      border: active ? 'none' : '1px solid var(--line)',
      fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
    }}>
      {label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// SVG BUILDERS
// ═══════════════════════════════════════════════════════════════

function svgRose(cx, cy, r, c, soft) {
  return `<g transform="translate(${cx},${cy})">
    <g fill="${soft}">
      <ellipse cx="0" cy="${-r*0.62}" rx="${r*0.5}" ry="${r*0.66}"/>
      <ellipse cx="${r*0.62}" cy="0" rx="${r*0.66}" ry="${r*0.5}"/>
      <ellipse cx="0" cy="${r*0.62}" rx="${r*0.5}" ry="${r*0.66}"/>
      <ellipse cx="${-r*0.62}" cy="0" rx="${r*0.66}" ry="${r*0.5}"/>
    </g>
    <circle r="${r*0.52}" fill="${c}"/>
    <circle r="${r*0.26}" fill="#FFFFFF" opacity="0.4"/>
  </g>`
}
function svgFlower(cx, cy, r, c, soft) {
  let petals = ''
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3
    petals += `<ellipse cx="${cx + Math.cos(a)*r*0.6}" cy="${cy + Math.sin(a)*r*0.6}" rx="${r*0.32}" ry="${r*0.5}" fill="${soft}" transform="rotate(${a*180/Math.PI} ${cx + Math.cos(a)*r*0.6} ${cy + Math.sin(a)*r*0.6})"/>`
  }
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r*0.34}" fill="${c}"/>`
}
function svgLeaf(cx, cy, r, rot, c) {
  return `<path d="M ${cx} ${cy-r} Q ${cx+r*0.7} ${cy} ${cx} ${cy+r} Q ${cx-r*0.7} ${cy} ${cx} ${cy-r} Z" fill="${c}" transform="rotate(${rot} ${cx} ${cy})" opacity="0.9"/>`
}
function svgCandle(cx, cy, h, c, ink) {
  return `<g transform="translate(${cx},${cy})">
    <rect x="${-h*0.16}" y="0" width="${h*0.32}" height="${h}" rx="${h*0.06}" fill="${ink}" opacity="0.9"/>
    <ellipse cx="0" cy="${-h*0.18}" rx="${h*0.12}" ry="${h*0.22}" fill="${c}"/>
    <ellipse cx="0" cy="${-h*0.16}" rx="${h*0.06}" ry="${h*0.13}" fill="#FFFFFF" opacity="0.85"/>
  </g>`
}
function svgStar(cx, cy, r, c) {
  const p1 = [], p2 = []
  for (let i = 0; i < 3; i++) {
    const a1 = Math.PI/2 + i*2*Math.PI/3
    const a2 = -Math.PI/2 + i*2*Math.PI/3
    p1.push(`${cx+r*Math.cos(a1)},${cy-r*Math.sin(a1)}`)
    p2.push(`${cx+r*Math.cos(a2)},${cy-r*Math.sin(a2)}`)
  }
  return `<polygon points="${p1.join(' ')}" fill="none" stroke="${c}" stroke-width="${r*0.16}"/>
          <polygon points="${p2.join(' ')}" fill="none" stroke="${c}" stroke-width="${r*0.16}"/>`
}
function svgWheat(cx, cy, h, c) {
  let g = ''
  for (let i = 0; i < 6; i++) {
    const y = cy - h*0.5 + i*h*0.13
    g += `<ellipse cx="${cx-h*0.10}" cy="${y}" rx="${h*0.07}" ry="${h*0.12}" fill="${c}" transform="rotate(-30 ${cx-h*0.10} ${y})"/>`
    g += `<ellipse cx="${cx+h*0.10}" cy="${y}" rx="${h*0.07}" ry="${h*0.12}" fill="${c}" transform="rotate(30 ${cx+h*0.10} ${y})"/>`
  }
  return `<line x1="${cx}" y1="${cy-h*0.55}" x2="${cx}" y2="${cy+h*0.5}" stroke="${c}" stroke-width="${h*0.05}"/>${g}`
}
function svgHeart(cx, cy, r, c) {
  return `<path d="M ${cx} ${cy+r*0.8}
    C ${cx-r*1.4} ${cy-r*0.4} ${cx-r*0.6} ${cy-r*1.2} ${cx} ${cy-r*0.3}
    C ${cx+r*0.6} ${cy-r*1.2} ${cx+r*1.4} ${cy-r*0.4} ${cx} ${cy+r*0.8} Z" fill="${c}"/>`
}
function svgButterfly(cx, cy, r, c, soft) {
  return `<g transform="translate(${cx},${cy})">
    <ellipse cx="${-r*0.5}" cy="${-r*0.3}" rx="${r*0.5}" ry="${r*0.4}" fill="${soft}"/>
    <ellipse cx="${r*0.5}" cy="${-r*0.3}" rx="${r*0.5}" ry="${r*0.4}" fill="${soft}"/>
    <ellipse cx="${-r*0.4}" cy="${r*0.3}" rx="${r*0.38}" ry="${r*0.32}" fill="${c}"/>
    <ellipse cx="${r*0.4}" cy="${r*0.3}" rx="${r*0.38}" ry="${r*0.32}" fill="${c}"/>
    <rect x="${-r*0.06}" y="${-r*0.5}" width="${r*0.12}" height="${r}" rx="${r*0.06}" fill="${c}"/>
  </g>`
}
function svgSparkle(cx, cy, r, c) {
  return `<path d="M ${cx} ${cy-r} L ${cx+r*0.22} ${cy-r*0.22} L ${cx+r} ${cy}
    L ${cx+r*0.22} ${cy+r*0.22} L ${cx} ${cy+r} L ${cx-r*0.22} ${cy+r*0.22}
    L ${cx-r} ${cy} L ${cx-r*0.22} ${cy-r*0.22} Z" fill="${c}"/>`
}

// draw one motif element at a position+size
function drawOne(motif, x, y, size, rot, c, soft, ink) {
  switch (motif) {
    case 'roses':       return svgRose(x, y, size, c, soft)
    case 'flowers':     return svgFlower(x, y, size, c, soft)
    case 'candles':     return svgCandle(x, y, size*2, c, ink)
    case 'stars':       return svgStar(x, y, size, c)
    case 'leaves':      return svgLeaf(x, y, size, rot, c)
    case 'wheat':       return svgWheat(x, y, size*2.6, c)
    case 'hearts':      return svgHeart(x, y, size, c)
    case 'butterflies': return svgButterfly(x, y, size, c, soft)
    case 'sparkles':    return svgSparkle(x, y, size, c)
    default:            return ''
  }
}

// build the full decoration based on layout
function buildDecoration(motif, layout, W, H, c, soft, ink) {
  if (motif === 'none' || layout === 'minimal' && motif === 'none') return ''

  const S = 70  // base size
  let positions = []

  if (layout === 'corners') {
    positions = [
      [W*0.16, H*0.16, S], [W*0.84, H*0.16, S],
      [W*0.16, H*0.84, S], [W*0.84, H*0.84, S],
    ]
  } else if (layout === 'frame') {
    positions = [
      [W*0.16, H*0.16, S], [W*0.5, H*0.13, S*0.8], [W*0.84, H*0.16, S],
      [W*0.13, H*0.5, S*0.8], [W*0.87, H*0.5, S*0.8],
      [W*0.16, H*0.84, S], [W*0.5, H*0.87, S*0.8], [W*0.84, H*0.84, S],
    ]
  } else if (layout === 'lavish') {
    positions = [
      [W*0.14, H*0.14, S], [W*0.34, H*0.10, S*0.7], [W*0.5, H*0.14, S*0.85],
      [W*0.66, H*0.10, S*0.7], [W*0.86, H*0.14, S],
      [W*0.10, H*0.40, S*0.7], [W*0.90, H*0.40, S*0.7],
      [W*0.10, H*0.62, S*0.7], [W*0.90, H*0.62, S*0.7],
      [W*0.14, H*0.86, S], [W*0.34, H*0.90, S*0.7], [W*0.5, H*0.86, S*0.85],
      [W*0.66, H*0.90, S*0.7], [W*0.86, H*0.86, S],
    ]
  } else { // minimal
    positions = [
      [W*0.5, H*0.16, S*0.9], [W*0.5, H*0.84, S*0.9],
    ]
  }

  return positions.map(([x, y, sz], i) =>
    drawOne(motif, x, y, sz, (i*47) % 360, c, soft, ink)
  ).join('')
}

// build frame markup
function buildFrame(frame, W, H, c) {
  if (frame === 'none') return ''
  if (frame === 'single') {
    return `<rect x="50" y="50" width="${W-100}" height="${H-100}" rx="20" fill="none" stroke="${c}" stroke-width="5" opacity="0.75"/>`
  }
  if (frame === 'rounded') {
    return `<rect x="48" y="48" width="${W-96}" height="${H-96}" rx="90" fill="none" stroke="${c}" stroke-width="6" opacity="0.75"/>`
  }
  // double
  return `<rect x="44" y="44" width="${W-88}" height="${H-88}" rx="40" fill="none" stroke="${c}" stroke-width="5" opacity="0.75"/>
          <rect x="70" y="70" width="${W-140}" height="${H-140}" rx="28" fill="none" stroke="${c}" stroke-width="2" opacity="0.5"/>`
}

// main SVG builder
function buildSVG({ text, cardName, bg, accent, motif, layout, frame }) {
  const W = 1080, H = 1080
  const bigFont = text.length > 26 ? 68 : text.length > 16 ? 84 : 104

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg.bg1}"/>
      <stop offset="1" stop-color="${bg.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="${accent.c}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${accent.c}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- decorations -->
  <g opacity="0.94">${buildDecoration(motif, layout, W, H, accent.c, accent.soft, bg.ink)}</g>

  <!-- frame -->
  ${buildFrame(frame, W, H, accent.c)}

  <!-- readability plate -->
  <rect x="${W*0.5 - 440}" y="${H*0.5 - 215}" width="880" height="400" rx="40"
        fill="${bg.bg2}" opacity="0.32"/>

  <!-- top ornament -->
  <text x="${W/2}" y="${H*0.5 - 130}" font-size="64" text-anchor="middle" fill="${accent.c}">✦ ❀ ✦</text>

  <!-- greeting text -->
  <text x="${W/2}" y="${H/2 + 10}" font-family="Arial, sans-serif"
        font-size="${bigFont}" font-weight="800" fill="${bg.ink}"
        text-anchor="middle" direction="rtl">${escapeXML(text)}</text>

  <!-- divider -->
  <line x1="${W/2 - 150}" y1="${H/2 + 80}" x2="${W/2 + 150}" y2="${H/2 + 80}"
        stroke="${accent.c}" stroke-width="3" opacity="0.8"/>

  <!-- sender -->
  <text x="${W/2}" y="${H/2 + 152}" font-family="Arial, sans-serif"
        font-size="50" font-weight="700" fill="${bg.ink}" text-anchor="middle"
        direction="rtl">${escapeXML('מאת ' + cardName)}</text>

  <!-- footer branding -->
  <text x="${W/2}" y="${H - 156}" font-family="Arial, sans-serif"
        font-size="32" font-weight="700" fill="${bg.ink}" text-anchor="middle"
        opacity="0.95" direction="rtl">נוצר באמצעות אפליקציית ביחד</text>
  <text x="${W/2}" y="${H - 112}" font-family="Arial, sans-serif"
        font-size="25" fill="${bg.ink}" text-anchor="middle"
        opacity="0.78" direction="rtl">רוצים ליצור ברכה אישית עם השם שלכם?</text>
  <text x="${W/2}" y="${H - 78}" font-family="Arial, sans-serif"
        font-size="25" fill="${bg.ink}" text-anchor="middle"
        opacity="0.78" direction="rtl">חפשו בחנות האפליקציות "ביחד"</text>
</svg>`
}

function escapeXML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
