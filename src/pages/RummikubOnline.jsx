// src/pages/RummikubOnline.jsx
// ─────────────────────────────────────────────────────────────
// רמיקוב אונליין — שחקן רנדומלי + שחק עם חברים (2-4 שחקנים).
//
// זרימה:
//   1. Lobby — חיפוש רנדומלי או בחירת חברים להזמנה.
//   2. WaitingRoom — רשימת השחקנים שהצטרפו; המארח לוחץ "התחל".
//   3. OnlineGame — מסך המשחק המסונכרן; רק מי שבתורו פועל.
//
// הסנכרון: מצב המשחק המלא נשמר כ-JSON על מסמך החדר (rummikubRooms).
// כל שינוי משודר בזמן אמת לכל המשתתפים דרך watchRummikubRoom.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import { IconBackRTL } from '../icons/index.jsx'
import { useUserStore } from '../stores/userStore.js'
import { playSound } from '../utils/gameSounds.js'
import Avatar from '../components/Avatar.jsx'
import {
  createRummikubRoom, joinRummikubRoom, startRummikubGame,
  updateRummikubState, watchRummikubRoom, leaveRummikubRoom,
  findOrCreateRummikubMatch, watchFriendships, sendGameInvite,
  watchUser,
} from '../services/firebase.js'
import {
  initGame, isBoardValid, drawTile, commitTurn, MELD_MIN,
} from '../utils/rummikubEngine.js'
import {
  RummiHeaderShared, BoardArea, PlayerRack, RummiButton,
  NewTileBanner, GOLD, GOLD_DEEP, CREAM,
} from './RummikubShared.jsx'

// ════════════════════════════════════════════════════════
// רכיב ראשי — מנהל את שלבי האונליין
// ════════════════════════════════════════════════════════
export default function RummikubOnline({ mode, initialRoomId, onBack, onExit }) {
  const { authUser, profile } = useUserStore()
  const [roomId, setRoomId] = useState(initialRoomId || null)

  useEffect(() => { if (initialRoomId) setRoomId(initialRoomId) }, [initialRoomId])

  const me = { uid: authUser?.uid, name: profile?.name || 'משתמש' }

  if (!roomId) {
    return <Lobby mode={mode} me={me} onBack={onBack} onReady={(id) => setRoomId(id)} />
  }
  return <RoomScreen roomId={roomId} me={me} onBack={() => { setRoomId(null); onBack() }} onExit={onExit} />
}

