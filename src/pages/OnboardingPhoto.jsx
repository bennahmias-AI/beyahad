// src/pages/OnboardingPhoto.jsx
// ─────────────────────────────────────────────────────────────
// שלב אחרון בהרשמה — בחירת תמונה. מוצג ע"י App כשהפרופיל
// onboarded === false (מיד אחרי אימות הטלפון).
//
// אפשרויות: אווטאר מובנה (AvatarPicker) או העלאה/צילום תמונה
// אמיתית (נדחסת ל-base64 ונשמרת ישירות במסמך — בלי Storage).
// סיום → { photoURL?, onboarded: true } → המשתמש נכנס לאפליקציה.
// ─────────────────────────────────────────────────────────────
import { useState, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { createOrUpdateUser, getUser, signOut } from '../services/firebase.js'
import { IconBackRTL } from '../icons/index.jsx'
import Avatar from '../components/Avatar.jsx'
import AvatarPicker from '../components/AvatarPicker.jsx'
import AppLogo from '../components/AppLogo.jsx'

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
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const displayName = profile?.name || 'אורח'
  const gender = profile?.gender || ''

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
    setSaving(true); setMsg('')
    try {
      const data = { onboarded: true }
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
    signOut()   // מתנתק וחוזר למסך הכניסה
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto', direction: 'rtl',
      background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--bg-app) 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '34px 24px 40px', textAlign: 'center', position: 'relative',
    }}>
      <button onClick={handleBack} aria-label="חזרה למסך הכניסה" style={{
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
    </div>
  )
}

function pillBtn(kind) {
  const base = {
    fontSize: 14.5, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
    border: 'none', borderRadius: 999, padding: '11px 20px',
  }
  if (kind === 'burgundy') return { ...base, color: 'var(--burgundy)', background: 'var(--burgundy-soft)' }
  return { ...base, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--line)' }
}
