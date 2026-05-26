// src/components/AddFriendButton.jsx
// ─────────────────────────────────────────────────────────────
// כפתור "צרף לחבר" — לשימוש בקפה ובפרלמנט.
//
// מציג מצב לפי הקשר החברות הקיים:
//   none      → "➕ צרף לחבר"   (לחיצה שולחת בקשה)
//   pending   → "נשלחה בקשה"    (מנוטרל)
//   accepted  → "✓ חברים"       (מנוטרל)
//
// props:
//   me      = { uid, name }   — המשתמש הנוכחי
//   target  = { uid, name }   — מי שרוצים לצרף
//   compact = true            — גרסה קטנה (לפרלמנט, ליד כל משתתף)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { sendFriendRequest, getFriendshipStatus } from '../services/firebase.js'

export default function AddFriendButton({ me, target, compact = false }) {
  const [status, setStatus] = useState('loading')  // loading|none|pending|accepted
  const [busy, setBusy] = useState(false)

  // check current friendship status once
  useEffect(() => {
    let alive = true
    if (!me?.uid || !target?.uid || me.uid === target.uid) {
      setStatus('self')
      return
    }
    getFriendshipStatus(me.uid, target.uid).then(s => {
      if (alive) setStatus(s)
    })
    return () => { alive = false }
  }, [me?.uid, target?.uid])

  const handleAdd = async () => {
    if (busy || status !== 'none') return
    setBusy(true)
    try {
      await sendFriendRequest(me, target)
      setStatus('pending')
    } catch (e) {
      console.error('sendFriendRequest error:', e)
    }
    setBusy(false)
  }

  // don't render for self or while loading
  if (status === 'self' || status === 'loading') return null

  const label =
    status === 'accepted' ? '✓ חברים' :
    status === 'pending'  ? 'נשלחה בקשה' :
    '➕ צרף לחבר'

  const disabled = status !== 'none' || busy

  if (compact) {
    return (
      <button
        onClick={handleAdd}
        disabled={disabled}
        style={{
          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          padding: '6px 12px', borderRadius: 999,
          border: 'none', whiteSpace: 'nowrap',
          background: status === 'accepted' ? 'rgba(74,222,128,.22)'
                    : status === 'pending'  ? 'rgba(255,255,255,.15)'
                    : 'rgba(255,255,255,.22)',
          color: '#FBF7EE',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={disabled}
      className="big-btn"
      style={{
        width: '100%',
        background: status === 'accepted' ? 'rgba(74,222,128,.18)'
                  : status === 'pending'  ? 'var(--surface-2)'
                  : 'var(--surface)',
        color: 'var(--ink)',
        border: '1px solid var(--line-strong)',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  )
}
