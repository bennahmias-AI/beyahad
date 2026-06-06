// src/pages/AdminSecondFactor.jsx
// ─────────────────────────────────────────────────────────────
// אימות דו-שלבי לאדמין: גורם שני של מייל+סיסמה, אחרי כניסת טלפון+SMS.
// מוצג ע"י App כשהמשתמש המחובר הוא role==='admin' ועוד לא אימת בסשן הזה.
//
//  הגדרה (פעם ראשונה, אין עדיין מייל+סיסמה לחשבון): מגדירים מייל+סיסמה →
//    linkWithCredential מקשר אותם לחשבון → נכנסים.
//  אימות (קיים כבר מייל+סיסמה): מזינים מייל+סיסמה → reauthenticateWithCredential
//    מאמת מול אותו חשבון (בלי לשבש את ה-session) → נכנסים.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { adminHasEmailFactor, linkAdminEmail, verifyAdminEmail, signOut } from '../services/firebase.js'
import { colors } from '../design-system/index.js'
import AppLogo from '../components/AppLogo.jsx'

const ERRORS = {
  'auth/wrong-password':        'הסיסמה שגויה',
  'auth/invalid-credential':    'המייל או הסיסמה שגויים',
  'auth/user-mismatch':         'הפרטים אינם תואמים לחשבון המנהל הזה',
  'auth/invalid-email':         'כתובת מייל לא תקינה',
  'auth/email-already-in-use':  'המייל כבר בשימוש בחשבון אחר — בחרו מייל אחר',
  'auth/weak-password':         'הסיסמה חייבת להכיל לפחות 6 תווים',
  'auth/too-many-requests':     'יותר מדי ניסיונות — נסו שוב מאוחר יותר',
  'auth/requires-recent-login': 'נדרשת התחברות מחדש — התנתקו והיכנסו שוב',
}

export default function AdminSecondFactor({ onVerified }) {
  const [isSetup] = useState(() => !adminHasEmailFactor())
  const [email, setEmail] = useState('')
  const [pw, setPw]   = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    const em = email.trim()
    if (!em) { setError('נא להזין כתובת מייל'); return }
    if (!pw) { setError('נא להזין סיסמה'); return }
    if (isSetup) {
      if (pw.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return }
      if (pw !== pw2)    { setError('הסיסמאות אינן תואמות'); return }
    }
    setLoading(true)
    try {
      if (isSetup) await linkAdminEmail(em, pw)
      else         await verifyAdminEmail(em, pw)
      onVerified()
    } catch (e) {
      console.error('admin 2FA error:', e)
      setError(ERRORS[e.code] || (isSetup ? 'ההגדרה נכשלה — נסו שוב' : 'האימות נכשל — בדקו את הפרטים ונסו שוב'))
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto', direction: 'rtl',
      background: `linear-gradient(180deg, ${colors.bgPage} 0%, ${colors.bgApp} 100%)`,
      display: 'flex', flexDirection: 'column', padding: '34px 24px 40px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ width: 60, height: 60, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AppLogo size={60} />
        </div>
        <div style={{ fontSize: 25, fontFamily: "'Suez One', serif", color: colors.ink, lineHeight: 1.1 }}>
          {isSetup ? 'הגדרת כניסת מנהל' : 'אימות מנהל'}
        </div>
        <div style={{ fontSize: 15, color: colors.ink2, marginTop: 8, fontWeight: 500, lineHeight: 1.5 }}>
          {isSetup
            ? 'לחשבון מנהל נדרש גורם אימות שני. הגדירו מייל וסיסמה שישמשו לכניסה מאובטחת — בנוסף לקוד ה-SMS.'
            : 'אימות נוסף לחשבון מנהל — הזינו את המייל והסיסמה שהגדרתם.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="כתובת מייל">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="admin@email.com" dir="ltr" style={{ ...inp, textAlign: 'left' }} />
        </Field>
        <Field label="סיסמה">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="הזינו סיסמה" dir="ltr" style={{ ...inp, textAlign: 'left' }} />
        </Field>
        {isSetup && (
          <Field label="אימות סיסמה">
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="הזינו שוב את הסיסמה" dir="ltr" style={{ ...inp, textAlign: 'left' }} />
          </Field>
        )}

        {error && (
          <div style={{ background: colors.burgundySoft, color: colors.burgundyDeep, borderRadius: 12, padding: '11px 14px', fontSize: 15, fontWeight: 600, textAlign: 'right' }}>{error}</div>
        )}

        <button onClick={submit} disabled={loading} style={{
          width: '100%', marginTop: 10, padding: '16px 0', border: 'none', borderRadius: 16,
          background: colors.burgundy, color: 'white', fontSize: 18, fontWeight: 700,
          fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer',
          boxShadow: `0 8px 18px -6px ${colors.burgundy}73`, opacity: loading ? 0.7 : 1, minHeight: 'unset',
        }}>
          {loading ? '...' : (isSetup ? 'הגדרה וכניסה' : 'אימות וכניסה')}
        </button>

        <button onClick={() => signOut()} style={{
          color: colors.ink3, fontWeight: 700, fontSize: 14, background: 'none', border: 'none',
          cursor: 'pointer', marginTop: 4, minHeight: 'unset',
        }}>התנתקות</button>
      </div>
    </div>
  )
}

const inp = {
  width: '100%', boxSizing: 'border-box', padding: '12px 2px 11px',
  fontSize: 19, fontWeight: 500, border: 'none',
  borderBottom: `2px solid ${colors.lineStrong}`, background: 'transparent',
  fontFamily: 'inherit', color: colors.ink, outline: 'none',
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, textAlign: 'right', color: colors.ink2 }}>{label}</div>
      {children}
    </div>
  )
}
