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
import CommunityPage from './pages/CommunityPage.jsx'
import GreetingMaker from './pages/GreetingMaker.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import FriendsPage from './pages/FriendsPage.jsx'
import DirectChatPage from './pages/DirectChatPage.jsx'
import GamesArenaPage from './pages/GamesArenaPage.jsx'
import MemoryGame from './pages/MemoryGame.jsx'
import Connect4Game from './pages/Connect4Game.jsx'
import CheckersGame from './pages/CheckersGame.jsx'
import SheshBeshGame from './pages/SheshBeshGame.jsx'
import MillionaireGame from './pages/MillionaireGame.jsx'
import RummikubGame from './pages/RummikubGame.jsx'
import ArenaGame from './pages/ArenaGame.jsx'
import BingoGame from './pages/BingoGame.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import GameInviteListener from './components/GameInviteListener.jsx'
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
  // כשמקבלים הזמנת משחק ומאשרים — שומרים את מזהה החדר כדי להיכנס ישר אליו
  const [connect4Room, setConnect4Room] = useState(null)
  const [checkersRoom, setCheckersRoom] = useState(null)
  const [sheshbeshRoom, setSheshbeshRoom] = useState(null)
  const [rummikubRoom, setRummikubRoom] = useState(null)
  const [arenaRoom, setArenaRoom] = useState(null)
  const [bingoRoom, setBingoRoom] = useState(null)
  // החבר שאיתו פתוחה שיחת צ'אט פרטית
  const [chatFriend, setChatFriend] = useState(null)
  // החבר שאיתו רוצים לשחק — נכנסים לזירה במצב "הזמנת חבר", והבחירה שולחת הזמנה
  const [playFriend, setPlayFriend] = useState(null)
  // פוסט ספציפי לפתוח בדף עצות/מתכונים (מהתראת לייק)
  const [initialPostId, setInitialPostId] = useState(null)

  // ניווט מהתראה (מהפעמון במסך הבית) — לפי סוג ההתראה
  function handleOpenNotification(it) {
    if (it.type === 'chat') {
      // הודעה מחבר — פותחים ישר את שיחת הצ'אט איתו
      setChatFriend({ otherUid: it.otherUid, otherName: it.otherName })
      setPage('chat')
    } else if (it.type === 'friend') {
      // בקשת חברות — דף החברים (לאישור/דחייה)
      setPage('friends')
    } else if (it.type === 'like') {
      // לייק על תוכן שלי — פותחים את הפוסט הספציפי בדף הרלוונטי
      setInitialPostId(it.postId)
      setPage(it.kind === 'recipe' ? 'recipes' : 'tips')
    }
    // invite — המודל הקופץ של GameInviteListener מטפל; אין צורך בניווט
  }

  // משתמש אישר הזמנה למשחק — מנווטים אותו ישר לחדר
  function handleInviteAccept({ roomId, gameType }) {
    if (gameType === 'connect4') {
      setConnect4Room(roomId)
      setPage('connect4-game')
    } else if (gameType === 'checkers') {
      setCheckersRoom(roomId)
      setPage('checkers-game')
    } else if (gameType === 'sheshbesh') {
      setSheshbeshRoom(roomId)
      setPage('sheshbesh-game')
    } else if (gameType === 'rummikub') {
      setRummikubRoom(roomId)
      setPage('rummikub-game')
    } else if (gameType === 'arena') {
      setArenaRoom(roomId)
      setPage('arena-game')
    } else if (gameType === 'bingo') {
      setBingoRoom(roomId)
      setPage('bingo-game')
    }
  }

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
      const token = await fetchLiveKitToken(room, myName, uid)

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
        <InstallPrompt />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {page === 'kafe' && <KafePage onEnd={() => setPage('hub')} />}
      {page === 'parliament' && <ParliamentScreen onExit={() => setPage('hub')} />}
      {page === 'singing' && <SingingScreen onExit={() => setPage('hub')} />}
      {page === 'tips' && <CommunityPage onBack={() => { setInitialPostId(null); setPage('hub') }} kind="tip" initialPostId={initialPostId} />}
      {page === 'recipes' && <CommunityPage onBack={() => { setInitialPostId(null); setPage('hub') }} kind="recipe" initialPostId={initialPostId} />}
      {page === 'greeting' && <GreetingMaker onBack={() => setPage('hub')} />}
      {page === 'profile' && <ProfilePage onBack={() => setPage('hub')} />}
      {page === 'friends' && (
        <FriendsPage
          onBack={() => setPage('hub')}
          onCallFriend={() => setPage('waiting')}
          onPlayFriend={(f) => { setPlayFriend(f); setPage('games') }}
          onMessageFriend={(f) => { setChatFriend(f); setPage('chat') }}
        />
      )}
      {page === 'chat' && (
        <DirectChatPage
          friend={chatFriend}
          onBack={() => { setChatFriend(null); setPage('friends') }}
        />
      )}
      {page === 'games' && (
        <GamesArenaPage
          onBack={() => { setPlayFriend(null); setPage('hub') }}
          inviteFriend={playFriend}
          onGoMemory={() => setPage('memory-game')}
          onGoConnect4={() => { setConnect4Room(null); setPage('connect4-game') }}
          onGoCheckers={() => { setCheckersRoom(null); setPage('checkers-game') }}
          onGoSheshbesh={() => { setSheshbeshRoom(null); setPage('sheshbesh-game') }}
          onGoTrivia={() => setPage('millionaire-game')}
          onGoRummikub={() => { setRummikubRoom(null); setPage('rummikub-game') }}
          onGoArena={() => { setArenaRoom(null); setPage('arena-game') }}
          onGoBingo={() => { setBingoRoom(null); setPage('bingo-game') }}
        />
      )}
      {page === 'memory-game' && <MemoryGame onBack={() => setPage('games')} />}
      {page === 'millionaire-game' && (
        <MillionaireGame
          onBack={() => setPage('games')}
          uid={authUser?.uid}
          userName={profile?.name || 'משתמש'}
        />
      )}
      {page === 'rummikub-game' && (
        <RummikubGame
          initialRoomId={rummikubRoom}
          autoInviteFriend={playFriend}
          onBack={() => { setRummikubRoom(null); setPlayFriend(null); setPage('games') }}
        />
      )}
      {page === 'arena-game' && (
        <ArenaGame
          initialRoomId={arenaRoom}
          autoInviteFriend={playFriend}
          onBack={() => { setArenaRoom(null); setPlayFriend(null); setPage('games') }}
        />
      )}
      {page === 'bingo-game' && (
        <BingoGame
          initialRoomId={bingoRoom}
          autoInviteFriend={playFriend}
          onBack={() => { setBingoRoom(null); setPlayFriend(null); setPage('games') }}
        />
      )}
      {page === 'connect4-game' && (
        <Connect4Game
          initialRoomId={connect4Room}
          autoInviteFriend={playFriend}
          onBack={() => { setConnect4Room(null); setPlayFriend(null); setPage('games') }}
        />
      )}
      {page === 'checkers-game' && (
        <CheckersGame
          initialRoomId={checkersRoom}
          autoInviteFriend={playFriend}
          onBack={() => { setCheckersRoom(null); setPlayFriend(null); setPage('games') }}
        />
      )}
      {page === 'sheshbesh-game' && (
        <SheshBeshGame
          initialRoomId={sheshbeshRoom}
          autoInviteFriend={playFriend}
          onBack={() => { setSheshbeshRoom(null); setPlayFriend(null); setPage('games') }}
        />
      )}
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
          onGoTips={() => setPage('tips')}
          onGoRecipes={() => setPage('recipes')}
          onGoGreeting={() => setPage('greeting')}
          onGoProfile={() => setPage('profile')}
          onGoFriends={() => setPage('friends')}
          onGoGames={() => setPage('games')}
          onOpenNotification={handleOpenNotification}
        />
      )}
      <InstallPrompt />
      <GameInviteListener onAccept={handleInviteAccept} />
    </div>
  )
}
