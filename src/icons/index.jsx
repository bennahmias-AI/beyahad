// src/icons/index.jsx
// אייקונים פשוטים, ידידותיים, מבוססי-קו. כולם מקבלים size + color.

function Icon({ size = 28, color = 'currentColor', children, viewBox = '0 0 24 24' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none"
         stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export const IconPhone = (p) => (
  <Icon {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z"/>
  </Icon>
)

export const IconVideo = (p) => (
  <Icon {...p}>
    <path d="m22 8-6 4 6 4V8Z"/>
    <rect x="2" y="6" width="14" height="12" rx="2"/>
  </Icon>
)

export const IconUsers = (p) => (
  <Icon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </Icon>
)

export const IconBook = (p) => (
  <Icon {...p}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </Icon>
)

export const IconHeart = (p) => (
  <Icon {...p}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </Icon>
)

export const IconMic = (p) => (
  <Icon {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M19 10a7 7 0 0 1-14 0"/>
    <line x1="12" y1="17" x2="12" y2="22"/>
  </Icon>
)

export const IconMicOff = (p) => (
  <Icon {...p}>
    <line x1="2" y1="2" x2="22" y2="22"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
    <path d="M5 10v2a7 7 0 0 0 12 5"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </Icon>
)

export const IconSpeaker = (p) => (
  <Icon {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </Icon>
)

export const IconMusic = (p) => (
  <Icon {...p}>
    <path d="M9 18V5l12-2v13"/>
    <circle cx="6" cy="18" r="3"/>
    <circle cx="18" cy="16" r="3"/>
  </Icon>
)

export const IconHome = (p) => (
  <Icon {...p}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </Icon>
)

export const IconBack = (p) => (
  <Icon {...p}>
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </Icon>
)

export const IconBackRTL = (p) => (
  <Icon {...p}>
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </Icon>
)

export const IconBell = (p) => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </Icon>
)

export const IconPlay = (p) => (
  <Icon {...p}>
    <polygon points="5 3 19 12 5 21 5 3"/>
  </Icon>
)

export const IconPause = (p) => (
  <Icon {...p}>
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </Icon>
)

export const IconCheck = (p) => (
  <Icon {...p}>
    <polyline points="20 6 9 17 4 12"/>
  </Icon>
)

export const IconX = (p) => (
  <Icon {...p}>
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </Icon>
)

export const IconClock = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </Icon>
)

export const IconPhoneEnd = (p) => (
  <Icon {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92Z"/>
  </Icon>
)

export const IconCoffee = (p) => (
  <Icon {...p}>
    <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
    <line x1="6" y1="2" x2="6" y2="5"/>
    <line x1="10" y1="2" x2="10" y2="5"/>
    <line x1="14" y1="2" x2="14" y2="5"/>
  </Icon>
)

export const IconPodium = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="2.5"/>
    <path d="M9 9h6a2 2 0 0 1 2 2v3H7v-3a2 2 0 0 1 2-2Z"/>
    <line x1="12" y1="14" x2="12" y2="22"/>
    <line x1="8" y1="22" x2="16" y2="22"/>
  </Icon>
)

export const IconLightbulb = (p) => (
  <Icon {...p}>
    <path d="M9 21h6"/>
    <path d="M10 17h4"/>
    <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.2V17h6v-1.3c0-.8.4-1.6 1-2.2A6 6 0 0 0 12 3Z"/>
  </Icon>
)

export const IconHourglass = (p) => (
  <Icon {...p}>
    <path d="M6 3h12"/><path d="M6 21h12"/>
    <path d="M6 3v3c0 2 2 3 3 4l3 2 3-2c1-1 3-2 3-4V3"/>
    <path d="M6 21v-3c0-2 2-3 3-4l3-2 3 2c1 1 3 2 3 4v3"/>
  </Icon>
)
