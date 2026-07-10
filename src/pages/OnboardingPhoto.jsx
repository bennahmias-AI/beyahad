// src/pages/OnboardingPhoto.jsx
// ─────────────────────────────────────────────────────────────
// השלמת ההרשמה — מוצג ע"י App כשהפרופיל onboarded === false,
// מיד אחרי האימות (Google או טלפון). שני שלבים:
//
//   1) 'details' — פרטי ההרשמה: שם, שם משפחה, מגדר, שנת לידה, עיר.
//      מגיע עם ערכים ממולאים מראש אם קיימים (למשל שם מחשבון Google).
//      כולל שער גיל 18+ (כמו שהיה בטופס ההרשמה הישן).
//   2) 'photo' — בחירת תמונה: אווטאר מובנה או העלאה/צילום
//      (נדחסת ל-base64 ונשמרת ישירות במסמך — בלי Storage).
//
// סיום → { name, lastName, gender, birthYear, city, photoURL?, onboarded: true }
// והמשתמש נכנס לאפליקציה.
// ─────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { createOrUpdateUser, getUser, signOut } from '../services/firebase.js'
import { IconBackRTL } from '../icons/index.jsx'
import Avatar from '../components/Avatar.jsx'
import AvatarPicker from '../components/AvatarPicker.jsx'
import AppLogo from '../components/AppLogo.jsx'

// שנת לידה סבירה: בין 1910 לפני 18 שנה מהיום (מבוגר מ-18) — האפליקציה לגיל 18+
const CURRENT_YEAR = new Date().getFullYear()
function isValidBirthYear(y) {
  const n = parseInt(y, 10)
  return Number.isInteger(n) && n >= 1910 && n <= CURRENT_YEAR - 18
}
// מזהה שנה מלאה שמתאימה למישהו מתחת לגיל 18 — להצגת אזהרה מיידית
function isUnder18Year(y) {
  const s = String(y || '').trim()
  if (s.length !== 4) return false
  const n = parseInt(s, 10)
  return Number.isInteger(n) && n > CURRENT_YEAR - 18 && n <= CURRENT_YEAR
}

// כיווץ תמונה: חיתוך ריבוע מהמרכז, 200px, JPEG עד ~200KB.
const MAX_DATAURL_BYTES = 200 * 1024
function compressImage(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        const canvas = document.createElement('canvas')
        canvas.width = maxSize; canvas.height = maxSize
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, maxSize, maxSize)
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize)
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

