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
import RecipesPage from './pages/RecipesPage.jsx'
import RadioPage from './pages/RadioPage.jsx'
import RadioPlayer from './components/RadioPlayer.jsx'
import GreetingMaker from './pages/GreetingMaker.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import FriendsPage from './pages/FriendsPage.jsx'
import DirectChatPage from './pages/DirectChatPage.jsx'
import GamesArenaPage from './pages/GamesArenaPage.jsx'
import MemoryGame from './pages/MemoryGame.jsx'
import Connect4Game from './pages/Connect4Game.jsx'
import CheckersGame from './pages/CheckersGame.jsx'
import ChessGame from './pages/ChessGame.jsx'
import SheshBeshGame from './pages/SheshBeshGame.jsx'
import MillionaireGame from './pages/MillionaireGame.jsx'
import RummikubGame from './pages/RummikubGame.jsx'
import ArenaGame from './pages/ArenaGame.jsx'
import BingoGame from './pages/BingoGame.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import GameInviteListener from './components/GameInviteListener.jsx'
import VideoCallListener from './components/VideoCallListener.jsx'
import VideoCallScreen from './pages/VideoCallScreen.jsx'
import OutgoingCallScreen from './pages/OutgoingCallScreen.jsx'
import AppLogo from './components/AppLogo.jsx'
import {
  joinParliamentSession, fetchLiveKitToken, setPresence,
  PARLIAMENT_ROOM, SINGING_ROOM, startVideoCall, isUserOnline, getUser,
} from './services/firebase.js'
import { colors } from './design-system/index.js'
import { applyAccessibilityFromStorage } from './utils/accessibility.js'

