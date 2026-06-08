// src/pages/SettingsPage.jsx
// ─────────────────────────────────────────────────────────────
// מסך הגדרות — מרכז שליטה למשתמש:
//   1. נגישות — גודל טקסט, ניגודיות גבוהה, הפחתת אנימציות.
//   2. התראות — הפעלה/כיבוי של התראות Push למכשיר.
//   3. פרטיות — בחירה אילו פרטים גלויים למשתמשים אחרים.
//   4. מחיקת חשבון — הזכות להישכח (מוחק את כל הנתונים).
//
// כל ההגדרות נשמרות: נגישות ב-localStorage (מיידי, גם ללא חיבור),
// פרטיות במסמך המשתמש ב-Firestore (visibility).
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useUserStore } from '../stores/userStore.js'
import {
  createOrUpdateUser, getUser, signOut,
  enableNotifications, disableNotifications,
  notificationsSupported, getNotificationPermission,
  scheduleAccountDeletion, cancelAccountDeletion,
} from '../services/firebase.js'
import {
  getAccessibilitySettings, setAccessibilitySetting,
} from '../utils/accessibility.js'
import { isStandalone, isIOS, canPrompt, subscribe, promptInstall } from '../utils/pwaInstall.js'
import {
  IconBackRTL, IconSpeaker, IconText, IconBell, IconHeart, IconBook, IconPhone,
} from '../icons/index.jsx'
import TermsModal from '../components/TermsModal.jsx'
import HomeButton from '../components/HomeButton.jsx'

