// src/components/GameVideo.jsx
// ─────────────────────────────────────────────────────────────
// וידאו בתוך המשחק — "שולחן וירטואלי".
//
// רכיב משותף לכל המשחקים האונליין. מחבר את השחקנים לחדר LiveKit
// (נגזר מ-roomId של המשחק), ומחליף את האווטאר של כל שחקן בלוח
// השחקנים בווידאו חי שלו — כך מרגישים כאילו יושבים יחד בשולחן.
//
// עקרונות:
//   • כל שחקן שולט בעצמו: כפתור מצלמה 📹 וכפתור מיקרופון 🎙️ נפרדים.
//   • רואים וידאו רק ממי שהפעיל מצלמה. אצל מי שכיבה — מוצג אווטאר.
//   • הכל אופציונלי: אפשר להיכנס בלי וידאו ולהדליק תוך כדי, ולהפך.
//
// שימוש במשחק:
//   1. עוטפים את מסך המשחק ב-<GameVideoProvider roomId me enabled startWithCam>
//   2. מחליפים <Avatar .../> ב-<PlayerVideo uid name size />
//   3. מוסיפים <VideoControls /> איפשהו במסך (כפתורים צפים)
//
// הסכמת השחקנים (אישור מראש) מנוהלת ע"י המשחק עצמו דרך
// <VideoConsentGate> שנמצא גם הוא כאן.
// ─────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  LiveKitRoom,
  useTracks,
  useLocalParticipant,
  RoomAudioRenderer,
  VideoTrack,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import Avatar from './Avatar.jsx'
import { fetchLiveKitToken, watchUser, watchFriendships } from '../services/firebase.js'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud'

// ─── Context ──────────────────────────────────────────────────
// מחזיק את כל מצב הווידאו ומשתף אותו עם PlayerVideo ו-VideoControls
// בלי שהמשחק יצטרך להעביר props ידנית.
const GameVideoContext = createContext(null)

export function useGameVideo() {
  return useContext(GameVideoContext) || {
    active: false, present: false, camOn: false, micOn: false,
    toggleCam: () => {}, toggleMic: () => {}, tracksByUid: {}, tracksByName: {},
    mutedAudio: {}, hiddenVideo: {}, toggleMuteAudio: () => {}, toggleHideVideo: () => {},
  }
}

// ─── Profiles Context ─────────────────────────────
// מחזיק מפה של פרופילים חיים לפי uid — תמונה ושם מלא.
// נשלף מ-Firestore לכל שחקן במשחק (חבר או לא), כך תמיד
// מוצגת התמונה והשם המעודכנים שלו, ללא תלות במה שנשמר בחדר.
const ProfilesContext = createContext({ profiles: {}, friendUids: null, myUid: null })

// עוטף אזור שמציג שחקנים. מקבל uids ומאזין לכל פרופיל.
// myUid — ה-uid שלי, כדי לדעת מי חבר שלי (שם משפחה מוצג רק לחברים).
export function ProfilesProvider({ uids = [], myUid = null, children }) {
  const [profiles, setProfiles] = useState({})
  const [friendUids, setFriendUids] = useState(null)  // Set של uids שהם חברים מאושרים
  // מפתח יציב לרשימת ה-uids כדי לא לפתוח מחדש בכל רנדור
  const key = [...new Set(uids.filter(Boolean))].sort().join(',')

  useEffect(() => {
    const list = key ? key.split(',') : []
    if (list.length === 0) return
    const unsubs = list.map(uid =>
      watchUser(uid, (u) => {
        setProfiles(prev => ({
          ...prev,
          [uid]: {
            name: u?.name || '',
            lastName: u?.lastName || '',
            photoURL: u?.photoURL || null,
          },
        }))
      })
    )
    return () => unsubs.forEach(fn => fn && fn())
  }, [key])

  // מי מהשחקנים חבר שלי — שם המשפחה יוצג רק לחברים (פרטיות)
  useEffect(() => {
    if (!myUid) { setFriendUids(new Set()); return }
    const unsub = watchFriendships(myUid, ({ friends }) => {
      setFriendUids(new Set((friends || []).map(f => f.otherUid)))
    })
    return () => unsub && unsub()
  }, [myUid])

  return (
    <ProfilesContext.Provider value={{ profiles, friendUids, myUid }}>
      {children}
    </ProfilesContext.Provider>
  )
}

