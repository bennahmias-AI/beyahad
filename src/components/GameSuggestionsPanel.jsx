// src/components/GameSuggestionsPanel.jsx
// פאנל "הצעות משחק" לבורד הניהול — עצמאי לחלוטין (מאזין לבד ל-Firestore).
// משובץ גם ב-AdminDashboard (מובייל) וגם ב-AdminDashboardDesktop.
// משתמש מציע משחק דרך הכרטיס בזירת המשחקים → נשמר ל-gameSuggestions
// (רק אדמין קורא, נאכף ב-firestore.rules). כאן המנהל רואה, מסמן כטופל, ומוחק.
import { useState, useEffect } from 'react'
import { watchGameSuggestions, resolveGameSuggestion, deleteGameSuggestion } from '../services/firebase.js'

function toMs(ts) { return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0 }
function fmt(ms) { return ms ? new Date(ms).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '' }

export default function GameSuggestionsPanel() {
  const [list, setList] = useState([])
  const [busy, setBusy] = useState(null)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    const unsub = watchGameSuggestions(setList)
    return () => { unsub && unsub() }
  }, [])

  const open = list.filter(s => s.status !== 'resolved')
  const done = list.filter(s => s.status === 'resolved')

  async function resolve(s) { setBusy(s.id); try { await resolveGameSuggestion(s.id) } catch (e) { console.error('resolveGameSuggestion:', e) } setBusy(null) }
  async function remove(s) {
    if (!window.confirm('למחוק את ההצעה לצמיתות?')) return
    setBusy(s.id); try { await deleteGameSuggestion(s.id) } catch (e) { console.error('deleteGameSuggestion:', e) } setBusy(null)
  }

  const title = { fontSize: 15, fontWeight: 800, color: 'var(--ink)', margin: '20px 2px 10px', display: 'flex', alignItems: 'center', gap: 8 }

  return (
    <div>
      <div style={title}>
        💡 הצעות משחק
        {open.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#B8860B', borderRadius: 999, padding: '2px 9px' }}>{open.length}</span>
        )}
      </div>

      {open.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14, fontWeight: 600 }}>
          אין הצעות חדשות 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {open.map(s => <SuggestionRow key={s.id} s={s} busy={busy === s.id} onResolve={resolve} onDelete={remove} />)}
        </div>
      )}

      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone(v => !v)} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>
            {showDone ? '▲ הסתר שטופלו' : `▼ הצג שטופלו (${done.length})`}
          </button>
          {showDone && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {done.map(s => <SuggestionRow key={s.id} s={s} busy={busy === s.id} onDelete={remove} done />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SuggestionRow({ s, busy, onResolve, onDelete, done }) {
  const ms = toMs(s.createdAt)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid ' + (done ? 'var(--line)' : '#E7D2A8'), borderRadius: 14, padding: '12px 14px', opacity: done ? 0.72 : 1 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{s.text}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
          {s.name || 'משתמש'} · <span style={{ direction: 'ltr' }}>{fmt(ms)}</span>
        </span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!done && (
            <button onClick={() => onResolve(s)} disabled={busy} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', borderRadius: 9, padding: '7px 12px', background: '#3E6B34', color: '#fff', opacity: busy ? 0.5 : 1 }}>✓ טופל</button>
          )}
          <button onClick={() => onDelete(s)} disabled={busy} style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid #C0392B', borderRadius: 9, padding: '7px 12px', background: 'var(--surface)', color: '#C0392B', opacity: busy ? 0.5 : 1 }}>🗑️</button>
        </div>
      </div>
    </div>
  )
}