export default function SettingsPage({ onBack, onHome }) {
  const { authUser } = useUserStore()

  return (
    <div className="scroll-area" style={{ direction: 'rtl' }}>
      <div className="screen-header">
        <button className="screen-header__back" onClick={onBack} aria-label="חזרה">
          <IconBackRTL size={24} color="#1B2540" />
        </button>
        <HomeButton onClick={onHome} />
        <div className="screen-header__title">הגדרות</div>
      </div>

      <div style={{ padding: '8px 20px 40px' }}>
        <InstallAppSection />
        <AccessibilitySection />
        <NotificationsSection uid={authUser?.uid} />
        <CallsSection uid={authUser?.uid} />
        <PrivacySection uid={authUser?.uid} />
        <TermsSection />
        <DeleteAccountSection uid={authUser?.uid} />
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// כותרת מקטע
// ════════════════════════════════════════════════════════
function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 8 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: 'var(--burgundy-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div className="h-display" style={{ fontSize: 20, color: 'var(--ink)', lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 18, padding: '16px 18px', marginBottom: 24,
  boxShadow: 'var(--shadow-sm)',
}

// ════════════════════════════════════════════
// 0. התקנת האפליקציה — כפתור קבוע (תמיד זמין)
// ═════════════════════════════════════════════
function InstallAppSection() {
  const [installed, setInstalled] = useState(() => isStandalone())
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const unsub = subscribe(() => setInstalled(isStandalone()))
    return unsub
  }, [])

  const handleInstall = async () => {
    if (canPrompt()) {
      const res = await promptInstall()
      if (res === 'accepted') setInstalled(true)
      else if (res === 'unavailable') setShowHelp(true)
      // 'dismissed' — המשתמש סגר את הדיאלוג, לא עושים כלום
    } else {
      // אין דיאלוג מקורי (אייפון, או דפדפן ללא תמיכה) — מציגים הוראות
      setShowHelp(true)
    }
  }

  return (
    <>
      <SectionTitle
        icon={<span style={{ fontSize: 22 }}>📲</span>}
        title="התקנת האפליקציה"
        subtitle="גישה מהירה ממסך הבית, בלי דפדפן"
      />
      <div style={cardStyle}>
        {installed ? (
          <div style={{
            fontSize: 15, fontWeight: 800, color: 'var(--success)',
            display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 20 }}>✓</span>
            האפליקציה כבר מותקנת במכשיר הזה
          </div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>
              מתקינים את "ביחד" על הטלפון כמו אפליקציה רגילה — אייקון במסך הבית, פתיחה מהירה, ובלי לחפש את הקישור כל פעם.
            </div>
            <button
              onClick={handleInstall}
              className="big-btn big-btn--primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 20 }}>📲</span>
              התקנת האפליקציה
            </button>
            <button
              onClick={() => setShowHelp(true)}
              style={{
                width: '100%', marginTop: 10, padding: '10px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              איך מתקינים? הסבר שלב-אחר-שלב
            </button>
          </>
        )}
      </div>

      {showHelp && <InstallInstructionsModal onClose={() => setShowHelp(false)} />}
    </>
  )
}

// הוראות התקנה ידניות לפי סוג המכשיר
function InstallInstructionsModal({ onClose }) {
  const ios = isIOS()
  const android = !ios && /Android/i.test(navigator.userAgent || '')

  const steps = ios
    ? [
        'פתחו את האתר בדפדפן Safari.',
        'לחצו על כפתור השיתוף ⬆️ (ריבוע עם חץ למעלה) בתחתית המסך.',
        'גללו ובחרו "הוסף למסך הבית" (Add to Home Screen).',
        'לחצו "הוסף" — האייקון יופיע במסך הבית.',
      ]
    : android
    ? [
        'פתחו את האתר בדפדפן Chrome.',
        'לחצו על תפריט שלוש הנקודות ⋮ בפינה העליונה.',
        'בחרו "התקנת האפליקציה" או "הוספה למסך הבית".',
        'אשרו — האייקון יופיע במסך הבית.',
      ]
    : [
        'פתחו את התפריט של הדפדפן.',
        'חפשו "התקן אפליקציה" / "Install" או "הוסף למסך הבית".',
        'אשרו — האפליקציה תיפתח כמו תוכנה רגילה.',
      ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 24, direction: 'rtl',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24,
        padding: '26px 22px 22px', maxWidth: 380, width: '100%',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ fontSize: 44, textAlign: 'center', marginBottom: 8 }}>📲</div>
        <div className="h-display" style={{ fontSize: 22, color: 'var(--ink)', textAlign: 'center', marginBottom: 16 }}>
          התקנת האפליקציה
        </div>
        <ol style={{ margin: 0, paddingInlineStart: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => (
            <li key={i} style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 }}>{s}</li>
          ))}
        </ol>
        <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%', marginTop: 20 }}>
          הבנתי
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
// 1. נגישות
// ════════════════════════════════════════════════════════
function AccessibilitySection() {
  const [settings, setSettings] = useState(() => getAccessibilitySettings())

  const update = (key, value) => {
    const next = setAccessibilitySetting(key, value)
    setSettings({ ...next })
  }

  return (
    <>
      <SectionTitle
        icon={<IconText size={22} color="#7E2C2E" />}
        title="נגישות"
        subtitle="התאמת התצוגה לנוחות שלכם"
      />
      <div style={cardStyle}>
        {/* גודל טקסט */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>גודל הטקסט</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 10 }}>
            מגדיל את כל הטקסט והכפתורים באפליקציה
          </div>
          <SegmentedControl
            value={settings.fontScale}
            onChange={(v) => update('fontScale', v)}
            options={[
              { id: 'normal', label: 'רגיל' },
              { id: 'large', label: 'גדול' },
              { id: 'xlarge', label: 'גדול מאוד' },
            ]}
          />
        </div>

        {/* ניגודיות גבוהה */}
        <ToggleRow
          title="ניגודיות גבוהה"
          desc="צבעים חדים וכהים יותר לקריאוּת קלה"
          on={settings.contrast === 'high'}
          onToggle={() => update('contrast', settings.contrast === 'high' ? 'normal' : 'high')}
        />

        <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />

        {/* הפחתת אנימציות */}
        <ToggleRow
          title="הפחתת תנועה"
          desc="מבטל אנימציות ומעברים — נעים יותר לעיניים"
          on={settings.reduceMotion}
          onToggle={() => update('reduceMotion', !settings.reduceMotion)}
        />
      </div>
    </>
  )
}

// בורר מקטעים (טקסט גדול/רגיל וכו') — כפתורים גדולים ונגישים
function SegmentedControl({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(opt => {
        const active = value === opt.id
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            flex: 1, padding: '13px 6px', borderRadius: 14,
            border: active ? '2px solid var(--burgundy)' : '1px solid var(--line-strong)',
            background: active ? 'var(--burgundy)' : 'var(--surface)',
            color: active ? '#fff' : 'var(--ink)',
            fontSize: 15, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
            transition: 'all .15s',
          }}>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// שורת מתג (Toggle) — כותרת + תיאור + מתג גדול
function ToggleRow({ title, desc, on, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <Switch on={on} onToggle={onToggle} />
    </div>
  )
}

// מתג ON/OFF גדול ונגיש
function Switch({ on, onToggle, disabled }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{
        width: 60, height: 34, borderRadius: 999, flexShrink: 0,
        background: on ? 'var(--success)' : 'var(--line-strong)',
        border: 'none', position: 'relative', cursor: disabled ? 'default' : 'pointer',
        transition: 'background .2s', opacity: disabled ? 0.5 : 1, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, insetInlineStart: on ? 29 : 3,
        width: 28, height: 28, borderRadius: '50%', background: '#fff',
        boxShadow: '0 2px 5px rgba(0,0,0,.3)', transition: 'inset-inline-start .2s',
      }} />
    </button>
  )
}

