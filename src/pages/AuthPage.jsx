// src/pages/AuthPage.jsx
// ─────────────────────────────────────────────────────────────
// הרשמה והתחברות מבוססות טלפון + קוד SMS.
//
//  כניסה (חוזרים):  טלפון → קוד SMS → פנימה.
//  הרשמה (חדשים):   פרטים (שם/שם משפחה/מגדר/עיר/מייל*/טלפון)
//                    → קוד SMS → אימות. *מייל לא חובה.
//                    בחירת תמונה מתבצעת אחרי האימות (OnboardingPhoto).
//
// הפרופיל נכתב עם onboarded:false; שלב התמונה מסיים ל-onboarded:true.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { sendOtp, verifyOtp, createOrUpdateUser } from '../services/firebase.js'
import { colors } from '../design-system/index.js'
import AppLogo from '../components/AppLogo.jsx'

// המרת מספר ישראלי ל-E.164 (‎+972‎). מקבל 05X-XXXXXXX / 05XXXXXXXX / ‎+972…‎
function normalizePhone(raw) {
  let d = (raw || '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) return d
  if (d.startsWith('972')) return '+' + d
  if (d.startsWith('0')) return '+972' + d.slice(1)
  if (d) return '+972' + d
  return ''
}
function isValidILPhone(e164) {
  // ‎+972‎ ואז 9 ספרות (נייד ישראלי), מאפשר גם 8 ליתר ביטחון
  return /^\+972\d{8,9}$/.test(e164)
}

const AUTH_ERRORS = {
  'auth/invalid-phone-number':      'מספר הטלפון לא תקין',
  'auth/too-many-requests':         'יותר מדי ניסיונות — נסו שוב מאוחר יותר',
  'auth/operation-not-allowed':     'אימות טלפון אינו מופעל כרגע. נסו שוב בקרוב.',
  'auth/invalid-verification-code': 'הקוד שגוי — בדקו ונסו שוב',
  'auth/code-expired':              'הקוד פג תוקף — שלחו קוד חדש',
  'auth/missing-verification-code': 'נא להזין את הקוד',
}

export default function AuthPage() {
  const [mode, setMode]   = useState('login')   // 'login' | 'register'
  const [step, setStep]   = useState('form')    // 'form' | 'otp'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // שדות
  const [name, setName]         = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender]     = useState('')
  const [city, setCity]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [code, setCode]         = useState('')

  function resetTo(newMode) {
    setMode(newMode); setStep('form'); setError(''); setCode('')
  }

  // שלב 1 — שליחת קוד. בהרשמה מאמתים תחילה את כל הפרטים.
  async function handleSendCode() {
    setError('')
    if (mode === 'register') {
      if (!name.trim())     { setError('נא להזין שם פרטי'); return }
      if (!lastName.trim()) { setError('נא להזין שם משפחה'); return }
      if (!gender)          { setError('נא לבחור מגדר'); return }
      if (!city.trim())     { setError('נא להזין עיר'); return }
    }
    const e164 = normalizePhone(phone)
    if (!isValidILPhone(e164)) { setError('נא להזין מספר טלפון נייד תקין (למשל 050-1234567)'); return }

    setLoading(true)
    try {
      await sendOtp(e164)
      setStep('otp')
    } catch (e) {
      console.error('sendOtp error:', e)
      setError(AUTH_ERRORS[e.code] || 'לא הצלחנו לשלוח קוד — בדקו את המספר ונסו שוב')
    } finally {
      setLoading(false)
    }
  }

  // שלב 2 — אימות הקוד. בהרשמה כותבים את הפרופיל (onboarded:false).
  async function handleVerify() {
    setError('')
    if (!code.trim()) { setError('נא להזין את הקוד מה-SMS'); return }
    setLoading(true)
    try {
      const cred = await verifyOtp(code.trim())
      const uid = cred.user.uid
      if (mode === 'register') {
        const data = {
          name: name.trim(),
          lastName: lastName.trim(),
          gender,
          city: city.trim(),
          phone: normalizePhone(phone),
          status: 'available',
          interests: [],
          onboarded: false,          // → שלב התמונה (OnboardingPhoto)
        }
        if (email.trim()) data.email = email.trim()
        await createOrUpdateUser(uid, data)
      }
      // משתמש חוזר (login) — useAuth יטען את הפרופיל ויכניס פנימה.
    } catch (e) {
      console.error('verifyOtp error:', e)
      setError(AUTH_ERRORS[e.code] || 'האימות נכשל — בדקו את הקוד ונסו שוב')
      setLoading(false)
    }
    // לא מכבים loading בהצלחה — המסך מתחלף ברגע שהמשתמש מחובר.
  }

  async function handleResend() {
    setError(''); setCode('')
    const e164 = normalizePhone(phone)
    setLoading(true)
    try {
      await sendOtp(e164)
    } catch (e) {
      setError(AUTH_ERRORS[e.code] || 'לא הצלחנו לשלוח קוד חדש')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100%',
      background: `linear-gradient(180deg, ${colors.bgPage} 0%, ${colors.bgApp} 100%)`,
      display: 'flex', flexDirection: 'column',
      padding: '30px 24px 40px', overflowY: 'auto',
      direction: 'rtl',
    }}>
      {/* כותרת + לוגו */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 66, height: 66, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 18px -6px ${colors.burgundy}66`, borderRadius: 20,
        }}>
          <AppLogo size={66} />
        </div>
        <div style={{ marginTop: 12, fontSize: 28, lineHeight: 1, fontFamily: "'Suez One', serif", color: colors.ink }}>
          {step === 'otp' ? 'אימות מספר' : mode === 'register' ? 'ברוכים הבאים' : 'שמחים לראותך'}
        </div>
        <div style={{ fontSize: 15, color: colors.ink2, marginTop: 6 }}>
          {step === 'otp'
            ? 'הזינו את הקוד ששלחנו ב-SMS'
            : (mode === 'register' ? 'פתחו חשבון חדש ב' : 'התחברו לחשבון שלכם ב')}
          {step !== 'otp' && <span style={{ color: colors.burgundy, fontWeight: 700 }}>ביחד</span>}
        </div>
      </div>

      {/* טאבים — רק בשלב הטופס */}
      {step === 'form' && (
        <div style={{
          display: 'flex', gap: 24, justifyContent: 'center',
          borderBottom: `1px solid ${colors.line}`, marginBottom: 22,
        }}>
          {[{ id: 'login', label: 'כניסה' }, { id: 'register', label: 'הרשמה' }].map(t => {
            const active = mode === t.id
            return (
              <button key={t.id} onClick={() => resetTo(t.id)} style={{
                padding: '0 2px 12px', fontSize: 17, fontWeight: 700,
                fontFamily: 'inherit', cursor: 'pointer', background: 'none', border: 'none',
                color: active ? colors.burgundy : colors.ink3,
                borderBottom: active ? `3px solid ${colors.burgundy}` : '3px solid transparent',
                marginBottom: -1.5, minHeight: 'unset', minWidth: 'unset',
              }}>{t.label}</button>
            )
          })}
        </div>
      )}

      {/* ── שלב הטופס ── */}
      {step === 'form' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <>
              <FormField label="שם פרטי">
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="מרים" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
              </FormField>
              <FormField label="שם משפחה">
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="כהן" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
              </FormField>
              <FormField label="מגדר">
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ id: 'female', label: 'נקבה' }, { id: 'male', label: 'זכר' }].map(g => {
                    const active = gender === g.id
                    return (
                      <button key={g.id} type="button" onClick={() => setGender(g.id)} style={{
                        flex: 1, padding: '13px 0', fontSize: 17, fontWeight: 700,
                        borderRadius: 999, border: 'none',
                        background: active ? colors.burgundy : colors.surface2,
                        color: active ? 'white' : colors.ink2,
                        fontFamily: 'inherit', cursor: 'pointer', minHeight: 'unset',
                        boxShadow: active ? `0 4px 12px -4px ${colors.burgundy}80` : 'none',
                        transition: 'all 0.2s',
                      }}>{g.label}</button>
                    )
                  })}
                </div>
              </FormField>
              <FormField label="עיר">
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="תל אביב" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
              </FormField>
              <FormField label="כתובת מייל (לא חובה)">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="miriam@gmail.com" dir="ltr" style={{ ...underlineInput, textAlign: 'left' }}/>
              </FormField>
            </>
          )}

          <FormField label="מספר טלפון">
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="050-1234567" dir="ltr" style={{ ...underlineInput, textAlign: 'left' }}/>
          </FormField>

          {error && <ErrorBox>{error}</ErrorBox>}

          <PrimaryButton loading={loading} onClick={handleSendCode}>
            {loading ? 'שולח קוד...' : 'שליחת קוד ב-SMS →'}
          </PrimaryButton>
        </div>
      )}

      {/* ── שלב הקוד ── */}
      {step === 'otp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, color: colors.ink2, textAlign: 'center', marginBottom: 4 }}>
            שלחנו קוד למספר <span style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>{normalizePhone(phone)}</span>
          </div>
          <FormField label="קוד אימות">
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456" inputMode="numeric" dir="ltr" maxLength={6}
              style={{ ...underlineInput, textAlign: 'center', letterSpacing: '0.4em', fontSize: 24 }}/>
          </FormField>

          {error && <ErrorBox>{error}</ErrorBox>}

          <PrimaryButton loading={loading} onClick={handleVerify}>
            {loading ? 'מאמת...' : 'אישור והמשך →'}
          </PrimaryButton>

          <div style={{ textAlign: 'center', display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            <button onClick={handleResend} disabled={loading}
              style={{ color: colors.burgundy, fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minHeight: 'unset' }}>
              שליחת קוד חדש
            </button>
            <button onClick={() => { setStep('form'); setError(''); setCode('') }}
              style={{ color: colors.ink3, fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minHeight: 'unset' }}>
              החלפת מספר
            </button>
          </div>
        </div>
      )}

      {/* מעבר בין כניסה/הרשמה — רק בשלב הטופס */}
      {step === 'form' && (
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: colors.ink3 }}>
          {mode === 'login' ? 'אין לך חשבון? ' : 'יש לך חשבון? '}
          <button onClick={() => resetTo(mode === 'login' ? 'register' : 'login')}
            style={{ color: colors.burgundy, fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
            {mode === 'login' ? 'הרשמה כאן' : 'כניסה כאן'}
          </button>
        </div>
      )}

      {/* reCAPTCHA בלתי-נראה — נדרש ל-signInWithPhoneNumber */}
      <div id="recaptcha-container" />
    </div>
  )
}

// ── רכיבי עזר ─────────────────────────────────────────────
const underlineInput = {
  width: '100%', boxSizing: 'border-box', padding: '12px 2px 11px',
  fontSize: 19, fontWeight: 500, border: 'none',
  borderBottom: `2px solid ${colors.lineStrong}`, background: 'transparent',
  fontFamily: 'inherit', color: colors.ink, outline: 'none',
}

function FormField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, textAlign: 'right', color: colors.ink2 }}>{label}</div>
      {children}
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      background: colors.burgundySoft, color: colors.burgundyDeep,
      borderRadius: 12, padding: '11px 14px', fontSize: 15, fontWeight: 600, textAlign: 'right',
    }}>{children}</div>
  )
}

function PrimaryButton({ loading, onClick, children }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: '100%', marginTop: 10, padding: '16px 0', textAlign: 'center',
      border: 'none', borderRadius: 16, background: colors.burgundy, color: 'white',
      fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
      cursor: loading ? 'default' : 'pointer',
      boxShadow: `0 8px 18px -6px ${colors.burgundy}73`,
      opacity: loading ? 0.7 : 1, minHeight: 'unset',
    }}>{children}</button>
  )
}