export default function App() {
  useAuth()
  const { authLoading, authUser, profile } = useUserStore()
  const {
    livekitToken, parliamentToken, singingToken,
    setParliamentSession, setParliamentLivekit,
    setSingingLivekit,
  } = useSessionStore()
  const [page, setPage] = useState(() =>
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('admin')) ? 'admin' : 'hub'
  )
  const [loadingParliament, setLoadingParliament] = useState(false)
  const [loadingSinging, setLoadingSinging] = useState(false)
  // כשמקבלים הזמנת משחק ומאשרים — שומרים את מזהה החדר כדי להיכנס ישר אליו
  const [connect4Room, setConnect4Room] = useState(null)
  const [checkersRoom, setCheckersRoom] = useState(null)
  const [chessRoom, setChessRoom] = useState(null)
  const [sheshbeshRoom, setSheshbeshRoom] = useState(null)
  const [rummikubRoom, setRummikubRoom] = useState(null)
  const [arenaRoom, setArenaRoom] = useState(null)
  const [bingoRoom, setBingoRoom] = useState(null)
  // מצב משחק לכניסה ישירה ממסך הבית (חבר/רשת/מחשב/לבד) — null = מסך בחירת מצב רגיל
  const [gameMode, setGameMode] = useState(null)
  // החבר שאיתו פתוחה שיחת צ'אט פרטית
  const [chatFriend, setChatFriend] = useState(null)
  // החבר שאיתו רוצים לשחק — נכנסים לזירה במצב "הזמנת חבר", והבחירה שולחת הזמנה
  const [playFriend, setPlayFriend] = useState(null)
  // שיחת וידאו — מצב השיחה הפעילה (יוצאת / נכנסת / מחוברת)
  const [outgoingCall, setOutgoingCall] = useState(null)   // { call, otherName, otherPhoto, otherUid } — מצלצל
  const [activeCall, setActiveCall] = useState(null)       // { call, otherUid, otherName, otherPhoto, startWithCam } — בשיחה
  const [callError, setCallError] = useState('')
  // פוסט ספציפי לפתוח בדף עצות/מתכונים (מהתראת לייק)
  const [initialPostId, setInitialPostId] = useState(null)

  // ── גובה ה-app-shell לפי המקלדת (כמו וואטסאפ) ──
  // כשהמקלדת נפתחת, ה-visualViewport מתכווץ; מתאמים את גובה ה-shell
  // לגובה הנראה כדי שכל התוכן (כולל שורת הכתיבה) ישב צמוד מעל המקלדת.
  const [shellHeight, setShellHeight] = useState(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      // אם המקלדת מכסה חלק מהמסך — משתמשים בגובה הנראה בלבד
      const covered = window.innerHeight - vv.height
      setShellHeight(covered > 80 ? Math.round(vv.height) : null)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  // ── נגישות — מחילים את העדפות המשתמש (גודל טקסט/ניגודיות/אנימציות) בעליית האפליקציה ──
  useEffect(() => {
    applyAccessibilityFromStorage()
  }, [])

  // חזרה למסך הבית — מנקה כל מצב חדר/חבר וחוזר ל-hub.
  // משמש את כפתור הבית שליד כפתור החזרה בכל המסכים.
  function goHome() {
    setConnect4Room(null); setCheckersRoom(null); setChessRoom(null)
    setSheshbeshRoom(null); setRummikubRoom(null); setArenaRoom(null); setBingoRoom(null)
    setGameMode(null)
    setChatFriend(null); setPlayFriend(null); setInitialPostId(null)
    setPage('hub')
  }

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
    } else if (gameType === 'chess') {
      setChessRoom(roomId)
      setPage('chess-game')
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

  // כניסה ישירה למשחק במצב ספציפי (ממסך הבית — "קורה ממש עכשיו")
  // gameType: bingo|sheshbesh|checkers|chess|rummikub|connect4
  // mode: 'online-friend' | 'online-random' | 'ai' | 'solo'
  function handlePlayGame(gameType, mode) {
    setConnect4Room(null); setCheckersRoom(null); setChessRoom(null)
    setSheshbeshRoom(null); setRummikubRoom(null); setArenaRoom(null); setBingoRoom(null)
    setPlayFriend(null)
    setGameMode(mode)
    setPage(`${gameType}-game`)
  }

  // ── שיחות וידאו / קול ──
  // המשתמש לחץ על כפתור הוידאו/הטלפון — מתחילים שיחה (אם החבר מחובר)
  // audioOnly=true → שיחה קולית בלבד (כמו טלפון)
  async function handleVideoCall(friend, audioOnly = false) {
    if (!authUser?.uid || !friend?.otherUid) return
    setCallError('')
    // בודקים שהחבר מחובר — אחרת אין טעם לצלצל
    const online = await isUserOnline(friend.otherUid)
    if (!online) {
      setCallError(`${friend.otherName} לא מחובר/ת כרגע — אפשר לשלוח הודעה במקום`)
      setTimeout(() => setCallError(''), 4000)
      return
    }
    try {
      // שולפים את תמונת הפרופיל של החבר (להצגה במסך השיחה)
      let otherPhoto = null
      try {
        const u = await getUser(friend.otherUid)
        otherPhoto = u?.photoURL || null
      } catch {}
      const from = { uid: authUser.uid, name: profile?.name || 'משתמש', photoURL: profile?.photoURL || '' }
      const to = { uid: friend.otherUid, name: friend.otherName }
      const { callId, room } = await startVideoCall({ from, to, audioOnly })
      setOutgoingCall({
        call: { id: callId, room, audioOnly },
        otherUid: friend.otherUid,
        otherName: friend.otherName,
        otherPhoto,
        audioOnly,
      })
    } catch (e) {
      console.error('startVideoCall error:', e)
      setCallError('לא הצלחנו להתחיל את השיחה — נסו שוב')
      setTimeout(() => setCallError(''), 4000)
    }
  }

  // המתקשר — החבר ענה, עוברים למסך השיחה
  function handleOutgoingConnected() {
    if (!outgoingCall) return
    setActiveCall({
      call: outgoingCall.call,
      otherUid: outgoingCall.otherUid,
      otherName: outgoingCall.otherName,
      otherPhoto: outgoingCall.otherPhoto,
      startWithCam: !outgoingCall.audioOnly,
      audioOnly: Boolean(outgoingCall.audioOnly),
    })
    setOutgoingCall(null)
  }

  // המקבל — ענה לשיחה נכנסת (מ-VideoCallListener), נכנסים למסך השיחה
  function handleIncomingAccept({ call, otherUid, otherName, otherPhoto }) {
    const audioOnly = Boolean(call?.audioOnly)
    setActiveCall({ call, otherUid, otherName, otherPhoto, startWithCam: !audioOnly, audioOnly })
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
        <AppLogo size={88} />
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
    <div className="app-shell" style={shellHeight ? { height: shellHeight } : undefined}>
      {page === 'kafe' && <KafePage onEnd={() => setPage('hub')} />}
      {page === 'parliament' && <ParliamentScreen onExit={() => setPage('hub')} />}
      {page === 'singing' && <SingingScreen onExit={() => setPage('hub')} />}
      {page === 'tips' && <CommunityPage onBack={() => { setInitialPostId(null); setPage('hub') }} onHome={goHome} kind="tip" initialPostId={initialPostId} />}
      {page === 'recipes' && <RecipesPage onBack={() => { setInitialPostId(null); setPage('hub') }} onHome={goHome} initialPostId={initialPostId} />}
      {page === 'radio' && <RadioPage onBack={() => setPage('hub')} onHome={goHome} />}
      {page === 'greeting' && <GreetingMaker onBack={() => setPage('hub')} onHome={goHome} />}
      {page === 'profile' && <ProfilePage onBack={() => setPage('hub')} onHome={goHome} />}
      {page === 'settings' && <SettingsPage onBack={() => setPage('hub')} onHome={goHome} />}
      {page === 'friends' && (
        <FriendsPage
          onBack={() => setPage('hub')}
          onHome={goHome}
          onMessageFriend={(f) => { setChatFriend(f); setPage('chat') }}
        />
      )}
      {page === 'chat' && (
        <DirectChatPage
          friend={chatFriend}
          onBack={() => { setChatFriend(null); setPage('friends') }}
          onHome={goHome}
          onVideoCall={(f) => handleVideoCall(f, false)}
          onCallFriend={(f) => handleVideoCall(f, true)}
          onPlayFriend={(f) => { setPlayFriend(f); setPage('games') }}
        />
      )}
      {page === 'games' && (
        <GamesArenaPage
          onBack={() => { setPlayFriend(null); setPage('hub') }}
          onHome={goHome}
          inviteFriend={playFriend}
          onGoMemory={() => setPage('memory-game')}
          onGoConnect4={() => { setConnect4Room(null); setGameMode(null); setPage('connect4-game') }}
          onGoCheckers={() => { setCheckersRoom(null); setGameMode(null); setPage('checkers-game') }}
          onGoChess={() => { setChessRoom(null); setGameMode(null); setPage('chess-game') }}
          onGoSheshbesh={() => { setSheshbeshRoom(null); setGameMode(null); setPage('sheshbesh-game') }}
          onGoTrivia={() => setPage('millionaire-game')}
          onGoRummikub={() => { setRummikubRoom(null); setGameMode(null); setPage('rummikub-game') }}
          onGoArena={() => { setArenaRoom(null); setPage('arena-game') }}
          onGoBingo={() => { setBingoRoom(null); setGameMode(null); setPage('bingo-game') }}
        />
      )}
      {page === 'memory-game' && <MemoryGame onBack={() => setPage('games')} onHome={goHome} />}
      {page === 'millionaire-game' && (
        <MillionaireGame
          onBack={() => setPage('games')}
          onHome={goHome}
          uid={authUser?.uid}
          userName={profile?.name || 'משתמש'}
        />
      )}
      {page === 'rummikub-game' && (
        <RummikubGame
          initialRoomId={rummikubRoom}
          autoInviteFriend={playFriend}
          initialMode={gameMode}
          onBack={() => { setRummikubRoom(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
        />
      )}
      {page === 'arena-game' && (
        <ArenaGame
          initialRoomId={arenaRoom}
          autoInviteFriend={playFriend}
          onBack={() => { setArenaRoom(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
        />
      )}
      {page === 'bingo-game' && (
        <BingoGame
          initialRoomId={bingoRoom}
          autoInviteFriend={playFriend}
          initialMode={gameMode}
          onBack={() => { setBingoRoom(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
        />
      )}
      {page === 'connect4-game' && (
        <Connect4Game
          initialRoomId={connect4Room}
          autoInviteFriend={playFriend}
          initialMode={gameMode}
          onBack={() => { setConnect4Room(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
        />
      )}
      {page === 'checkers-game' && (
        <CheckersGame
          initialRoomId={checkersRoom}
          autoInviteFriend={playFriend}
          initialMode={gameMode}
          onBack={() => { setCheckersRoom(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
        />
      )}
      {page === 'chess-game' && (
        <ChessGame
          initialRoomId={chessRoom}
          autoInviteFriend={playFriend}
          initialMode={gameMode}
          onBack={() => { setChessRoom(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
        />
      )}
      {page === 'sheshbesh-game' && (
        <SheshBeshGame
          initialRoomId={sheshbeshRoom}
          autoInviteFriend={playFriend}
          initialMode={gameMode}
          onBack={() => { setSheshbeshRoom(null); setPlayFriend(null); setPage('games') }}
          onHome={goHome}
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
          onGoRecipe={(postId) => { setInitialPostId(postId); setPage('recipes') }}
          onGoRadio={() => setPage('radio')}
          onGoGreeting={() => setPage('greeting')}
          onGoProfile={() => setPage('profile')}
          onGoSettings={() => setPage('settings')}
          onGoFriends={() => setPage('friends')}
          onGoGames={() => setPage('games')}
          onPlayGame={handlePlayGame}
          onOpenNotification={handleOpenNotification}
        />
      )}
      {page === 'admin' && (
        <AdminDashboard onExit={() => {
          try { window.history.replaceState(null, '', window.location.pathname) } catch {}
          setPage('hub')
        }} />
      )}
      <InstallPrompt />
      <GameInviteListener onAccept={handleInviteAccept} />
      <VideoCallListener onAccept={handleIncomingAccept} />

      {/* הודעת שגיאה לשיחת וידאו (למשל החבר לא מחובר) */}
      {callError && (
        <div style={{
          position: 'fixed', insetInline: 0, bottom: 24, zIndex: 5000,
          display: 'flex', justifyContent: 'center', padding: '0 20px', direction: 'rtl',
        }}>
          <div style={{
            background: 'var(--ink)', color: '#fff', borderRadius: 14,
            padding: '14px 20px', fontSize: 15, fontWeight: 700,
            boxShadow: '0 6px 20px rgba(0,0,0,.3)', maxWidth: 360, textAlign: 'center',
          }}>{callError}</div>
        </div>
      )}

      {/* מסך "מצלצל..." — למתקשר */}
      {outgoingCall && (
        <OutgoingCallScreen
          call={outgoingCall.call}
          otherName={outgoingCall.otherName}
          otherPhoto={outgoingCall.otherPhoto}
          audioOnly={outgoingCall.audioOnly}
          onConnected={handleOutgoingConnected}
          onEnded={() => setOutgoingCall(null)}
        />
      )}

      {/* מסך השיחה עצמה — לשני הצדדים */}
      {activeCall && (
        <VideoCallScreen
          call={activeCall.call}
          myUid={authUser?.uid}
          myName={profile?.name || 'משתמש'}
          otherUid={activeCall.otherUid}
          otherName={activeCall.otherName}
          otherPhoto={activeCall.otherPhoto}
          startWithCam={activeCall.startWithCam}
          audioOnly={activeCall.audioOnly}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {/* נגן הרדיו הצף הגלובלי — ממשיך לנגן בכל המסכים */}
      <RadioPlayer />
    </div>
  )
}
