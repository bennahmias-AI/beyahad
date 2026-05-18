import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth.js'
import { useUserStore } from './stores/userStore.js'
import { useSessionStore } from './stores/sessionStore.js'
import AuthPage from './pages/AuthPage.jsx'
import KafePage from './pages/KafePage.jsx'
import HomePlaceholder from './pages/HomePlaceholder.jsx'
import { colors } from './design-system/index.js'

export default function App() {
  useAuth()

  const { authLoading, authUser, profile } = useUserStore()
  const { livekitToken } = useSessionStore()
  const [page, setPage] = useState('home')

  useEffect(() => {
    if (livekitToken) setPage('kafe')
  }, [livekitToken])

  if (authLoading) {
    return (
      <div className="app-shell" style={{
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 52 }}>🤝</div>
        <div style={{ fontFamily: "'Suez One', serif", fontSize: 28, color: colors.burgundy }}>ביחד</div>
        <div style={{ fontSize: 16, color: colors.ink2 }}>טוענת...</div>
      </div>
    )
  }

  // Only require auth — not profile name
  if (!authUser) {
    return (
      <div className="app-shell">
        <AuthPage />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {page === 'kafe' && <KafePage onEnd={() => setPage('home')} />}
      {page !== 'kafe' && (
        <HomePlaceholder
          user={profile || { name: 'אורח' }}
          onGoKafe={() => setPage('kafe')}
        />
      )}
    </div>
  )
}