// ════════════════════════════════════════════════════════
// 2. התראות
// ════════════════════════════════════════════════════════
function NotificationsSection({ uid }) {
  const { profile } = useUserStore()
  const [supported, setSupported] = useState(null)
  const [enabled, setEnabled] = useState(false)   // מצב אפליקטיבי (הופעל בפועל) — לא הרשאת הדפדפן
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    let alive = true
    notificationsSupported().then(s => {
      if (!alive) return
      setSupported(s)
      // המתג דלוק רק אם יש הרשאה וגם המשתמש הפעיל בפועל
      setEnabled(getNotificationPermission() === 'granted' && profile?.notificationsEnabled === true)
    })
    return () => { alive = false }
  }, [profile?.notificationsEnabled])

  const on = enabled

  const handleToggle = async () => {
    setBusy(true); setNote('')
    if (on) {
      await disableNotifications(uid)
      setEnabled(false)
      setNote('התראות כובו למכשיר הזה.')
    } else {
      const res = await enableNotifications(uid)
      if (res.ok) {
        setEnabled(true)
        setNote('✓ התראות הופעלו! תקבלו התראה כשחבר מתקשר או שולח הודעה.')
      }
      else if (res.reason === 'denied') setNote('⚠ ההרשאה נחסמה. כדי לאפשר התראות יש לאשר אותן בהגדרות הדפדפן/הטלפון.')
      else if (res.reason === 'no-vapid-key') setNote('⚠ חסר מפתח הגדרה — צריך להגדיר אותו תחילה.')
      else if (res.reason === 'unsupported') setNote('⚠ המכשיר או הדפדפן לא תומך בהתראות.')
      else setNote('לא הצלחנו להפעיל התראות — נסו שוב.')
    }
    setBusy(false)
  }

  return (
    <>
      <SectionTitle
        icon={<IconBell size={26} />}
        title="התראות"
        subtitle="עדכונים על שיחות, הודעות והזמנות"
      />
      <div style={cardStyle}>
        {supported === false ? (
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5 }}>
            המכשיר או הדפדפן הזה לא תומך בהתראות. באייפון — יש להתקין קודם את האפליקציה למסך הבית.
          </div>
        ) : (
          <>
            <ToggleRow
              title="התראות לטלפון"
              desc={on
                ? 'מופעל — תקבלו התראה גם כשהאפליקציה סגורה'
                : 'הפעילו כדי לקבל התראה על שיחות, הודעות והזמנות למשחק'}
              on={on}
              onToggle={busy ? () => {} : handleToggle}
            />
            {note && (
              <div style={{
                marginTop: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.5,
                color: note.startsWith('✓') ? 'var(--success)' : 'var(--ink-2)',
              }}>
                {note}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════
// 3. פרטיות — אילו פרטים גלויים למשתמשים אחרים
// ════════════════════════════════════════════════════════
// השדות הניתנים להסתרה. ברירת המחדל: הכול גלוי (true) חוץ מטלפון.
const VISIBILITY_FIELDS = [
  { key: 'lastName', label: 'שם משפחה', desc: 'יוצג לצד השם הפרטי' },
  { key: 'photo', label: 'תמונת פרופיל', desc: 'התמונה שבחרתם תוצג לאחרים' },
  { key: 'phone', label: 'מספר טלפון', desc: 'מומלץ להשאיר מוסתר' },
]

const DEFAULT_VISIBILITY = { lastName: true, photo: true, phone: false }

// מקטע שיחות — האם חברים יכולים להתקשר אליי (גם כשהאפליקציה סגורה).
// ברירת מחדל: מאופשר (callsEnabled לא מוגדר = מאופשר).
function CallsSection({ uid }) {
  const { profile, setProfile } = useUserStore()
  const [on, setOn] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOn(profile?.callsEnabled !== false)
  }, [profile?.callsEnabled])

  const toggle = async () => {
    const next = !on
    setOn(next)
    setSaving(true)
    try {
      await createOrUpdateUser(uid, { callsEnabled: next })
      const fresh = await getUser(uid)
      if (fresh) setProfile(fresh)
    } catch (e) {
      console.error('save callsEnabled error:', e)
      setOn(!next)   // החזרה בכשל
    }
    setSaving(false)
  }

  return (
    <>
      <SectionTitle
        icon={<IconPhone size={22} color="#7E2C2E" />}
        title="שיחות"
        subtitle="שיחות וידאו וקול מחברים"
      />
      <div style={cardStyle}>
        <ToggleRow
          title="קבלת שיחות מחברים"
          desc={on
            ? 'מופעל — חברים יכולים להתקשר אליך, ותקבל התראה גם כשהאפליקציה סגורה'
            : 'כבוי — חברים לא יוכלו להתקשר אליך. עדיין אפשר לכתוב הודעות'}
          on={on}
          onToggle={() => !saving && toggle()}
        />
      </div>
    </>
  )
}

function PrivacySection({ uid }) {
  const { profile, setProfile } = useUserStore()
  const [vis, setVis] = useState(DEFAULT_VISIBILITY)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile?.visibility) {
      setVis({ ...DEFAULT_VISIBILITY, ...profile.visibility })
    }
    setLoaded(true)
  }, [profile?.visibility])

  const toggle = async (key) => {
    const next = { ...vis, [key]: !vis[key] }
    setVis(next)
    setSaving(true)
    try {
      await createOrUpdateUser(uid, { visibility: next })
      const fresh = await getUser(uid)
      if (fresh) setProfile(fresh)
    } catch (e) {
      console.error('save visibility error:', e)
    }
    setSaving(false)
  }

  return (
    <>
      <SectionTitle
        icon={<IconHeart size={22} color="#7E2C2E" />}
        title="פרטיות"
        subtitle="בחרו אילו פרטים אחרים רואים"
      />
      <div style={cardStyle}>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
          הפרטים שתשאירו מופעלים יוצגו למשתמשים אחרים כשהם רואים את הפרופיל שלכם. השם הפרטי תמיד גלוי.
        </div>
        {VISIBILITY_FIELDS.map((f, i) => (
          <div key={f.key}>
            {i > 0 && <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />}
            <ToggleRow
              title={f.label}
              desc={f.desc}
              on={vis[f.key]}
              onToggle={() => !saving && toggle(f.key)}
            />
          </div>
        ))}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════
// 4. תקנון ומדיניות פרטיות
// ════════════════════════════════════════════════════════
function TermsSection() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <SectionTitle
        icon={<IconBook size={40} />}
        title="תקנון ופרטיות"
        subtitle="תנאי השימוש ומדיניות הפרטיות"
      />
      <div style={cardStyle}>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>
          כאן תוכלו לקרוא את תקנון האפליקציה, תנאי השימוש והדרך שבה אנחנו שומרים על הפרטיות שלכם.
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: 'var(--surface-2)', border: '1px solid var(--line)',
            color: 'var(--ink)', fontSize: 16, fontWeight: 800,
            fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          📖 קרא את התקנון ומדיניות הפרטיות
        </button>
      </div>

      {open && <TermsModal onClose={() => setOpen(false)} />}
    </>
  )
}

