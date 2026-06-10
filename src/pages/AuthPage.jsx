// src/pages/AuthPage.jsx
// ─────────────────────────────────────────────────────────────
// הרשמה והתחברות מבוססות טלפון + קוד SMS, עם ערוץ חלופי: קוד במייל.
//
//  כניסה (חוזרים):  טלפון או מייל → קוד → פנימה.
//  הרשמה (חדשים):   פרטים (שם/שם משפחה/מגדר/שנת לידה/עיר/מייל/טלפון)
//                    → בחירת ערוץ (SMS / מייל) → קוד → אימות.
//                    בחירת תמונה מתבצעת אחרי האימות (OnboardingPhoto).
//
// הפרופיל נכתב עם onboarded:false; שלב התמונה מסיים ל-onboarded:true.
//
// ערוצי שליחת קוד:
//   • SMS  — Firebase Phone Auth (sendOtp/verifyOtp). ברירת המחדל.
//   • מייל — שרת ייעודי (sendEmailCode/verifyEmailCode) דרך Resend.
// במסך הקוד אפשר אחרי 40 שניות להחליף ערוץ (לשלוח שוב ב-SMS או במייל).
//
// ולידציה ויזואלית: כל שדה תקין מקבל וי ירוק (✓) בצדו.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import {
  sendOtp, verifyOtp, createOrUpdateUser,
  sendEmailCode, verifyEmailCode,
} from '../services/firebase.js'
import { colors } from '../design-system/index.js'
import AppLogo from '../components/AppLogo.jsx'

const RESEND_SECONDS = 60      // סטופר לשליחה חוזרת באותו ערוץ
const SWITCH_SECONDS = 40      // אחרי כמה שניות אפשר להחליף ערוץ

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
  return /^\+972\d{8,9}$/.test(e164)
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}
// שנת לידה סבירה: בין 1910 לפני 16 שנה מהיום (מבוגר מ-16)
const CURRENT_YEAR = new Date().getFullYear()
function isValidBirthYear(y) {
  const n = parseInt(y, 10)
  return Number.isInteger(n) && n >= 1910 && n <= CURRENT_YEAR - 16
}

const AUTH_ERRORS = {
  'auth/invalid-phone-number':      'מספר הטלפון לא תקין',
  'auth/too-many-requests':         'יותר מדי ניסיונות — נסו שוב מאוחר יותר',
  'auth/operation-not-allowed':     'אימות טלפון אינו מופעל כרגע. נסו שוב בקרוב.',
  'auth/invalid-verification-code': 'הקוד שגוי — בדקו ונסו שוב',
  'auth/code-expired':              'הקוד פג תוקף — שלחו קוד חדש',
  'auth/missing-verification-code': 'נא להזין את הקוד',
}
// הודעות שגיאה לערוץ המייל (reason → טקסט עברית)
const EMAIL_ERRORS = {
  'bad-email':         'כתובת המייל לא תקינה',
  'too-soon':          'נשלח קוד זה עתה — המתינו רגע לפני שליחה חוזרת',
  'wrong-code':        'הקוד שגוי — בדקו ונסו שוב',
  'expired':           'הקוד פג תוקף — שלחו קוד חדש',
  'too-many-attempts': 'יותר מדי ניסיונות — שלחו קוד חדש',
  'used':              'הקוד כבר נוצל — שלחו קוד חדש',
  'no-code':           'לא נמצא קוד — שלחו קוד חדש',
  'error':             'משהו השתבש — נסו שוב',
}

