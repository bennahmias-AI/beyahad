// src/pages/KafeWaitingPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך "מחפש חבר לשיחה..." - matchmaking לקפה בסלון.
// המשתמש מצטרף לתור. כשנמצא match - עוברים אוטומטית לוידאו.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { useUserStore } from '../stores/userStore.js'
import { useSessionStore } from '../stores/sessionStore.js'
import {
  joinCafeQueue, leaveCafeQueue, watchCafeQueueEntry,
  fetchLiveKitToken, setPresence, createCafeSession,
} from '../services/firebase.js'
import { colors } from '../design-system/index.js'

export default function KafeWaitingPage({ onCancel, onGoKafe }) {
  const { profile, authUser } = useUserStore()
  const { setCafePartner, setLivekit, setCafeSession } = useSessionStore()
  const [status, setStatus] = useState('joining')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const watcherRef = useRef(null)
  const startedRef = useRef(false)
  const connectingRef = useRef(false)

  // Connect to the matched room
  async function connectToRoom(room, partner) {
    if (connectingRef.current) return
    connectingRef.current = true

    try {
      const uid = authUser.uid
      const myName = profile?.name || 'משתמש'

      await setPresence(uid, 'busy')
      const sessionId = await createCafeSession(uid, partner.id, room)
      const token = await fetchLiveKitToken(room, myName)

      setCafePartner(partner)
      setCafeSession({ id: sessionId })
      setLivekit({ token, room })
      // App.jsx will auto-navigate when livekitToken is set

      // Clean up queue entry
      await leaveCafeQueue(uid).catch(() => {})

      setStatus('matched')
    } catch (e) {
      console.error('connectToRoom error:', e)
      setError('לא הצלחנו לחבר — נסי שוב')
      setStatus('error')
    }
  }

  // Join queue on mount
  useEffect(() => {
    if (!authUser?.uid || startedRef.current) return
    startedRef.current = true

    const join = async () => {
      try {
        const uid = authUser.uid
        const name = profile?.name || 'משתמש'

        const result = await joinCafeQueue(uid, name)

        if (result.matched) {
          await connectToRoom(result.room, result.partner)
        } else {
          setStatus('waiting')
          watcherRef.current = watchCafeQueueEntry(uid, async (entry) => {
            if (entry?.status === 'matched' && entry?.livekitRoom) {
              const partner = {
                id: entry.matchedWith,
                name: entry.matchedWithName,
              }
              await connectToRoom(entry.livekitRoom, partner)
            }
          })
        }
      } catch (e) {
        console.error('joinCafeQueue error:', e)
        setError('לא הצלחנו להתחבר. נסי שוב.')
        setStatus('error')
      }
    }

    join()

    return () => {
      if (watcherRef.current) {
        watcherRef.current()
        watcherRef.current = null
      }
    }
    // eslint-disable-next-line
  }, [authUser?.uid])

  // Elapsed time counter
  useEffect(() => {
    if (status !== 'waiting') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [status])

  async function handleCancel() {
    if (watcherRef.current) {
      watcherRef.current()
      watcherRef.current = null
    }
    if (authUser?.uid) {
      await leaveCafeQueue(authUser.uid).catch(() => {})
    }
    onCancel?.()
  }

  const formatTime = s => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'linear-gradient(180deg, #1A2547 0%, #2B2A45 100%)',
      color: 'white',
      display: 'flex', flexDirection: 'column',
      padding: '32px 24px 28px',
      direction: 'rtl', zIndex: 1000,
    }}>
      {/* Cancel button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={handleCancel} style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(255,255,255,.12)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, border: 'none', cursor: 'pointer',
        }}>←</button>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
      }}>
        {/* Animated pulse */}
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,.15)',
            animation: 'livePulse 1.5s ease-out infinite',
          }}/>
          <div style={{
            position: 'absolute', inset: 20, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,.10)',
            animation: 'livePulse 1.5s ease-out 0.5s infinite',
          }}/>
          <div style={{
            position: 'absolute', inset: 40, borderRadius: '50%',
            background: colors.burgundy,
            border: `4px solid ${colors.gold}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 56,
          }}>☕</div>
        </div>

        {/* Status text */}
        <div style={{ textAlign: 'center' }}>
          {status === 'joining' && (
            <>
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: "'Suez One', serif",
              }}>
                מתחבר לתור...
              </div>
              <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>
                רגע אחד
              </div>
            </>
          )}

          {status === 'waiting' && (
            <>
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: "'Suez One', serif",
              }}>
                מחפש לך חבר לשיחה
              </div>
              <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>
                ⏱ {formatTime(elapsed)}
              </div>
            </>
          )}

          {status === 'matched' && (
            <>
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: "'Suez One', serif",
                color: '#4ADE80',
              }}>
                ✓ מצאנו לך חבר!
              </div>
              <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>
                מתחבר לוידאו...
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{
                fontSize: 24, fontWeight: 800,
                color: colors.gold,
              }}>
                😕 {error}
              </div>
            </>
          )}
        </div>

        {/* Info box */}
        {status === 'waiting' && (
          <div style={{
            background: 'rgba(255,255,255,.10)',
            borderRadius: 16, padding: '14px 18px',
            fontSize: 15, fontWeight: 500, textAlign: 'center', lineHeight: 1.5,
            maxWidth: 320,
          }}>
            💡 כשעוד מישהו ילחץ על "קפה בסלון"<br/>
            תתחבר אליו אוטומטית
          </div>
        )}
      </div>

      {/* Cancel button */}
      <button
        onClick={handleCancel}
        className="big-btn big-btn--danger"
        style={{ width: '100%' }}
      >
        ✕ ביטול
      </button>
    </div>
  )
}