// מחזיר את הפרופיל החי של שחקן לפי uid.
// fallback — אם עוד לא נטען, מחזיר את ה-name/photoURL שהועברו (מהחדר).
// פרטיות: שם המשפחה מוצג רק אם השחקן הוא חבר שלי (או אני עצמי).
// מול שחקן רנדומלי — שם פרטי בלבד. התמונה תמיד מוצגת.
export function usePlayerProfile(uid, fallbackName = '', fallbackPhoto = null) {
  const ctx = useContext(ProfilesContext)
  const profiles = ctx?.profiles || {}
  const friendUids = ctx?.friendUids
  const myUid = ctx?.myUid
  const p = profiles?.[uid]
  // שם משפחה רק לחבר או לעצמי (פרטיות מול רנדומליים)
  const isFriendOrSelf = uid === myUid || (friendUids != null && friendUids.has(uid))
  const first = p?.name || ''
  const last = (isFriendOrSelf && p?.lastName) ? p.lastName : ''
  const fullName = p
    ? ([first, last].filter(Boolean).join(' ') || fallbackName)
    : fallbackName
  const photoURL = p?.photoURL ?? fallbackPhoto
  return { name: fullName, photoURL }
}

// ═══════════════════════════════════════════════════════════════
// Provider — עוטף את המשחק ומנהל את חיבור ה-LiveKit
// ═══════════════════════════════════════════════════════════════
// props:
//   roomId       — מזהה חדר המשחק (משמש לבניית שם חדר LiveKit ייחודי)
//   me           — { uid, name }
//   enabled      — האם הווידאו הופעל (אחרי אישור הסכמה). אם false — לא מתחבר.
//   startWithCam — האם להיכנס עם מצלמה דולקת (לפי בחירת השחקן באישור)
export function GameVideoProvider({ roomId, me, enabled, startWithCam = true, children }) {
  const [token, setToken] = useState(null)
  const [error, setError] = useState(false)
  const roomName = roomId ? `game-${roomId}` : null

  useEffect(() => {
    if (!enabled || !roomName || !me?.uid) return
    let cancelled = false
    ;(async () => {
      try {
        const t = await fetchLiveKitToken(roomName, me.name || 'שחקן', me.uid)
        if (!cancelled) setToken(t)
      } catch (e) {
        console.error('GameVideo token error:', e)
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [enabled, roomName, me?.uid, me?.name])

  // לא הופעל / עוד אין טוקן — מספקים context "כבוי" אבל מרנדרים את המשחק כרגיל.
  // עדיין מספקים present=true (עברנו את מסך האישור) כדי שכפתורי השליטה על
  // האחרים יוצגו, וגם state מקומי להשתקה/הסתרה שיישמר עד שהחיבור יעלה.
  if (!enabled || !token || error) {
    return (
      <OfflineVideoContext present={enabled}>
        {children}
      </OfflineVideoContext>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      video={startWithCam}
      audio={startWithCam}
      onError={(e) => { console.error('GameVideo room error:', e); setError(true) }}
      // שומרים על המשחק גלוי תמיד — הווידאו הוא שכבה עליו, לא במקומו
      style={{ display: 'contents' }}
    >
      <VideoBridge me={me} startWithCam={startWithCam}>
        {children}
      </VideoBridge>
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

// ─── OfflineVideoContext — context כשאין חיבור LiveKit (עדיין) ─────────
// מחזיק state מקומי להשתקה/הסתרה של האחרים, כך שהכפתורים
// יוצגו ויעבדו גם לפני שהטוקן חזר (או אם השחקן בחר להתחיל כבוי).
// present=true מסמן שעברנו את מסך האישור (גם אם לא משדרים).
function OfflineVideoContext({ present, children }) {
  const [mutedAudio, setMutedAudio] = useState({})
  const [hiddenVideo, setHiddenVideo] = useState({})
  const toggleMuteAudio = useCallback((uid) => {
    setMutedAudio(prev => ({ ...prev, [uid]: !prev[uid] }))
  }, [])
  const toggleHideVideo = useCallback((uid) => {
    setHiddenVideo(prev => ({ ...prev, [uid]: !prev[uid] }))
  }, [])
  return (
    <GameVideoContext.Provider value={{
      active: false, present: !!present, camOn: false, micOn: false,
      toggleCam: () => {}, toggleMic: () => {},
      tracksByUid: {}, tracksByName: {}, myUid: null,
      mutedAudio, hiddenVideo, toggleMuteAudio, toggleHideVideo,
    }}>
      {children}
    </GameVideoContext.Provider>
  )
}

// ─── גשר פנימי — חי בתוך LiveKitRoom, אוסף את ה-tracks ───────────
// ומפרסם אותם דרך ה-context לפי uid. כאן גם נמצאת בקרת המצלמה/מיק.
function VideoBridge({ me, startWithCam, children }) {
  const { localParticipant } = useLocalParticipant()
  const [camOn, setCamOn] = useState(startWithCam)
  const [micOn, setMicOn] = useState(startWithCam)
  // השתקות/הסתרות מקומיות — מי מהאחרים אני בחרתי להשתיק/להסתיר.
  // מקומי לחלוטין — לא משפיע על מה שהשחקן המרוחק משדר או על שחקנים אחרים.
  const [mutedAudio, setMutedAudio] = useState({})   // { [uid]: true }
  const [hiddenVideo, setHiddenVideo] = useState({}) // { [uid]: true }

  // כל מסלולי הווידאו של כל המשתתפים
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  )

  // ממפים את מסלולי הווידאו: לפי תחילית ה-identity (ה-uid שלפני ה-__),
  // ולפי שם המשתתף — כדי להתאים וידאו לשחקן הנכון.
  // (שרת הטוקן בונה identity בפורמט "<uid>__<random>".)
  // גם אובייקט ה-participant לפי uid — צריך לשליטה בעוצמת האודיו.
  const tracksByUid = {}
  const tracksByName = {}
  const participantsByUid = {}
  tracks.forEach(t => {
    const p = t.participant
    if (!p) return
    if (p.identity) {
      const baseUid = String(p.identity).split('__')[0]
      tracksByUid[baseUid] = t
      tracksByUid[p.identity] = t   // גם ה-identity המלא, ליתר ביטחון
      participantsByUid[baseUid] = p
    }
    if (p.name) tracksByName[p.name] = t
  })

  // מחילים את ההשתקות המקומיות על עוצמת האודיו של המשתתפים המרוחקים
  useEffect(() => {
    Object.entries(participantsByUid).forEach(([uid, p]) => {
      if (typeof p.setVolume === 'function') {
        try { p.setVolume(mutedAudio[uid] ? 0 : 1) } catch (e) { /* ignore */ }
      }
    })
  }) // eslint-disable-line

  const toggleMuteAudio = useCallback((uid) => {
    setMutedAudio(prev => ({ ...prev, [uid]: !prev[uid] }))
  }, [])
  const toggleHideVideo = useCallback((uid) => {
    setHiddenVideo(prev => ({ ...prev, [uid]: !prev[uid] }))
  }, [])

  const toggleCam = useCallback(async () => {
    if (!localParticipant) return
    const next = !camOn
    setCamOn(next)
    try { await localParticipant.setCameraEnabled(next) } catch (e) { console.error(e) }
  }, [localParticipant, camOn])

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return
    const next = !micOn
    setMicOn(next)
    try { await localParticipant.setMicrophoneEnabled(next) } catch (e) { console.error(e) }
  }, [localParticipant, micOn])

  return (
    <GameVideoContext.Provider value={{
      active: true, present: true, camOn, micOn, toggleCam, toggleMic, tracksByUid, tracksByName, myUid: me?.uid,
      mutedAudio, hiddenVideo, toggleMuteAudio, toggleHideVideo,
    }}>
      {children}
    </GameVideoContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════
// PlayerVideo — מחליף את <Avatar>. מציג וידאו אם יש, אחרת אווטאר.
// ═══════════════════════════════════════════════════════════════
export function PlayerVideo({ uid, name, size = 42, photoURL, online }) {
  const { active, tracksByUid, tracksByName, hiddenVideo } = useGameVideo()
  // פרופיל חי — תמונה ושם מלא (עם fallback למה שהועבר)
  const { name: fullName, photoURL: livePhoto } = usePlayerProfile(uid, name, photoURL)
  // מנסים להתאים לפי uid (identity), ואם אין — לפי שם
  const trackRef = active ? (tracksByUid?.[uid] || tracksByName?.[name] || tracksByName?.[fullName]) : null
  const isHidden = hiddenVideo?.[uid]
  const hasVideo = trackRef && trackRef.publication && !trackRef.publication.isMuted && !isHidden

  if (hasVideo) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        flexShrink: 0, background: '#000', border: '2px solid rgba(201,162,74,.6)',
        position: 'relative',
      }}>
        <VideoTrack
          trackRef={trackRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }
  return <Avatar name={fullName} size={size} photoURL={livePhoto} online={online} />
}

// ═══════════════════════════════════════════════════════════
// VideoStage — שורת וידאו גדולה וברורה (למשחקים עם מקום פנוי)
// ═══════════════════════════════════════════════════════════
// מציג ריבוע וידאו גדול לכל שחקן. מוצג רק כשהווידאו פעיל.
// players: [{ uid, name, photoURL }] · height: גובה הריבועים (ברירת מחדל 120)
export function VideoStage({ players = [], height = 120, style, showSelfControls = false }) {
  const ctx = useGameVideo()
  if (!ctx.active || players.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '0 12px', ...style }}>
      {players.map(p => (
        <VideoTile key={p.uid} p={p} height={height} showSelfControls={showSelfControls} ctx={ctx} />
      ))}
    </div>
  )
}

// ריבוע וידאו בודד — שולף את הפרופיל החי (תמונה + שם מלא).
function VideoTile({ p, height, showSelfControls, ctx }) {
  const { tracksByUid, tracksByName, myUid, camOn, micOn, toggleCam, toggleMic, present, active, mutedAudio, hiddenVideo, toggleMuteAudio, toggleHideVideo } = ctx
  // פרופיל חי — תמונה ושם מלא (עם fallback למה שהועבר מהחדר)
  const { name, photoURL } = usePlayerProfile(p.uid, p.name, p.photoURL)
  const trackRef = tracksByUid?.[p.uid] || tracksByName?.[p.name] || tracksByName?.[name]
  const isMine = p.uid === myUid || p.you
  const isHidden = hiddenVideo?.[p.uid]
  const isMuted = mutedAudio?.[p.uid]
  const hasVideo = trackRef && trackRef.publication && !trackRef.publication.isMuted && !isHidden
  return (
    <div style={{
      flex: 1, maxWidth: 200, height, borderRadius: 16, overflow: 'hidden',
      position: 'relative', background: '#1a1020',
      border: '2px solid rgba(201,162,74,.55)', boxShadow: '0 4px 12px rgba(0,0,0,.4)',
    }}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Avatar name={name} size={Math.min(64, height - 40)} photoURL={photoURL} />
        </div>
      )}
      {/* שם השחקן — פס תחתון */}
      <div style={{
        position: 'absolute', insetInline: 0, bottom: 0,
        background: 'linear-gradient(0deg, rgba(0,0,0,.65), transparent)',
        color: '#fff', fontSize: 12, fontWeight: 800, fontFamily: "'Suez One', serif",
        padding: '10px 8px 5px', textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{name}{p.you ? ' (אתה)' : ''}</div>
      {/* אינדיקציה שהמצלמה כבויה (רק אם לא הסתרתי ידנית) */}
      {!hasVideo && !isHidden && (
        <div style={{ position: 'absolute', top: 6, insetInlineEnd: 6, fontSize: 14, opacity: .75 }}>📵</div>
      )}
      {/* כפתורי שליטה מקומית על האחרים — רק על שחקנים אחרים (לא על עצמי) */}
      {!isMine && (
        <div style={{ position: 'absolute', top: 6, insetInlineStart: 6, display: 'flex', gap: 4 }}>
          <button onClick={() => toggleMuteAudio(p.uid)} aria-label={isMuted ? 'בטל השתקה' : 'השתק'} style={{
            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', border: 'none',
            background: isMuted ? 'rgba(232,72,79,.92)' : 'rgba(0,0,0,.5)', color: '#fff',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{isMuted ? '🔇' : '🔊'}</button>
          <button onClick={() => toggleHideVideo(p.uid)} aria-label={isHidden ? 'הצג וידאו' : 'הסתר וידאו'} style={{
            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', border: 'none',
            background: isHidden ? 'rgba(232,72,79,.92)' : 'rgba(0,0,0,.5)', color: '#fff',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{isHidden ? '🙈' : '👁️'}</button>
        </div>
      )}
      {/* כפתורי המצלמה/מיק שלי — בתוך הריבוע שלי (רק כש-showSelfControls פעיל) */}
      {isMine && showSelfControls && (present || active) && (
        <div style={{ position: 'absolute', top: 6, insetInlineStart: 6, display: 'flex', gap: 4 }}>
          <button onClick={toggleCam} aria-label={camOn ? 'כבה מצלמה' : 'הפעל מצלמה'} style={{
            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', border: 'none',
            background: camOn ? 'rgba(201,162,74,.92)' : 'rgba(255,255,255,.92)',
            color: camOn ? '#fff' : '#7E2C2E',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{camOn ? '📹' : '📵'}</button>
          <button onClick={toggleMic} aria-label={micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון'} style={{
            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', border: 'none',
            background: micOn ? 'rgba(201,162,74,.92)' : 'rgba(255,255,255,.92)',
            color: micOn ? '#fff' : '#7E2C2E',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{micOn ? '🎙️' : '🔇'}</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// VideoControls — שני כפתורים צפים: מצלמה + מיקרופון
// ═══════════════════════════════════════════════════════════════
// מוצג רק כשהווידאו פעיל. position נשלט ע"י ה-style שמועבר מבחוץ
// (כל משחק ממקם אותו איפה שנוח לו).
// props:
//   style — מיקום (למצב צף). אם לא מועבר — יושב inline.
//   size  — גודל כפתור (ברירת מחדל 46 לצף; העבר 32 ל-inline ליד השם).
//   only  — 'cam' / 'mic' מציג כפתור בודד; אחרת שני הכפתורים.
export function VideoControls({ style, size = 46, only }) {
  const { active, present, camOn, micOn, toggleCam, toggleMic } = useGameVideo()
  // מוצג כל עוד עברנו את מסך האישור — כך כפתורי ההדלקה קיימים גם
  // למי שבחר להתחיל כבוי (החיבור עולה תוך שנייה ואז ההדלקה תופסת).
  if (!active && !present) return null

  const btn = (on, onClick, onIcon, offIcon, label) => (
    <button onClick={onClick} aria-label={label} style={{
      width: size, height: size, borderRadius: '50%', cursor: 'pointer',
      background: on ? 'rgba(201,162,74,.9)' : 'rgba(255,255,255,.92)',
      color: on ? '#fff' : '#7E2C2E', border: 'none', fontSize: size * 0.44,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,.4)',
    }}>{on ? onIcon : offIcon}</button>
  )

  const camBtn = btn(camOn, toggleCam, '📹', '📵', camOn ? 'כבה מצלמה' : 'הפעל מצלמה')
  const micBtn = btn(micOn, toggleMic, '🎙️', '🔇', micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון')

  // כפתור בודד (למצב inline ליד השם)
  if (only === 'cam') return camBtn
  if (only === 'mic') return micBtn

  return (
    <div style={{ display: 'flex', gap: 8, zIndex: 70, ...style }}>
      {camBtn}
      {micBtn}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// RemoteVideoToggles — כפתורי השתקה/הסתרה של יריב ספציפי
// ═══════════════════════════════════════════════════════════
// מוצג על הריבוע של כל יריב. מקומי לחלוטין — משפיע רק על מה שאני
// רואה/שומע, לא על השחקן המרוחק ולא על שחקנים אחרים.
export function RemoteVideoToggles({ uid, size = 26, only }) {
  const { active, present, mutedAudio, hiddenVideo, toggleMuteAudio, toggleHideVideo } = useGameVideo()
  // מוצג כל עוד עברנו את מסך האישור (present) — גם לפני שהחיבור עלה.
  // כך כל השחקנים רואים את כפתורי השליטה על האחרים, גם מי שבחר להתחיל כבוי.
  if (!active && !present) return null
  const isMuted = mutedAudio?.[uid]
  const isHidden = hiddenVideo?.[uid]
  const btn = (red, onClick, icon, label) => (
    <button onClick={onClick} aria-label={label} style={{
      width: size, height: size, borderRadius: '50%', cursor: 'pointer', border: 'none',
      background: red ? 'rgba(232,72,79,.95)' : 'rgba(0,0,0,.4)', color: '#fff',
      fontSize: size * 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.4)',
    }}>{icon}</button>
  )
  const audioBtn = btn(isMuted, () => toggleMuteAudio(uid), isMuted ? '🔇' : '🔊', isMuted ? 'בטל השתקה' : 'השתק')
  const videoBtn = btn(isHidden, () => toggleHideVideo(uid), isHidden ? '🙈' : '👁️', isHidden ? 'הצג וידאו' : 'הסתר וידאו')
  // מצב משולב: רק אודיו / רק וידאו / שניהם
  if (only === 'audio') return audioBtn
  if (only === 'video') return videoBtn
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {audioBtn}
      {videoBtn}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// VideoConsentGate — מסך אישור לפני המשחק
// ═══════════════════════════════════════════════════════════════
// כל שחקן בוחר אם להפעיל וידאו. מחזיר את הבחירה דרך onDecide(useVideo).
// המשחק מציג את זה פעם אחת לפני שמתחיל לרנדר את הלוח.
export function VideoConsentGate({ onDecide, accent = '#4A2A66', accentDeep = '#C9A24A' }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(20,15,25,.7)', direction: 'rtl',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24,
        padding: '30px 26px 22px', maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎥</div>
        <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>
          להפעיל וידאו במשחק?
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink-2)', marginBottom: 22, lineHeight: 1.5, fontWeight: 600 }}>
          תוכלו לראות ולשמוע זה את זה תוך כדי המשחק — כמו לשבת יחד סביב השולחן.
          אפשר לכבות את המצלמה או המיקרופון בכל רגע.
        </div>
        <button onClick={() => onDecide(true)} style={{
          width: '100%', borderRadius: 14, padding: '15px', fontSize: 17, fontWeight: 800,
          fontFamily: 'inherit', border: 'none', cursor: 'pointer', marginBottom: 10,
          background: `linear-gradient(180deg,${accentDeep},${accent})`, color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,.3)',
        }}>📹 כן, להפעיל וידאו</button>
        <button onClick={() => onDecide(false)} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
          לא, נשחק בלי
        </button>
      </div>
    </div>
  )
}
