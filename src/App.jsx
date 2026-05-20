import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { useUserStore } from './stores/userStore.js'
import { useSessionStore } from './stores/sessionStore.js'
import AuthPage from './pages/AuthPage.jsx'
import KafePage from './pages/KafePage.jsx'
import KafeWaitingPage from './pages/KafeWaitingPage.jsx'
import HubPage from './pages/HubPage.jsx'
import ParliamentScreen from './pages/ParliamentScreen.jsx'
import SingingScreen from './pages/SingingScreen.jsx'
import {
  joinParliamentSession, fetchLiveKitToken, setPresence,
  PARLIAMENT_ROOM, SINGING_ROOM,
} from './services/firebase.js'
import { colors } from './design-system/index.js'

export default function App() {
  useAuth()
  const { authLoading, authUser, profile } = useUserStore()
  const {
    livekitToken, parliamentToken, singingToken,
    setParliamentSession, setParliamentLivekit,
    setSingingLivekit,
  } = useSessionStore()
  const [page, setPage] = useState('hub')
  const [loadingParliament, setLoadingParliament] = useState(false)
  const [loadingSinging, setLoadingSinging] = useState(false)

  // Auto-navigate when LiveKit tokens are set
  useEffect(() => {
    if (livekitToken) setPage('kafe')
  }, [livekitToken])

  useEffect(() => {
    if (parliamentToken) setPage('parliament')
  }, [parliamentToken])

  useEffect(() => {
    if (singingToken) setPage('singing')
  }, [singingToken])

  // Join parliament
  async function joinParliament() {
    if (!authUser?.uid) return
    setLoadingParliament(true)
    try {
      const uid    = authUser.uid
      const room   = PARLIAMENT_ROOM
      const myName = profile?.name || 'משתמש'

      const sessionId = await joinParliamentSession(uid, room)
      const token = await fetchLiveKitToken(room, myName)

      setParliamentSession({ id: sessionId })
      setParliamentLivekit({ token, room })
    } catch (e) {
      console.error('joinParliament error:', e)
      alert('לא הצלחנו להתחבר לפרלמנט.')
    } finally {
      setLoadingParliament(false)
    }
  }

  // Join singing room
  async function joinSinging() {
    if (!authUser?.uid) return
    setLoadingSinging(true)
    try {
      const room   = SINGING_ROOM
      const myName = profile?.name || 'משתמש'

      const token = await fetchLiveKitToken(room, myName)
      setSingingLivekit({ token, room })
    } catch (e) {
      console.error('joinSinging error:', e)
      alert('לא הצלחנו להתחבר לחדר השירה.')
    } finally {
      setLoadingSinging(false)
    }
  }

  if (authLoading) {
    return (
      <div className="app-shell" style={{
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 52 }}>🤝</div>
        <div style={{ fontFamily: "'Assistant', sans-serif", fontWeight: 800, fontSize: 28, color: colors.burgundy }}>ביחד</div>
        <div style={{ fontSize: 16, color: colors.ink2 }}>טוענת...</div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="app-shell">
        <AuthPage />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {page === 'kafe' && <KafePage onEnd={() => setPage('hub')} />}
      {page === 'parliament' && <ParliamentScreen onExit={() => setPage('hub')} />}
      {page === 'singing' && <SingingScreen onExit={() => setPage('hub')} />}
      {page === 'waiting' && (
        <KafeWaitingPage
          onCancel={() => setPage('hub')}
          onGoKafe={() => setPage('kafe')}
        />
      )}
      {page === 'hub' && (
        <HubPage
          onGoMatch={() => setPage('waiting')}
          onGoParliament={joinParliament}
          onGoSinging={joinSinging}
        />
      )}
    </div>
  )
}
