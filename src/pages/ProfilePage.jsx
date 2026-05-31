// src/pages/ProfilePage.jsx
// ─────────────────────────────────────────────────────────────
// עריכת פרופיל.
//
// המשתמש יכול לערוך: שם פרטי, שם משפחה, טלפון, ותמונת פרופיל.
// האימייל מוצג אך אינו ניתן לעריכה (הוא משמש להתחברות).
//
// תמונת הפרופיל מכווצת ל-256x256 ונשמרת כ-base64 ישירות
// במסמך המשתמש ב-Firestore — ללא צורך ב-Storage נפרד.
// ─────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { createOrUpdateUser, getUser } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'
import { IconBackRTL } from '../icons/index.jsx'

// כיווץ תמונה לתמונת פרופיל.
// חותך לריבוע מהמרכז, מקטין ל-200px, ודוחס ל-JPEG.
// אם ה-base64 עדיין גדול מ-200KB — דוחס שוב באיכות נמוכה יותר,
// כדי שתמיד ייכנס בבטחה למסמך Firestore (מגבלה: 1MB למסמך).
const MAX_DATAURL_BYTES = 200 * 1024   // ~200KB

function compressImage(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        // crop to a centered square
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2

        const canvas = document.createElement('canvas')
        canvas.width = maxSize
        canvas.height = maxSize
        const ctx = canvas.getContext('2d')
        // fill white first (in case the source has transparency)
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, maxSize, maxSize)
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize)

        // try progressively lower quality until small enough
        let quality = 0.7
        let dataURL = canvas.toDataURL('image/jpeg', quality)
        while (dataURL.length > MAX_DATAURL_BYTES && quality > 0.3) {
          quality -= 0.15
          dataURL = canvas.toDataURL('image/jpeg', quality)
        }
        resolve(dataURL)
      }
      img.onerror = () => reject(new Error('image load failed'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

export default function ProfilePage({ onBack }) {
  const { profile, authUser, setProfile } = useUserStore()
  const fileRef = useRef(null)

  const [firstName, setFirstName] = useState(profile?.name || '')
  const [lastName, setLastName]   = useState(profile?.lastName || '')
  const [gender, setGender]       = useState(profile?.gender || '')
  const [phone, setPhone]         = useState(profile?.phone || '')
  const [photoURL, setPhotoURL]   = useState(profile?.photoURL || null)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')

  const email = authUser?.email || profile?.email || ''

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMsg('יש לבחור קובץ תמונה')
      return
    }
    try {
      const compressed = await compressImage(file)
      setPhotoURL(compressed)
      setMsg('')
    } catch (err) {
      console.error(err)
      setMsg('לא הצלחנו לטעון את התמונה')
    }
  }

  const handleSave = async () => {
    if (!authUser?.uid || saving) return
    if (!firstName.trim()) {
      setMsg('יש להזין שם פרטי')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const data = {
        name: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        phone: phone.trim(),
      }
      if (photoURL) data.photoURL = photoURL

      await createOrUpdateUser(authUser.uid, data)

      // refresh the profile in the store
      const fresh = await getUser(authUser.uid)
      if (fresh) setProfile(fresh)

      setMsg('✓ הפרטים נשמרו!')
      setTimeout(() => onBack(), 800)
    } catch (e) {
      console.error('profile save error:', e)
      setMsg('לא הצלחנו לשמור — נסו שוב')
    }
    setSaving(false)
  }

  const displayName = firstName.trim() || 'אורח'

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      {/* Header */}
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <div className="screen-header__title">עריכת פרופיל</div>
      </div>

      <div style={{ padding: '8px 20px 32px' }}>
        {/* ── Photo ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: 24,
        }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={displayName} size={110} photoURL={photoURL} color="#6B3A4F" />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                position: 'absolute', insetInlineEnd: -4, bottom: -4,
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--burgundy)', color: 'white',
                border: '3px solid var(--bg-app)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, cursor: 'pointer',
              }}
              aria-label="שנה תמונה"
            >
              📷
            </button>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              marginTop: 12, fontSize: 15, fontWeight: 700,
              color: 'var(--burgundy)', fontFamily: 'inherit',
            }}
          >
            {photoURL ? 'החלף תמונה' : 'הוסף תמונת פרופיל'}
          </button>
          {photoURL && (
            <button
              onClick={() => setPhotoURL(null)}
              style={{
                marginTop: 4, fontSize: 13, fontWeight: 600,
                color: 'var(--ink-3)', fontFamily: 'inherit',
              }}
            >
              הסר תמונה
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoPick}
            style={{ display: 'none' }}
          />
        </div>

        {/* ── Fields ─────────────────────────────────────── */}
        <Field label="שם פרטי">
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="השם הפרטי שלך"
            style={inputStyle}
          />
        </Field>

        <Field label="שם משפחה">
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="שם המשפחה שלך"
            style={inputStyle}
          />
        </Field>

        <Field label="מגדר">
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: 'female', label: 'נקבה' }, { id: 'male', label: 'זכר' }].map(g => (
              <button key={g.id} type="button" onClick={() => setGender(g.id)} style={{
                flex: 1, padding: '13px 0', fontSize: 17, fontWeight: 700,
                borderRadius: 14, border: '1px solid var(--line-strong)',
                background: gender === g.id ? 'var(--burgundy)' : 'var(--surface)',
                color: gender === g.id ? 'white' : 'var(--ink)',
                fontFamily: 'inherit', cursor: 'pointer',
              }}>
                {g.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="טלפון">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="מספר הטלפון שלך"
            type="tel"
            style={inputStyle}
          />
        </Field>

        <Field label="אימייל">
          <input
            value={email}
            disabled
            style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--ink-3)' }}
          />
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontWeight: 500 }}>
            זהו האימייל שאיתו נרשמת — לא ניתן לשינוי
          </div>
        </Field>

        {/* ── Save ───────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="big-btn big-btn--primary"
          style={{ width: '100%', marginTop: 12, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>

        {msg && (
          <div style={{
            textAlign: 'center', marginTop: 14, fontSize: 15,
            fontWeight: 700,
            color: msg.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
          }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        fontSize: 14, fontWeight: 700, color: 'var(--ink)',
        display: 'block', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', fontSize: 17, fontFamily: 'inherit',
  padding: '13px 14px', borderRadius: 14,
  border: '1px solid var(--line-strong)',
  background: 'var(--surface)', color: 'var(--ink)',
  direction: 'rtl',
}
