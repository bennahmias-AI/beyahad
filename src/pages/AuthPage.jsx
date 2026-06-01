import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { auth, createOrUpdateUser } from '../services/firebase.js'
import { colors } from '../design-system/index.js'

export default function AuthPage() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [gender, setGender]     = useState('')   // 'male' | 'female'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit() {
    setError('')
    if (!email || !password) { setError('נא למלא מייל וסיסמה'); return }
    if (mode === 'register' && !name.trim()) { setError('נא להזין שם'); return }
    if (mode === 'register' && !gender) { setError('נא לבחור מגדר'); return }
    setLoading(true)
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        // Write the profile with the real name. merge:true so this never
        // gets wiped by a later skeleton write from useAuth.
        await createOrUpdateUser(cred.user.uid, {
          name: name.trim(), gender, phone: '', status: 'available', interests: [],
        })
        // Write the name a second time defensively, in case useAuth's
        // skeleton write landed in between. merge:true keeps it safe.
        await createOrUpdateUser(cred.user.uid, { name: name.trim(), gender })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (e) {
      console.error(e)
      const msgs = {
        'auth/email-already-in-use': 'המייל כבר רשום — נסה להתחבר',
        'auth/user-not-found':       'משתמש לא נמצא — נסה להירשם',
        'auth/wrong-password':       'סיסמה שגויה',
        'auth/invalid-credential':   'מייל או סיסמה שגויים',
        'auth/invalid-email':        'מייל לא תקין',
        'auth/weak-password':        'סיסמה חלשה מדי (מינימום 6 תווים)',
      }
      setError(msgs[e.code] || e.message)
    } finally {
      setLoading(false)
    }
  }

  // שדה עם קו תחתון בלבד (underline) — נקי ואוורירי, פונט גדול לנגישות
  const underlineInput = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 2px 11px',
    fontSize: 19, fontWeight: 500,
    border: 'none', borderBottom: `2px solid ${colors.lineStrong}`,
    background: 'transparent',
    fontFamily: 'inherit',
    color: colors.ink,
    outline: 'none',
  }

  const fieldLabel = {
    fontSize: 14, fontWeight: 700, marginBottom: 6,
    textAlign: 'right', color: colors.ink2,
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
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{
          width: 66, height: 66, margin: '0 auto', borderRadius: 20,
          background: colors.burgundy,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          boxShadow: `0 8px 18px -6px ${colors.burgundy}66`,
        }}>🤝</div>
        <div style={{
          marginTop: 12, fontSize: 28, lineHeight: 1,
          fontFamily: "'Suez One', serif", color: colors.ink,
        }}>
          {mode === 'register' ? 'ברוכים הבאים' : 'שמחים לראותך'}
        </div>
        <div style={{ fontSize: 15, color: colors.ink2, marginTop: 6 }}>
          {mode === 'register' ? 'פתחו חשבון חדש ב' : 'התחברו לחשבון שלכם ב'}
          <span style={{ color: colors.burgundy, fontWeight: 700 }}>ביחד</span>
        </div>
      </div>

      {/* טאבים — קו תחתון */}
      <div style={{
        display: 'flex', gap: 24, justifyContent: 'center',
        borderBottom: `1px solid ${colors.line}`, marginBottom: 22,
      }}>
        {[{ id: 'login', label: 'כניסה' }, { id: 'register', label: 'הרשמה' }].map(t => {
          const active = mode === t.id
          return (
            <button key={t.id} onClick={() => { setMode(t.id); setError('') }} style={{
              padding: '0 2px 12px', fontSize: 17, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer',
              background: 'none', border: 'none',
              color: active ? colors.burgundy : colors.ink3,
              borderBottom: active ? `3px solid ${colors.burgundy}` : '3px solid transparent',
              marginBottom: -1.5,
              minHeight: 'unset', minWidth: 'unset',
            }}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* שדות */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {mode === 'register' && (
          <div>
            <div style={fieldLabel}>שם פרטי</div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="מרים" dir="rtl"
              style={{ ...underlineInput, textAlign: 'right' }}/>
          </div>
        )}

        {mode === 'register' && (
          <div>
            <div style={fieldLabel}>מגדר</div>
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
                  }}>
                    {g.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <div style={fieldLabel}>כתובת מייל</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="miriam@gmail.com" dir="ltr"
            style={{ ...underlineInput, textAlign: 'left' }}/>
        </div>

        <div>
          <div style={fieldLabel}>סיסמה</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים" dir="ltr"
            style={{ ...underlineInput, textAlign: 'left' }}/>
        </div>

        {error && (
          <div style={{
            background: colors.burgundySoft, color: colors.burgundyDeep,
            borderRadius: 12, padding: '11px 14px',
            fontSize: 15, fontWeight: 600, textAlign: 'right',
          }}>{error}</div>
        )}

        <button onClick={handleSubmit} disabled={loading}
          style={{
            width: '100%', marginTop: 10, padding: '16px 0',
            textAlign: 'center', border: 'none', borderRadius: 16,
            background: colors.burgundy, color: 'white',
            fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
            cursor: loading ? 'default' : 'pointer',
            boxShadow: `0 8px 18px -6px ${colors.burgundy}73`,
            opacity: loading ? 0.7 : 1,
            minHeight: 'unset',
          }}>
          {loading ? 'רגע...' : mode === 'login' ? 'כניסה →' : 'הרשמה →'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: colors.ink3 }}>
        {mode === 'login' ? 'אין לך חשבון? ' : 'יש לך חשבון? '}
        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          style={{ color: colors.burgundy, fontWeight: 700, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', minHeight: 'unset', minWidth: 'unset' }}>
          {mode === 'login' ? 'הירשמי כאן' : 'כנסי כאן'}
        </button>
      </div>
    </div>
  )
}
