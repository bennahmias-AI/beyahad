// src/pages/VideoCallScreen.jsx
// ─────────────────────────────────────────────────────────────
// מסך שיחת וידאו בין שני חברים.
//
// מתחבר לחדר LiveKit המשותף (שנוצר ב-startVideoCall) ומציג את שני
// הפרצופים גדולים: הפרצוף של החבר גדול במרכז, והפרצוף שלי קטן בפינה.
// כפתורים גדולים וברורים: מצלמה / מיקרופון / ניתוק.
//
// מקבל:
//   call      — אובייקט השיחה { id, room, fromUid, fromName, toUid, toName, ... }
//   myUid     — ה-uid שלי
//   myName    — השם שלי
//   otherName — שם החבר בשיחה
//   startWithCam — האם להיכנס עם מצלמה דולקת (ברירת מחדל true)
//   onEnd     — נקרא כשהשיחה הסתיימה (ניתוק / החבר ניתק)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react'
import {
  LiveKitRoom, useTracks, useLocalParticipant,
  RoomAudioRenderer, VideoTrack, useParticipants,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { fetchLiveKitToken, watchVideoCall, endVideoCall, deleteVideoCall } from '../services/firebase.js'
import Avatar from '../components/Avatar.jsx'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud'

export default function VideoCallScreen({ call, myUid, myName, otherName, otherUid, otherPhoto, startWithCam = true, audioOnly = false, onEnd }) {
  const [token, setToken] = useState(null)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)

  // מביא טוקן לחדר ה-LiveKit של השיחה
  useEffect(() => {
    if (!call?.room || !myUid) return
    let cancelled = false
    ;(async () => {
      try {
        const t = await fetchLiveKitToken(call.room, myName || 'משתמש', myUid)
        if (!cancelled) setToken(t)
      } catch (e) {
        console.error('VideoCall token error:', e)
        if (!cancelled) setError('לא הצלחנו להתחבר לשיחה')
      }
    })()
    return () => { cancelled = true }
  }, [call?.room, myUid, myName])

  // מאזין לסטטוס השיחה — אם הצד השני ניתק, סוגרים
  useEffect(() => {
    if (!call?.id) return
    const unsub = watchVideoCall(call.id, (data) => {
      if (!data || data.status === 'ended' || data.status === 'declined') {
        handleClose(false)
      }
    })
    return () => unsub && unsub()
    // eslint-disable-next-line
  }, [call?.id])

  // טיימר משך השיחה
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // סוגר את השיחה. endRemote=true → מסמן ל-Firestore שהשיחה הסתיימה (כשאני מנתק).
  const handleClose = async (endRemote = true) => {
    if (endRemote && call?.id) {
      await endVideoCall(call.id).catch(() => {})
      // ניקוי ה-doc אחרי רגע קצר (כדי שהצד השני יספיק לראות 'ended')
      setTimeout(() => deleteVideoCall(call.id).catch(() => {}), 1500)
    }
    onEnd && onEnd()
  }

  const fmtTime = (s) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 4000, background: '#1a1020',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, direction: 'rtl', padding: 24,
      }}>
        <div style={{ fontSize: 56 }}>😕</div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center', fontFamily: "'Suez One', serif" }}>
          {error}
        </div>
        <button onClick={() => handleClose(true)} className="big-btn big-btn--primary" style={{ minWidth: 200 }}>
          חזרה
        </button>
      </div>
    )
  }

  if (!token) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 4000, background: '#1a1020',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, direction: 'rtl',
      }}>
        <Avatar name={otherName} size={110} photoURL={otherPhoto} />
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, fontFamily: "'Suez One', serif" }}>
          מתחבר לשיחה עם {otherName}...
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      video={audioOnly ? false : startWithCam}
      audio={true}
      onError={(e) => { console.error('VideoCall room error:', e); setError('בעיה בחיבור לשיחה') }}
      style={{ position: 'fixed', inset: 0, zIndex: 4000 }}
    >
      <CallStage
        myUid={myUid} myName={myName}
        otherName={otherName} otherUid={otherUid} otherPhoto={otherPhoto}
        startWithCam={audioOnly ? false : startWithCam}
        audioOnly={audioOnly}
        elapsed={elapsed} fmtTime={fmtTime}
        onHangup={() => handleClose(true)}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