// ════════════════════════════════════════════════════════
// Lobby — חיפוש רנדומלי / רשימת חברים
// ════════════════════════════════════════════════════════
function Lobby({ mode, me, onBack, onReady }) {
  const [phase, setPhase] = useState(mode === 'online-random' ? 'searching' : 'friend-list')
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [friends, setFriends] = useState([])
  const startedRef = useRef(false)

  useEffect(() => {
    if (mode !== 'online-friend' || !me.uid) return
    const unsub = watchFriendships(me.uid, ({ friends }) => setFriends(friends))
    return () => unsub && unsub()
  }, [mode, me.uid])

  useEffect(() => {
    if (mode !== 'online-random' || startedRef.current) return
    startedRef.current = true
    ;(async () => {
      if (!me.uid) { setErrorMsg('צריך להיות מחובר'); setPhase('error'); return }
      try {
        const { roomId } = await findOrCreateRummikubMatch({ player: me })
        onReady(roomId)
      } catch (e) {
        console.error('rummikub match error:', e)
        setErrorMsg('לא הצלחנו למצוא משחק — נסו שוב')
        setPhase('error')
      }
    })()
  }, [mode]) // eslint-disable-line

  useEffect(() => {
    if (phase !== 'searching') return
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const inviteFriend = async (friend) => {
    if (!me.uid) return
    setErrorMsg('')
    try {
      const { roomId } = await createRummikubRoom({ host: me, roomType: 'private' })
      await sendGameInvite({
        from: me, to: { uid: friend.otherUid, name: friend.otherName },
        gameType: 'rummikub', roomId,
      })
      onReady(roomId)  // המארח נכנס לחדר ההמתנה
    } catch (e) {
      console.error('inviteFriend error:', e)
      setErrorMsg('לא הצלחנו לשלוח הזמנה')
      setPhase('error')
    }
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (phase === 'searching') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #2A1C10, #3A2818)', color: 'white', display: 'flex', flexDirection: 'column', padding: '32px 24px 28px', direction: 'rtl', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,.12)', color: 'white', border: 'none', fontSize: 22, cursor: 'pointer' }}>←</button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <div style={{ fontSize: 72 }}>🎴</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Suez One', serif" }}>מחפש לך יריבים...</div>
            <div style={{ fontSize: 16, opacity: 0.85, marginTop: 8 }}>⏱ {formatTime(elapsed)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.10)', borderRadius: 16, padding: '14px 18px', fontSize: 15, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>💡 כשעוד שחקנים ילחצו על "רמיקוב"<br />תתחברו לאותו שולחן</div>
        </div>
        <button onClick={onBack} className="big-btn big-btn--danger" style={{ width: '100%' }}>✕ ביטול</button>
      </div>
    )
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה"><IconBackRTL size={24} color="#1B2540" /></button>
        <div className="screen-header__title">{mode === 'online-random' ? 'שחקן רנדומלי' : 'שחק עם חברים'}</div>
      </div>
      <div style={{ padding: '20px 20px 32px' }}>
        {phase === 'friend-list' && <FriendList friends={friends} onInvite={inviteFriend} onBack={onBack} />}
        {phase === 'error' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>😕</div>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>משהו השתבש</div>
            <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 18 }}>{errorMsg || 'נסו שוב'}</div>
            <button onClick={onBack} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה</button>
          </div>
        )}
      </div>
    </div>
  )
}

function FriendList({ friends, onInvite, onBack }) {
  if (!friends || friends.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '36px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 14 }}>👥</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>אין לך עדיין חברים ברשימה</div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>הוסיפו חברים בקפה או בפרלמנט — ואז תוכלו להזמין אותם למשחק.</div>
        <button onClick={onBack} className="big-btn big-btn--ghost" style={{ width: '100%' }}>חזרה</button>
      </div>
    )
  }
  return (
    <>
      <h2 className="h-display" style={{ fontSize: 18, margin: '0 0 6px', color: 'var(--ink)' }}>הזמינו חברים לשולחן</h2>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 14 }}>אפשר להזמין עד 3 חברים. כשהם יצטרפו — תתחילו לשחק.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {friends.map(f => <FriendRow key={f.docId} friend={f} onInvite={() => onInvite(f)} />)}
      </div>
    </>
  )
}

function FriendRow({ friend, onInvite }) {
  const [online, setOnline] = useState(false)
  useEffect(() => {
    if (!friend.otherUid) return
    const unsub = watchUser(friend.otherUid, u => {
      const seen = u?.lastSeenAt
      const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
      const fresh = seenMs && (Date.now() - seenMs) < 2 * 60 * 1000
      setOnline(Boolean(fresh) && ['available', 'busy'].includes(u?.status))
    })
    return () => unsub && unsub()
  }, [friend.otherUid])
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar name={friend.otherName} size={50} online={online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="h-display" style={{ fontSize: 17, color: 'var(--ink)' }}>{friend.otherName}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: online ? 'var(--success)' : 'var(--ink-3)' }}>
          {online ? 'מחובר עכשיו' : 'לא מחובר'}
        </div>
      </div>
      <button onClick={onInvite} style={{ background: 'var(--burgundy)', color: 'white', border: 'none', borderRadius: 12, padding: '11px 16px', fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>🎮 הזמן</button>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך החדר — המתנה או משחק
// ════════════════════════════════════════════════════════
function RoomScreen({ roomId, me, onBack, onExit }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState('')
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!joinedRef.current) {
      joinedRef.current = true
      joinRummikubRoom(roomId, me).catch(() => {})
    }
    const unsub = watchRummikubRoom(roomId, (data) => {
      if (!data) { setError('המשחק נסגר'); return }
      setRoom(data)
    })
    return () => unsub && unsub()
  }, [roomId])

  if (error) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב" onBack={onExit} />
        <div style={{ padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>👋</div>
            <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>{error}</div>
            <button onClick={onExit} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 12 }}>חזרה לזירה</button>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב" onBack={onBack} />
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען...</div>
      </div>
    )
  }

  if (room.status === 'waiting') {
    return <WaitingRoom room={room} roomId={roomId} me={me} onBack={onBack} />
  }
  return <OnlineGame room={room} roomId={roomId} me={me} onBack={onBack} />
}