// ════════════════════════════════════════════════════════
// 5. מחיקת חשבון — עם תקופת צינון של 48 שעות
// ════════════════════════════════════════════════════════
function DeleteAccountSection({ uid }) {
  const { profile, setProfile } = useUserStore()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)   // הוצגה אחרי סימון מוצלח

  // האם החשבון כבר מתוזמן למחיקה?
  const scheduledAt = profile?.deletionScheduledAt || null
  const isScheduled = scheduledAt && scheduledAt > Date.now()

  const refreshProfile = async () => {
    try { const fresh = await getUser(uid); if (fresh) setProfile(fresh) } catch {}
  }

  const handleConfirmDelete = async () => {
    setBusy(true)
    const res = await scheduleAccountDeletion(uid)
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) {
      await refreshProfile()
      setDone(true)
    }
  }

  const handleCancel = async () => {
    setBusy(true)
    await cancelAccountDeletion(uid)
    setBusy(false)
    await refreshProfile()
    setDone(false)
  }

  // תאריך המחיקה הצפוי לתצוגה
  const deletionDateText = scheduledAt
    ? new Date(scheduledAt).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''

  // מצב א— החשבון כבר מתוזמן למחיקה: מציגים באנר ביטול
  if (isScheduled) {
    return (
      <>
        <SectionTitle
          icon={<span style={{ fontSize: 22 }}>⏳</span>}
          title="החשבון מתוזמן למחיקה"
          subtitle="ניתן לבטל עד מועד המחיקה"
        />
        <div style={{ ...cardStyle, border: '2px solid var(--danger)' }}>
          <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 700, lineHeight: 1.6, marginBottom: 8 }}>
            החשבון שלך מתוזמן למחיקה בתאריך:
          </div>
          <div style={{ fontSize: 17, color: 'var(--danger)', fontWeight: 800, marginBottom: 12 }}>
            {deletionDateText}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>
            שלחנו אליך מייל עם פרטים. אם שינית את דעתך — אפשר לבטל עכשיו, והחשבון יישאר פעיל כרגיל.
          </div>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="big-btn big-btn--primary"
            style={{ width: '100%', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'מבטל...' : '✕ בטל את המחיקה'}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <SectionTitle
        icon={<span style={{ fontSize: 22 }}>⚠️</span>}
        title="מחיקת חשבון"
        subtitle="הסרת החשבון וכל הנתונים"
      />
      <div style={cardStyle}>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.6, marginBottom: 16 }}>
          מחיקת החשבון תסיר את הפרופיל שלכם, התמונה, וכל הפרטים האישיים מהמערכת. המחיקה תתבצע תוך 48 שעות, ותוכלו לבטל אותה בכל רגע במהלך הזמן הזה.
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          style={{
            width: '100%', padding: '15px', borderRadius: 14,
            background: 'var(--surface)', border: '2px solid var(--danger)',
            color: 'var(--danger)', fontSize: 16, fontWeight: 800,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          מחיקת החשבון שלי
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDeleteModal
          busy={busy}
          onConfirm={handleConfirmDelete}
          onClose={() => setConfirmOpen(false)}
        />
      )}
      {done && (
        <ScheduledModal
          dateText={deletionDateText}
          onClose={() => setDone(false)}
        />
      )}
    </>
  )
}