// ─── במה — חי בתוך LiveKitRoom ──────────────────────────────
function CallStage({ myUid, myName, otherName, otherUid, otherPhoto, startWithCam, audioOnly, elapsed, fmtTime, onHangup }) {
  const { localParticipant } = useLocalParticipant()
  const [camOn, setCamOn] = useState(startWithCam)
  const [micOn, setMicOn] = useState(true)

  // כל מסלולי הווידאו של המשתתפים
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  )

  // ממפים וידאו לפי uid (תחילית ה-identity לפני __)
  const tracksByUid = {}
  tracks.forEach(t => {
    const p = t.participant
    if (!p?.identity) return
    const baseUid = String(p.identity).split('__')[0]
    tracksByUid[baseUid] = t
  })

  const otherTrack = tracksByUid[otherUid]
  const myTrack = tracksByUid[myUid]
  const otherHasVideo = !audioOnly && otherTrack && otherTrack.publication && !otherTrack.publication.isMuted
  const myHasVideo = !audioOnly && myTrack && myTrack.publication && !myTrack.publication.isMuted

  const toggleCam = async () => {
    if (!localParticipant) return
    const next = !camOn
    setCamOn(next)
    try { await localParticipant.setCameraEnabled(next) } catch (e) { console.error(e) }
  }
  const toggleMic = async () => {
    if (!localParticipant) return
    const next = !micOn
    setMicOn(next)
    try { await localParticipant.setMicrophoneEnabled(next) } catch (e) { console.error(e) }
  }

  // תצוגת שיחה קולית (כמו וואטסאפ) — אווטר גדול על רקע לבן
  if (audioOnly) {
    return (
      <div style={{
        position: 'absolute', inset: 0, direction: 'rtl',
        background: 'linear-gradient(180deg, #FBF7EE 0%, #EFE8DA 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
          {/* אווטר מגיב לקול — טבעות מתפשטות + רעידה לפי עוצמת הדיבור */}
          <AudioReactiveAvatar otherUid={otherUid} otherName={otherName} otherPhoto={otherPhoto} />
          <div style={{ textAlign: 'center' }}>
            <div className="h-display" style={{ fontSize: 28, color: 'var(--ink)', marginBottom: 6 }}>
              {otherName}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>
              {fmtTime(elapsed)}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
          padding: '24px 20px calc(36px + env(safe-area-inset-bottom, 0px))',
        }}>
          <button
            onClick={toggleMic}
            aria-label={micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
            style={{
              width: 64, height: 64, borderRadius: '50%', cursor: 'pointer',
              border: '1px solid var(--line)', fontSize: 28,
              background: micOn ? 'var(--surface)' : 'var(--ink)',
              color: micOn ? 'var(--ink)' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {micOn ? '🎙️' : '🔇'}
          </button>
          <button
            onClick={onHangup}
            aria-label="נתק שיחה"
            style={{
              width: 80, height: 80, borderRadius: '50%', background: '#E8484F',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 6px 18px rgba(232,72,79,.5)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#fff" style={{ transform: 'rotate(135deg)' }}>
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, direction: 'rtl',
      background: 'linear-gradient(180deg, #241830 0%, #160d1c 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* פרצוף החבר — גדול במרכז */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {otherHasVideo ? (
          <VideoTrack trackRef={otherTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 18,
          }}>
            <Avatar name={otherName} size={130} photoURL={otherPhoto} />
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, fontFamily: "'Suez One', serif" }}>
              {otherName}
            </div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 600 }}>
              המצלמה כבויה
            </div>
          </div>
        )}

        {/* שם + טיימר — פס עליון */}
        <div style={{
          position: 'absolute', top: 0, insetInline: 0, padding: '16px 20px',
          background: 'linear-gradient(180deg, rgba(0,0,0,.5), transparent)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, fontFamily: "'Suez One', serif" }}>
              {otherName}
            </div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, fontWeight: 700 }}>
              {fmtTime(elapsed)}
            </div>
          </div>
        </div>

        {/* הפרצוף שלי — קטן בפינה */}
        <div style={{
          position: 'absolute', bottom: 16, insetInlineEnd: 16,
          width: 110, height: 150, borderRadius: 16, overflow: 'hidden',
          background: '#000', border: '2px solid rgba(255,255,255,.3)',
          boxShadow: '0 4px 14px rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {myHasVideo ? (
            <VideoTrack trackRef={myTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Avatar name={myName} size={56} />
              <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, fontWeight: 700 }}>אתה</span>
            </div>
          )}
        </div>
      </div>

      {/* כפתורי שליטה — גדולים וברורים */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22,
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(0,0,0,.35)',
      }}>
        {/* מיקרופון */}
        <CallButton
          onClick={toggleMic}
          on={micOn}
          label={micOn ? 'השתק מיקרופון' : 'הפעל מיקרופון'}
          icon={micOn ? '🎙️' : '🔇'}
        />
        {/* ניתוק — אדום גדול במרכז */}
        <button
          onClick={onHangup}
          aria-label="נתק שיחה"
          style={{
            width: 76, height: 76, borderRadius: '50%', background: '#E8484F',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 6px 18px rgba(232,72,79,.5)',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" style={{ transform: 'rotate(135deg)' }}>
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        </button>
        {/* מצלמה */}
        <CallButton
          onClick={toggleCam}
          on={camOn}
          label={camOn ? 'כבה מצלמה' : 'הפעל מצלמה'}
          icon={camOn ? '📹' : '📵'}
        />
      </div>
    </div>
  )
}