export default function OnboardingPhoto() {
  const { profile, authUser, setProfile } = useUserStore()
  const fileRef = useRef(null)

  const [step, setStep] = useState('details')  // 'details' | 'photo'

  // פרטי ההרשמה — ממולאים מראש ממה שכבר קיים בפרופיל (למשל שם מ-Google)
  const [name, setName]           = useState(profile?.name || '')
  const [lastName, setLastName]   = useState(profile?.lastName || '')
  const [gender, setGender]       = useState(profile?.gender || '')
  const [birthYear, setBirthYear] = useState(profile?.birthYear ? String(profile.birthYear) : '')
  const [city, setCity]           = useState(profile?.city || '')

  const [photoURL, setPhotoURL] = useState(profile?.photoURL || null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const displayName = name.trim() || profile?.name || 'חברים'

  // ולידציות לוי הירוק
  const vName = name.trim().length > 0
  const vLast = lastName.trim().length > 0
  const vYear = isValidBirthYear(birthYear)
  const vCity = city.trim().length > 0

  function validateDetails() {
    setMsg('')
    if (!name.trim())     { setMsg('נא להזין שם פרטי'); return false }
    if (!lastName.trim()) { setMsg('נא להזין שם משפחה'); return false }
    if (!gender)          { setMsg('נא לבחור מגדר'); return false }
    if (!isValidBirthYear(birthYear)) {
      if (isUnder18Year(birthYear)) {
        setMsg('האפליקציה מיועדת לגיל 18 ומעלה. אנא תקנו את שנת הלידה.')
      } else {
        setMsg('נא להזין שנת לידה תקינה (למשל 1955)')
      }
      return false
    }
    if (!city.trim())     { setMsg('נא להזין עיר'); return false }
    return true
  }

  function handleDetailsNext() {
    if (!validateDetails()) return
    setMsg('')
    setStep('photo')
  }

  async function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg('יש לבחור קובץ תמונה'); return }
    try {
      const compressed = await compressImage(file)
      setPhotoURL(compressed); setMsg('')
    } catch (err) {
      console.error(err); setMsg('לא הצלחנו לטעון את התמונה — נסו שוב')
    }
  }

  async function handleFinish() {
    if (!authUser?.uid || saving) return
    if (!validateDetails()) { setStep('details'); return }
    setSaving(true); setMsg('')
    try {
      const data = {
        name: name.trim(),
        lastName: lastName.trim(),
        gender,
        birthYear: parseInt(birthYear, 10),
        city: city.trim(),
        onboarded: true,
      }
      if (photoURL) data.photoURL = photoURL
      await createOrUpdateUser(authUser.uid, data)
      const fresh = await getUser(authUser.uid)
      if (fresh) setProfile(fresh)
      // setProfile עם onboarded:true → App יציג את האפליקציה.
    } catch (e) {
      console.error('onboarding finish error:', e)
      setMsg('לא הצלחנו לשמור — נסו שוב')
      setSaving(false)
    }
  }

  function handleBack() {
    if (saving) return
    if (step === 'photo') { setStep('details'); setMsg(''); return }
    signOut()   // בשלב הפרטים — מתנתק וחוזר למסך הכניסה
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto', direction: 'rtl',
      background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--bg-app) 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '34px 24px 40px', textAlign: 'center', position: 'relative',
    }}>
      <button onClick={handleBack} aria-label={step === 'photo' ? 'חזרה לפרטים' : 'חזרה למסך הכניסה'} style={{
        position: 'absolute', insetInlineStart: 16, top: 18,
        width: 40, height: 40, borderRadius: '50%', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-2)', border: '1px solid var(--line)',
        color: 'var(--ink-2)', cursor: 'pointer',
      }}>
        <IconBackRTL size={22} />
      </button>
      <div style={{ width: 60, height: 60, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AppLogo size={60} />
      </div>

      {/* מחוון שלבים */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
        {['details', 'photo'].map(s => (
          <div key={s} style={{
            width: step === s ? 26 : 10, height: 10, borderRadius: 999,
            background: step === s ? 'var(--burgundy)' : 'var(--line)',
            transition: 'all 0.25s',
          }} />
        ))}
      </div>

      {step === 'details' ? (
        <>
          <div style={{ fontSize: 26, fontFamily: "'Suez One', serif", color: 'var(--ink)', lineHeight: 1.1 }}>
            נעים להכיר!
          </div>
          <div style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 8, fontWeight: 500 }}>
            עוד כמה פרטים קטנים ואנחנו בפנים
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24, textAlign: 'right' }}>
            <Field label="שם פרטי" valid={vName}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="הזינו את שמכם" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
            </Field>
            <Field label="שם משפחה" valid={vLast}>
              <input value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="הזינו שם משפחה" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
            </Field>
            <Field label="מגדר" valid={!!gender}>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ id: 'female', label: 'נקבה' }, { id: 'male', label: 'זכר' }].map(g => {
                  const active = gender === g.id
                  return (
                    <button key={g.id} type="button" onClick={() => setGender(g.id)} style={{
                      flex: 1, padding: '13px 0', fontSize: 17, fontWeight: 700,
                      borderRadius: 999, border: 'none',
                      background: active ? 'var(--burgundy)' : 'var(--surface-2)',
                      color: active ? 'white' : 'var(--ink-2)',
                      fontFamily: 'inherit', cursor: 'pointer', minHeight: 'unset',
                      transition: 'all 0.2s',
                    }}>{g.label}</button>
                  )
                })}
              </div>
            </Field>
            <Field label="שנת לידה" valid={vYear}>
              <input value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="הזינו שנת לידה" inputMode="numeric" dir="ltr" maxLength={4}
                style={{ ...underlineInput, textAlign: 'left', letterSpacing: '0.1em' }}/>
            </Field>
            {/* אזהרה מיידית למי שמתחת לגיל 18 */}
            {isUnder18Year(birthYear) && (
              <div style={{
                background: '#fef3e2', border: '1px solid #e8a93e',
                borderRadius: 12, padding: '10px 14px', marginTop: -8,
                fontSize: 13.5, color: '#7a5410', fontWeight: 600, lineHeight: 1.45, textAlign: 'right',
              }}>
                ⚠️ האפליקציה מיועדת למשתמשים <strong>מעל גיל 18</strong>.<br/>
                אנא תקנו את שנת הלידה לשנה שלא מאוחר מ-{CURRENT_YEAR - 18}.
              </div>
            )}
            <Field label="עיר" valid={vCity}>
              <input value={city} onChange={e => setCity(e.target.value)}
                placeholder="הזינו עיר מגורים" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
            </Field>
          </div>

          {msg && <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 14, marginTop: 14 }}>{msg}</div>}

          <div style={{ flex: 1 }} />

          <button onClick={handleDetailsNext} className="big-btn big-btn--primary"
            style={{ width: '100%', marginTop: 20 }}>
            המשך לבחירת תמונה ←
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 26, fontFamily: "'Suez One', serif", color: 'var(--ink)', lineHeight: 1.1 }}>
            כמעט סיימנו, {displayName}!
          </div>
          <div style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 8, fontWeight: 500 }}>
            בחרו תמונה שתופיע בפרופיל שלכם
          </div>

          {/* תצוגת התמונה */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '26px 0 18px' }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={displayName} size={132} photoURL={photoURL} gender={gender} seed={authUser?.uid} color="#6B3A4F" />
              <button onClick={() => fileRef.current?.click()} aria-label="צלם או העלה תמונה" style={{
                position: 'absolute', insetInlineEnd: -4, bottom: -4,
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--burgundy)', color: 'white', border: '3px solid var(--bg-app)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer',
              }}>📷</button>
            </div>
          </div>

          {/* כפתורי בחירה */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <button onClick={() => fileRef.current?.click()} style={pillBtn('burgundy')}>
              📷 {photoURL ? 'החלף תמונה' : 'צלם / העלה תמונה'}
            </button>
            <button onClick={() => setPickerOpen(true)} style={pillBtn('soft')}>
              😊 בחר דמות מוכנה
            </button>
          </div>
          {photoURL && (
            <button onClick={() => setPhotoURL(null)} style={{
              fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', background: 'none',
              border: 'none', cursor: 'pointer', marginBottom: 4,
            }}>הסר תמונה</button>
          )}

          {msg && <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 14, marginTop: 8 }}>{msg}</div>}

          <div style={{ flex: 1 }} />

          <button onClick={handleFinish} disabled={saving} className="big-btn big-btn--primary"
            style={{ width: '100%', marginTop: 20, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'שומר...' : 'סיום — כניסה לביחד'}
          </button>

          <input ref={fileRef} type="file" accept="image/*" capture="user"
            onChange={handlePhotoPick} style={{ display: 'none' }} />

          {pickerOpen && (
            <AvatarPicker
              current={photoURL}
              gender={gender}
              onPick={(val) => { setPhotoURL(val); setPickerOpen(false); setMsg('') }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

// שדה טופס עם תווית + וי ירוק כשהערך תקין
function Field({ label, children, valid }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</span>
        {valid && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: '50%', background: 'var(--success, #4F6B4A)',
            flexShrink: 0,
          }} aria-label="תקין">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

const underlineInput = {
  width: '100%', boxSizing: 'border-box', padding: '12px 2px 11px',
  fontSize: 19, fontWeight: 500, border: 'none',
  borderBottom: '2px solid var(--line-strong)', background: 'transparent',
  fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
}

function pillBtn(kind) {
  const base = {
    fontSize: 14.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', borderRadius: 999, padding: '11px 20px',
  }
  if (kind === 'burgundy') return { ...base, color: 'var(--burgundy)', background: 'var(--burgundy-soft)' }
  return { ...base, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--line)' }
}