// חלונית אישור "האם אתה בטוח?"
function ConfirmDeleteModal({ busy, onConfirm, onClose }) {
  return (
    <ModalShell>
      <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
      <div className="h-display" style={{ fontSize: 24, color: 'var(--danger)', marginBottom: 8 }}>
        למחוק את החשבון?
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.5, marginBottom: 22 }}>
        החשבון יימחק תוך 48 שעות. תקבלו מייל לכתובת שלכם, ותוכלו לבטל את המחיקה בכל רגע במהלך הזמן הזה.
      </div>
      <button onClick={onConfirm} disabled={busy} style={{
        width: '100%', padding: '15px', borderRadius: 14, marginBottom: 10,
        background: 'var(--danger)', border: 'none', color: '#fff',
        fontSize: 16, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
        opacity: busy ? 0.7 : 1,
      }}>
        {busy ? 'מעבד...' : 'כן, מחק את החשבון'}
      </button>
      <button onClick={onClose} disabled={busy} className="big-btn big-btn--ghost" style={{ width: '100%' }}>
        ביטול
      </button>
    </ModalShell>
  )
}

// חלונית אישור — המחיקה תוזמנה
function ScheduledModal({ dateText, onClose }) {
  return (
    <ModalShell>
      <div style={{ fontSize: 52, marginBottom: 12 }}>📨</div>
      <div className="h-display" style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 8 }}>
        הבקשה התקבלה
      </div>
      <div style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 600, lineHeight: 1.6, marginBottom: 22 }}>
        החשבון יימחק בתאריך <strong>{dateText}</strong>. שלחנו אליך מייל עם פרטים. אם תשנה את דעתך — תוכל לבטל את המחיקה ממסך ההגדרות בכל רגע.
      </div>
      <button onClick={onClose} className="big-btn big-btn--primary" style={{ width: '100%' }}>
        הבנתי
      </button>
    </ModalShell>
  )
}

// מעטפת מודל קבועה
function ModalShell({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,15,8,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 24, direction: 'rtl',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24,
        padding: '28px 24px 22px', maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {children}
      </div>
    </div>
  )
}