function CallButton({ onClick, on, label, icon }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 60, height: 60, borderRadius: '50%', cursor: 'pointer', border: 'none',
        background: on ? 'rgba(255,255,255,.18)' : '#fff',
        color: on ? '#fff' : '#241830', fontSize: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      }}
    >
      {icon}
    </button>
  )
}

// ─── אווטר מגיב לקול ────────────────────────────────
// מוצא את המשתתף המרוחק (החבר) וקורא את עוצמת הדיבור שלו (audioLevel)
// בלולאת requestAnimationFrame. לפי העוצמה: טבעות מתפשטות + רעידה + הגדלה.
function AudioReactiveAvatar({ otherUid, otherName, otherPhoto }) {
  const participants = useParticipants()
  const ringRef = useRef(null)
  const ring2Ref = useRef(null)
  const avatarBoxRef = useRef(null)
  const rafRef = useRef(null)

  // מוצאים את המשתתף שה-uid שלו (לפני __) תואם לחבר
  const other = participants.find(p => {
    const base = String(p?.identity || '').split('__')[0]
    return base === otherUid
  })

  useEffect(() => {
    const tick = () => {
      // audioLevel בטווח 0..1 (בדרך כלל קטן — מגבירים אותו)
      const raw = other?.audioLevel || 0
      const level = Math.min(1, raw * 3.2)   // הגברה לתגובה ויזואלית טובה

      if (avatarBoxRef.current) {
        // הגדלה עדינה + רעידה קלה לפי העוצמה
        const scale = 1 + level * 0.07
        const shake = level > 0.15 ? (Math.random() - 0.5) * level * 5 : 0
        avatarBoxRef.current.style.transform = `scale(${scale}) translate(${shake}px, ${shake}px)`
      }
      if (ringRef.current) {
        // טבעת פנימית — מתרחבת ומתעמעת לפי העוצמה
        ringRef.current.style.transform = `scale(${1 + level * 0.35})`
        ringRef.current.style.opacity = String(Math.min(0.6, level * 0.9))
      }
      if (ring2Ref.current) {
        // טבעת חיצונית — מתרחבת יותר
        ring2Ref.current.style.transform = `scale(${1 + level * 0.7})`
        ring2Ref.current.style.opacity = String(Math.min(0.4, level * 0.6))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [other])

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* טבעת חיצונית (סאונד רחוק) */}
      <span ref={ring2Ref} style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: 'rgba(126,44,46,.18)', opacity: 0, pointerEvents: 'none',
        transition: 'transform .08s linear, opacity .12s linear',
      }} />
      {/* טבעת פנימית (סאונד קרוב) */}
      <span ref={ringRef} style={{
        position: 'absolute', width: 175, height: 175, borderRadius: '50%',
        background: 'rgba(126,44,46,.28)', opacity: 0, pointerEvents: 'none',
        transition: 'transform .08s linear, opacity .12s linear',
      }} />
      {/* האווטר עצמו — רעידה/הגדלה לפי הקול */}
      <div ref={avatarBoxRef} style={{
        position: 'relative', padding: 8, borderRadius: '50%',
        background: 'rgba(126,44,46,.08)', border: '2px solid rgba(126,44,46,.15)',
        transition: 'transform .06s linear',
      }}>
        <Avatar name={otherName} size={150} photoURL={otherPhoto} />
      </div>
    </div>
  )
}