export default function AuthPage() {
  const [mode, setMode]   = useState('login')   // 'login' | 'register'
  const [step, setStep]   = useState('form')    // 'form' | 'otp'
  const [channel, setChannel] = useState('sms') // 'sms' | 'email' — הערוץ הפעיל לקוד
  const [loading, setLoading] = useState(false) // לכפתור האימות
  const [sending, setSending] = useState(false) // שליחת הקוד רצה ברקע
  const [resendIn, setResendIn] = useState(0)   // סטופר אחורה לשליחה חוזרת
  const [elapsed, setElapsed] = useState(0)     // שניות שעברו במסך הקוד (להחלפת ערוץ)
  const [error, setError] = useState('')

  const timerRef = useRef(null)
  const elapsedRef = useRef(null)

  // שדות
  const [name, setName]         = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender]     = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [city, setCity]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [code, setCode]         = useState('')

  // ניקוי הטיימרים ביציאה מהרכיב
  useEffect(() => () => { stopTimer(); stopElapsed() }, [])

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }
  function stopElapsed() {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
  }

  // מתחיל סטופר של 60 שניות אחורה (לשליחת קוד נוסף)
  function startResendTimer() {
    stopTimer()
    setResendIn(RESEND_SECONDS)
    timerRef.current = setInterval(() => {
      setResendIn(s => {
        if (s <= 1) { stopTimer(); return 0 }
        return s - 1
      })
    }, 1000)
  }

  // מתחיל מונה "שניות שעברו" במסך הקוד — לפתיחת החלפת ערוץ אחרי 40 שניות
  function startElapsed() {
    stopElapsed()
    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  // שולח קוד SMS ברקע (לא חוסם). שגיאה מוצגת במסך הקוד.
  function fireSendSms(e164) {
    setSending(true)
    sendOtp(e164)
      .catch(e => {
        console.error('sendOtp error:', e)
        setError(AUTH_ERRORS[e.code] || 'לא הצלחנו לשלוח קוד — בדקו את המספר ונסו שוב')
      })
      .finally(() => setSending(false))
  }

  // שולח קוד מייל ברקע. שגיאה מוצגת במסך הקוד.
  function fireSendEmail(addr) {
    setSending(true)
    sendEmailCode(addr)
      .then(res => {
        if (!res.ok) setError(EMAIL_ERRORS[res.reason] || EMAIL_ERRORS.error)
      })
      .catch(e => {
        console.error('sendEmailCode error:', e)
        setError(EMAIL_ERRORS.error)
      })
      .finally(() => setSending(false))
  }

  function resetTo(newMode) {
    stopTimer(); stopElapsed()
    setMode(newMode); setStep('form'); setError(''); setCode('')
    setResendIn(0); setElapsed(0); setSending(false)
  }

  function backToForm() {
    stopTimer(); stopElapsed()
    setStep('form'); setError(''); setCode(''); setResendIn(0); setElapsed(0); setSending(false)
  }

  // מאמת את פרטי הטופס (בהרשמה). מחזיר true אם תקין, אחרת מציג שגיאה.
  function validateForm(forChannel) {
    setError('')
    if (mode === 'register') {
      if (!name.trim())     { setError('נא להזין שם פרטי'); return false }
      if (!lastName.trim()) { setError('נא להזין שם משפחה'); return false }
      if (!gender)          { setError('נא לבחור מגדר'); return false }
      if (!isValidBirthYear(birthYear)) { setError('נא להזין שנת לידה תקינה (למשל 1955)'); return false }
      if (!city.trim())     { setError('נא להזין עיר'); return false }
    }
    if (forChannel === 'email') {
      if (!isValidEmail(email)) { setError('נא להזין כתובת מייל תקינה'); return false }
    } else {
      const e164 = normalizePhone(phone)
      if (!isValidILPhone(e164)) { setError('נא להזין מספר טלפון נייד תקין (למשל 050-1234567)'); return false }
    }
    return true
  }

  // שלב 1 — שליחת קוד בערוץ הנבחר. עוברים מיד למסך הקוד; השליחה רצה ברקע.
  function handleSendCode(forChannel) {
    if (!validateForm(forChannel)) return
    setError(''); setCode('')
    setChannel(forChannel)
    setStep('otp')
    startResendTimer()
    startElapsed()
    if (forChannel === 'email') fireSendEmail(email.trim())
    else fireSendSms(normalizePhone(phone))
  }

  // שלב 2 — אימות הקוד. בהרשמה כותבים את הפרופיל (onboarded:false).
  async function handleVerify() {
    setError('')
    if (!code.trim()) { setError('נא להזין את הקוד שקיבלת'); return }
    setLoading(true)
    try {
      let uid
      if (channel === 'email') {
        const res = await verifyEmailCode(email.trim(), code.trim())
        if (!res.ok) {
          setError(EMAIL_ERRORS[res.reason] || EMAIL_ERRORS.error)
          setLoading(false); return
        }
        uid = res.uid
      } else {
        const cred = await verifyOtp(code.trim())
        uid = cred.user.uid
      }
      if (mode === 'register') {
        const data = {
          name: name.trim(),
          lastName: lastName.trim(),
          gender,
          birthYear: parseInt(birthYear, 10),
          city: city.trim(),
          status: 'available',
          interests: [],
          onboarded: false,
        }
        if (email.trim()) data.email = email.trim().toLowerCase()
        if (normalizePhone(phone)) data.phone = normalizePhone(phone)
        await createOrUpdateUser(uid, data)
      }
      stopTimer(); stopElapsed()
      // משתמש חוזר (login) — useAuth יטען את הפרופיל ויכניס פנימה.
    } catch (e) {
      console.error('verify error:', e)
      setError(AUTH_ERRORS[e.code] || 'האימות נכשל — בדקו את הקוד ונסו שוב')
      setLoading(false)
    }
    // לא מכבים loading בהצלחה — המסך מתחלף ברגע שהמשתמש מחובר.
  }

  // שליחת קוד נוסף באותו ערוץ — לחיץ רק כשהסטופר הגיע ל-0.
  function handleResend() {
    if (resendIn > 0 || sending) return
    setError(''); setCode('')
    startResendTimer()
    if (channel === 'email') fireSendEmail(email.trim())
    else fireSendSms(normalizePhone(phone))
  }

  // החלפת ערוץ במסך הקוד (אחרי 40 שניות) — שולח קוד בערוץ השני.
  function switchChannel(toChannel) {
    // אם אין מייל תקין ומבקשים לעבור למייל — חוזרים לטופס להזין מייל
    if (toChannel === 'email' && !isValidEmail(email)) {
      setError('כדי לקבל קוד במייל, חזרו והזינו כתובת מייל')
      return
    }
    if (toChannel === 'sms' && !isValidILPhone(normalizePhone(phone))) {
      setError('כדי לקבל קוד ב-SMS, חזרו והזינו מספר טלפון')
      return
    }
    setError(''); setCode('')
    setChannel(toChannel)
    startResendTimer()
    startElapsed()
    if (toChannel === 'email') fireSendEmail(email.trim())
    else fireSendSms(normalizePhone(phone))
  }

  // ולידציות לוי הירוק
  const vName  = name.trim().length > 0
  const vLast  = lastName.trim().length > 0
  const vYear  = isValidBirthYear(birthYear)
  const vCity  = city.trim().length > 0
  const vEmail = isValidEmail(email)
  const vPhone = isValidILPhone(normalizePhone(phone))

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
          {step === 'otp' ? 'אימות קוד' : mode === 'register' ? 'ברוכים הבאים' : 'שמחים לראותך'}
        </div>
        <div style={{ fontSize: 15, color: colors.ink2, marginTop: 6 }}>
          {step === 'otp'
            ? (channel === 'email' ? 'הזינו את הקוד ששלחנו למייל' : 'הזינו את הקוד ששלחנו ב-SMS')
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
              <FormField label="שם פרטי" valid={vName}>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="מרים" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
              </FormField>
              <FormField label="שם משפחה" valid={vLast}>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="כהן" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
              </FormField>
              <FormField label="מגדר" valid={!!gender}>
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
              <FormField label="שנת לידה" valid={vYear}>
                <input value={birthYear} onChange={e => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1955" inputMode="numeric" dir="ltr" maxLength={4}
                  style={{ ...underlineInput, textAlign: 'left', letterSpacing: '0.1em' }}/>
              </FormField>
              <FormField label="עיר" valid={vCity}>
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="תל אביב" dir="rtl" style={{ ...underlineInput, textAlign: 'right' }}/>
              </FormField>
              <FormField label="כתובת מייל (לא חובה)" valid={email.trim() ? vEmail : false}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="miriam@gmail.com" dir="ltr" style={{ ...underlineInput, textAlign: 'left' }}/>
              </FormField>
            </>
          )}
          {mode === 'login' && (
            <FormField label="כתובת מייל (לכניסה במייל)" valid={vEmail}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="miriam@gmail.com" dir="ltr" style={{ ...underlineInput, textAlign: 'left' }}/>
            </FormField>
          )}

          <FormField label="מספר טלפון" valid={vPhone}>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="050-1234567" dir="ltr" style={{ ...underlineInput, textAlign: 'left' }}/>
          </FormField>

          {error && <ErrorBox>{error}</ErrorBox>}

          {/* כפתורי שליחת קוד — SMS / מייל */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
            <ChannelButton onClick={() => handleSendCode('sms')} accent={colors.burgundy}>
              📱 שליחת קוד ב-SMS
            </ChannelButton>
            <ChannelButton onClick={() => handleSendCode('email')} accent={colors.teal} outline>
              ✉️ שליחת קוד במייל
            </ChannelButton>
          </div>
        </div>
      )}

      {/* ── שלב הקוד ── */}
      {step === 'otp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 15, color: colors.ink2, textAlign: 'center', marginBottom: 0 }}>
            {channel === 'email'
              ? <>שולחים קוד לכתובת <span style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>{email.trim()}</span></>
              : <>שולחים קוד למספר <span style={{ direction: 'ltr', unicodeBidi: 'embed', fontWeight: 700 }}>{normalizePhone(phone)}</span></>}
          </div>
          <div style={{ fontSize: 13.5, color: colors.ink3, textAlign: 'center', marginTop: -6, marginBottom: 2 }}>
            {sending
              ? (channel === 'email' ? 'שולח את הקוד למייל…' : 'שולח את הקוד… ה-SMS עשוי להגיע תוך עד דקה')
              : (channel === 'email' ? 'בדקו גם בתיבת הספאם אם לא הגיע' : 'אם לא הגיע — אפשר לשלוח קוד נוסף בעוד רגע')}
          </div>

          <FormField label="קוד אימות" valid={code.trim().length === 6}>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="הזינו קוד" inputMode="numeric" dir="ltr" maxLength={6}
              style={{ ...underlineInput, textAlign: 'center', letterSpacing: '0.4em', fontSize: 24 }}/>
          </FormField>

          {error && <ErrorBox>{error}</ErrorBox>}

          <PrimaryButton loading={loading} onClick={handleVerify}>
            {loading ? 'מאמת...' : 'אישור והמשך →'}
          </PrimaryButton>

          <div style={{ textAlign: 'center', display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            <button onClick={handleResend} disabled={resendIn > 0 || sending}
              style={{
                color: (resendIn > 0 || sending) ? colors.ink3 : colors.burgundy,
                fontWeight: 700, fontSize: 14, background: 'none', border: 'none',
                cursor: (resendIn > 0 || sending) ? 'default' : 'pointer',
                minHeight: 'unset', opacity: (resendIn > 0 || sending) ? 0.65 : 1,
              }}>
              {resendIn > 0 ? `שליחת קוד נוסף (${resendIn})` : 'שליחת קוד נוסף'}
            </button>
            <button onClick={backToForm}
              style={{ color: colors.ink3, fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minHeight: 'unset' }}>
              {channel === 'email' ? 'החלפת מייל' : 'החלפת מספר'}
            </button>
          </div>

          {/* החלפת ערוץ — נפתח אחרי 40 שניות */}
          {elapsed >= SWITCH_SECONDS && (
            <div style={{
              marginTop: 8, padding: '14px 16px', borderRadius: 14,
              background: colors.surface2, textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: colors.ink2, fontWeight: 600, marginBottom: 10 }}>
                לא הגיע הקוד? נסו לקבל אותו בדרך אחרת:
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {channel !== 'sms' && (
                  <button onClick={() => switchChannel('sms')} style={switchBtnStyle}>📱 שלח ב-SMS</button>
                )}
                {channel !== 'email' && (
                  <button onClick={() => switchChannel('email')} style={switchBtnStyle}>✉️ שלח במייל</button>
                )}
              </div>
            </div>
          )}
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

const switchBtnStyle = {
  padding: '10px 18px', fontSize: 15, fontWeight: 700, borderRadius: 999,
  border: `1.5px solid ${colors.lineStrong}`, background: colors.surface,
  color: colors.ink, fontFamily: 'inherit', cursor: 'pointer', minHeight: 'unset',
}

// שדה טופס עם תווית + וי ירוק כשהערך תקין
function FormField({ label, children, valid }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'right', color: colors.ink2 }}>{label}</span>
        {valid && <CheckMark />}
      </div>
      {children}
    </div>
  )
}

// וי ירוק קטן
function CheckMark() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: '50%', background: colors.success || '#4F6B4A',
      flexShrink: 0,
    }} aria-label="תקין">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
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

// כפתור ערוץ שליחה (SMS / מייל)
function ChannelButton({ onClick, children, accent, outline }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '15px 0', textAlign: 'center',
      border: outline ? `2px solid ${accent}` : 'none',
      borderRadius: 16, background: outline ? 'transparent' : accent,
      color: outline ? accent : 'white',
      fontSize: 17, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
      boxShadow: outline ? 'none' : `0 8px 18px -6px ${accent}73`,
      minHeight: 'unset',
    }}>{children}</button>
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