// ════════════════════════════════════════════════════════
// חדר המתנה — רשימת שחקנים + כפתור התחלה למארח
// ════════════════════════════════════════════════════════
function WaitingRoom({ room, roomId, me, onBack }) {
  const isHost = room.hostUid === me.uid
  const players = room.players || []
  const canStart = players.length >= 2

  const handleStart = async () => {
    const defs = players.map(p => ({ id: p.uid, name: p.name, isAI: false }))
    const state = initGame(defs)
    await startRummikubGame(roomId, state)
  }

  const handleLeave = async () => {
    if (isHost) await leaveRummikubRoom(roomId)
    onBack()
  }

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
      <RummiHeaderShared title="חדר המתנה" onBack={handleLeave} />
      <div style={{ padding: '20px 16px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎴</div>
          <div className="h-display" style={{ fontSize: 22, color: GOLD }}>
            {isHost ? 'מחכים לשחקנים' : 'הצטרפת לשולחן'}
          </div>
          {room.inviteCode && (
            <div style={{ marginTop: 10, fontSize: 14, color: CREAM }}>
              קוד הזמנה: <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: GOLD, letterSpacing: 2 }}>{room.inviteCode}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {players.map((p) => (
            <div key={p.uid} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(74,48,22,.6)', border: `1px solid ${GOLD_DEEP}`,
              borderRadius: 14, padding: '12px 16px',
            }}>
              <Avatar name={p.name} size={42} />
              <div style={{ flex: 1, fontFamily: "'Suez One', serif", fontSize: 17, color: CREAM }}>
                {p.name}{p.uid === me.uid ? ' (אתה)' : ''}
              </div>
              {p.uid === room.hostUid && <span style={{ fontSize: 12, color: GOLD, fontWeight: 800 }}>👑 מארח</span>}
            </div>
          ))}
          {Array.from({ length: (room.maxPlayers || 4) - players.length }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(74,48,22,.25)', border: '1px dashed rgba(201,162,74,.4)',
              borderRadius: 14, padding: '12px 16px', color: 'rgba(243,226,190,.5)',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</div>
              <div style={{ fontSize: 15 }}>ממתין לשחקן…</div>
            </div>
          ))}
        </div>

        {isHost ? (
          <>
            <RummiButton gold label={canStart ? `✓ התחל משחק (${players.length})` : 'צריך לפחות 2 שחקנים'} onClick={canStart ? handleStart : () => {}} />
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 13, color: CREAM, textAlign: 'center', opacity: .8 }}>
              אפשר להתחיל מ-2 שחקנים, או לחכות לעוד (עד 4)
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 15, padding: '12px' }}>
            ⏳ מחכים שהמארח יתחיל את המשחק…
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// מסך המשחק המסונכרן
// ════════════════════════════════════════════════════════
function OnlineGame({ room, roomId, me, onBack }) {
  const state = room.gameStateJson ? JSON.parse(room.gameStateJson) : null
  const [draftBoard, setDraftBoard] = useState([])
  const [draftRack, setDraftRack] = useState([])
  const [selectedTileId, setSelectedTileId] = useState(null)
  const [message, setMessage] = useState('')
  const [lastDrawn, setLastDrawn] = useState(null)

  const myIndex = state ? state.players.findIndex(p => p.id === me.uid) : -1
  const turnIdx = state?.turn ?? 0
  const isMyTurn = state && state.turn === myIndex && state.phase === 'play'
  const winner = state?.phase === 'ended' ? state.players[state.winner] : null

  useEffect(() => {
    if (!state) return
    setDraftBoard(state.board)
    setDraftRack(myIndex >= 0 ? state.players[myIndex].rack : [])
    setSelectedTileId(null)
    setMessage('')
  }, [state?.turn, room.gameStateJson]) // eslint-disable-line

  if (!state || myIndex < 0) {
    return (
      <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
        <RummiHeaderShared title="רמיקוב" onBack={onBack} />
        <div style={{ padding: 24, textAlign: 'center', color: CREAM }}>טוען את המשחק...</div>
      </div>
    )
  }

  const boardOk = isBoardValid(draftBoard)
  const myRackOriginal = state.players[myIndex].rack
  const playedFromRack = draftRack.length < myRackOriginal.length

  const selectTile = (tileId) => {
    if (!isMyTurn || winner) return
    playSound('tap')
    setSelectedTileId(prev => prev === tileId ? null : tileId)
  }

  const placeOnSet = (setIndex) => {
    if (selectedTileId == null || !isMyTurn) return
    const fromRack = draftRack.find(t => t.id === selectedTileId)
    if (!fromRack) { setSelectedTileId(null); return }
    const nb = draftBoard.map(s => [...s])
    if (setIndex === 'new') nb.push([fromRack])
    else nb[setIndex] = [...nb[setIndex], fromRack]
    setDraftBoard(nb)
    setDraftRack(draftRack.filter(t => t.id !== selectedTileId))
    setSelectedTileId(null)
    setLastDrawn(null)
    playSound('drop')
  }

  const returnTileToRack = (setIndex, tileId) => {
    if (!isMyTurn) return
    if (!myRackOriginal.find(t => t.id === tileId)) {
      setMessage('אפשר להחזיר רק אריחים שהנחת בתור הזה')
      return
    }
    const nb = draftBoard.map(s => [...s])
    const tile = nb[setIndex].find(t => t.id === tileId)
    nb[setIndex] = nb[setIndex].filter(t => t.id !== tileId)
    setDraftBoard(nb.filter(s => s.length > 0))
    setDraftRack([...draftRack, tile])
    playSound('tap')
  }

  const handleEndTurn = async () => {
    if (!isMyTurn || winner) return
    if (!playedFromRack) { setMessage('לא הנחת אריחים — שלוף אריח'); return }
    if (!boardOk) { setMessage('יש סט לא חוקי על השולחן'); return }
    const originalIds = new Set(state.board.flat().map(t => t.id))
    const newlyPlaced = []
    for (const set of draftBoard) {
      const fresh = set.filter(t => !originalIds.has(t.id))
      if (fresh.length) newlyPlaced.push(...fresh)
    }
    if (!state.players[myIndex].hasMelded) {
      const freshValue = newlyPlaced.reduce((sum, t) => sum + (t.joker ? 0 : t.num), 0)
      if (freshValue < MELD_MIN) {
        setMessage(`לפריצה ראשונה צריך לפחות ${MELD_MIN} נקודות (הנחת ${freshValue})`)
        return
      }
    }
    playSound('drop')
    const ns = commitTurn(state, myIndex, draftBoard, draftRack, true)
    await updateRummikubState(roomId, ns)
    setLastDrawn(null)
  }

  const handleDraw = async () => {
    if (!isMyTurn || winner) return
    const drawn = state.pool.length > 0 ? state.pool[0] : null
    playSound('drop')
    const ns = drawTile(state)
    await updateRummikubState(roomId, ns)
    if (drawn) setLastDrawn({ tile: drawn, forIdx: myIndex })
  }

  const handleResetDraft = () => {
    setDraftBoard(state.board)
    setDraftRack(myRackOriginal)
    setSelectedTileId(null)
    setMessage('')
    playSound('tap')
  }

  const handleLeave = async () => { await leaveRummikubRoom(roomId); onBack() }

  const statusText = winner
    ? (winner.id === me.uid ? 'ניצחת! 🎉' : `${winner.name} ניצח`)
    : isMyTurn ? 'תורך' : `תור ${state.players[turnIdx].name}`

  return (
    <div className="scroll-area" style={{ direction: 'rtl', background: 'linear-gradient(180deg,#2c1d10,#1c1108)', minHeight: '100%' }}>
      <RummiHeaderShared title="רמיקוב אונליין" onBack={handleLeave} />

      <div style={{ padding: '12px 12px 24px' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, justifyContent: 'center' }}>
          {state.players.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: i === turnIdx && !winner ? 'linear-gradient(180deg,#6e4a28,#4a2e16)' : 'rgba(74,48,22,.6)',
              border: i === turnIdx && !winner ? `2px solid ${GOLD}` : '1px solid rgba(201,162,74,.35)',
              borderRadius: 12, padding: '7px 12px',
            }}>
              <div style={{ fontSize: 16 }}>{p.id === me.uid ? '⭐' : '👤'}</div>
              <div>
                <div style={{ fontFamily: "'Suez One', serif", fontSize: 14, color: CREAM, lineHeight: 1.1 }}>{p.name}{p.id === me.uid ? ' (אתה)' : ''}</div>
                <div style={{ fontSize: 11, color: GOLD_DEEP, fontWeight: 700 }}>{p.rack.length} אריחים</div>
              </div>
              {i === turnIdx && !winner && <span style={{ fontSize: 11, color: GOLD, fontWeight: 800 }}>● תור</span>}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: GOLD_DEEP, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>השולחן</div>
          <BoardArea
            board={draftBoard}
            onSetClick={placeOnSet}
            onTileClick={returnTileToRack}
            placing={selectedTileId != null && draftRack.some(t => t.id === selectedTileId)}
          />
        </div>

        <div style={{ textAlign: 'center', minHeight: 22, margin: '8px 0', fontFamily: "'Suez One', serif", fontSize: 17, fontWeight: 800, color: message ? '#ffb3a0' : GOLD }}>
          {message || statusText}
        </div>

        <PlayerRack rack={draftRack} selectedTileId={selectedTileId} onTileClick={selectTile} />

        {lastDrawn && lastDrawn.forIdx === myIndex && <NewTileBanner tile={lastDrawn.tile} />}

        {!isMyTurn && !winner && (
          <div style={{ textAlign: 'center', color: CREAM, fontSize: 14, marginTop: 12, opacity: .8 }}>⏳ ממתין לתורך…</div>
        )}

        {isMyTurn && !winner && !state.players[myIndex].hasMelded && (
          <div style={{ textAlign: 'center', fontSize: 13, color: CREAM, marginTop: 8, opacity: .85 }}>
            💡 לירידה ראשונה צריך להניח לפחות {MELD_MIN} נקודות
          </div>
        )}

        {isMyTurn && !winner && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <RummiButton ghost label="↩ אפס" onClick={handleResetDraft} />
            <RummiButton ghost label="🎴 שלוף" onClick={handleDraw} />
            <RummiButton gold label="✓ סיים תור" onClick={handleEndTurn} />
          </div>
        )}
      </div>

      {winner && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24, direction: 'rtl' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: '30px 26px 22px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{winner.id === me.uid ? '🎉' : '🎴'}</div>
            <div className="h-display" style={{ fontSize: 28, color: winner.id === me.uid ? '#4F6B4A' : '#B89048', marginBottom: 6 }}>
              {winner.id === me.uid ? 'ניצחת!' : `${winner.name} ניצח!`}
            </div>
            <div style={{ fontSize: 16, color: 'var(--ink-2)', marginBottom: 24, fontWeight: 600 }}>
              {winner.id === me.uid ? 'כל הכבוד — נפטרת מכל האריחים!' : 'משחק יפה — אפשר לשחק שוב'}
            </div>
            <button onClick={handleLeave} className="big-btn big-btn--primary" style={{ width: '100%' }}>חזרה לזירה</button>
          </div>
        </div>
      )}
    </div>
  )
}
