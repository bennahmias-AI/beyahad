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

  const inputStyle = {
    width: '100%', padding: '14px 18px',
    fontSize: 20, fontWeight: 600,
    border: `3px solid ${colors.ink}`,
    borderRadius: 14,
    background: colors.bgApp,
    fontFamily: 'inherit',
  }

  return (
    <div style={{
      height: '100%',
      background: `linear-gradient(180deg, ${colors.bgPage} 0%, ${colors.bgApp} 100%)`,
      display: 'flex', flexDirection: 'column',
      padding: '32px 24px', overflowY: 'auto',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 80, height: 80, margin: '0 auto', borderRadius: 24,
          background: colors.burgundy, border: `3px solid ${colors.ink}`,
          boxShadow: `0 6px 0 ${colors.burgundyDeep}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
        }}>🤝</div>
        <div style={{ marginTop: 10, fontSize: 28, fontFamily: "'Suez One', serif", color: colors.burgundy }}>ביחד</div>
        <div style={{ fontSize: 15, color: colors.ink2, marginTop: 4 }}>מערכת נגד בדידות</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['login','register'].map(m => (
          <button key={m} onClick={() => { setMode(m); setError('') }} style={{
            flex: 1, padding: '12px 0', fontSize: 18, fontWeight: 700,
            borderRadius: 12, border: `3px solid ${colors.ink}`,
            background: mode === m ? colors.burgundy : colors.surface,
            color: mode === m ? 'white' : colors.ink,
            boxShadow: mode === m ? `0 4px 0 ${colors.ink}` : 'none',
            minHeight: 'unset',
          }}>
            {m === 'login' ? 'כניסה' : 'הרשמה'}
          </button>
        ))}
      </div>

      <div style={{
        background: colors.surface, border: `3px solid ${colors.ink}`,
        borderRadius: 22, padding: 22, boxShadow: `0 5px 0 ${colors.ink}`,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {mode === 'register' && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, textAlign: 'right' }}>שם פרטי</div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="מרים" dir="rtl"
              style={{ ...inputStyle, textAlign: 'right' }}/>
          </div>
        )}
        {mode === 'register' && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, textAlign: 'right' }}>מגדר</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ id: 'female', label: 'נקבה' }, { id: 'male', label: 'זכר' }].map(g => (
                <button key={g.id} type="button" onClick={() => setGender(g.id)} style={{
                  flex: 1, padding: '13px 0', fontSize: 18, fontWeight: 700,
                  borderRadius: 14, border: `3px solid ${colors.ink}`,
                  background: gender === g.id ? colors.burgundy : colors.bgApp,
                  color: gender === g.id ? 'white' : colors.ink,
                  boxShadow: gender === g.id ? `0 3px 0 ${colors.burgundyDeep}` : 'none',
                  fontFamily: 'inherit', cursor: 'pointer', minHeight: 'unset',
                }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, textAlign: 'right' }}>כתובת מייל</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="miriam@gmail.com" dir="ltr"
            style={{ ...inputStyle, textAlign: 'left' }}/>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, textAlign: 'right' }}>סיסמה</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="לפחות 6 תווים" dir="ltr"
            style={{ ...inputStyle, textAlign: 'left' }}/>
        </div>
        {error && (
          <div style={{
            background: colors.burgundySoft, color: colors.burgundyDeep,
            border: `2px solid ${colors.burgundy}`,
            borderRadius: 12, padding: '10px 14px',
            fontSize: 16, fontWeight: 600, textAlign: 'right',
          }}>{error}</div>
        )}
        <button onClick={handleSubmit} disabled={loading}
          className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 4 }}>
          {loading ? 'רגע...' : mode === 'login' ? 'כניסה →' : 'הרשמה →'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: colors.ink3 }}>
        {mode === 'login' ? 'אין לך חשבון? ' : 'יש לך חשבון? '}
        <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
          style={{ color: colors.burgundy, fontWeight: 700, fontSize: 14, textDecoration: 'underline', minHeight: 'unset', minWidth: 'unset' }}>
          {mode === 'login' ? 'הירשמי כאן' : 'כנסי כאן'}
        </button>
      </div>
    </div>
  )
}
