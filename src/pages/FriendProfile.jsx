// src/pages/FriendProfile.jsx
// ─────────────────────────────────────────────────────────────
// פרופיל של חבר — נפתח בלחיצה על תמונת חבר ברשימת החברים.
// מציג: תמונת פרופיל גדולה (לחיצה → מסך מלא), "מעט עליי",
// וגלריית התמונות של החבר (כל תמונה → מסך מלא).
// הנתונים נטענים חי לפי ה-uid של החבר.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { watchUser, getGallery } from '../services/firebase.js'
import { useUserStore } from '../stores/userStore.js'
import Avatar from '../components/Avatar.jsx'
import Lightbox from '../components/Lightbox.jsx'
import HomeButton from '../components/HomeButton.jsx'
import BlockReportBar from '../components/BlockReportBar.jsx'
import { IconBackRTL } from '../icons/index.jsx'

export default function FriendProfile({ friend, onBack, onHome }) {
  const uid = friend?.otherUid
  const myUid = useUserStore(s => s.authUser?.uid)
  const [prof, setProf] = useState(null)
  const [gallery, setGallery] = useState([])
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    if (!uid) return
    const unsub = watchUser(uid, u => setProf(u || null))
    getGallery(uid).then(setGallery).catch(() => {})
    return () => unsub && unsub()
  }, [uid])

  const fullName = prof
    ? ([prof.name, prof.lastName].filter(Boolean).join(' ') || friend?.otherName || '')
    : (friend?.otherName || '')
  const photoURL = prof?.photoURL || null
  const about = prof?.about || ''

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">פרופיל</div>
      </div>

      <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          onClick={() => photoURL && setLightbox(photoURL)}
          style={{ border: 'none', background: 'none', padding: 0, cursor: photoURL ? 'pointer' : 'default', borderRadius: '50%' }}
          aria-label="הצגת התמונה בגודל מלא"
        >
          <Avatar name={fullName} size={132} photoURL={photoURL} color="#6B3A4F" />
        </button>
        <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginTop: 14, textAlign: 'center' }}>
          {fullName}
        </div>

        {about && (
          <div style={{
            marginTop: 16, width: '100%', background: 'var(--surface)',
            border: '1px solid var(--line)', borderRadius: 16, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 5 }}>מעט עליי</div>
            <div style={{ fontSize: 16, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{about}</div>
          </div>
        )}

        {gallery.length > 0 && (
          <div style={{ marginTop: 20, width: '100%' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-3)', marginBottom: 10 }}>תמונות</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {gallery.map(p => (
                <button key={p.id} onClick={() => setLightbox(p.dataURL)} style={{
                  aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: 'none',
                  padding: 0, background: 'var(--surface-2)', cursor: 'pointer',
                }} aria-label="הצגת התמונה בגודל מלא">
                  <img src={p.dataURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* כלי בטיחות — חסימה ודיווח (רק על חבר אמיתי, לא על עצמי) */}
        {uid && uid !== myUid && (
          <div style={{ width: '100%', marginTop: 24 }}>
            <BlockReportBar
              targetType="user"
              targetId={uid}
              targetName={fullName}
              onBlocked={onBack}
            />
          </div>
        )}
      </div>

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
