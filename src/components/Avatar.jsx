// src/components/Avatar.jsx
import { avatarColor } from '../design-system/index.js'

export default function Avatar({ name = '', size = 56, color, online = false }) {
  const bg = color || avatarColor(name)
  const initials = name.split(' ').slice(0, 2).map(s => s[0]).join('')
  const fontSize = Math.round(size * 0.42)

  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize, background: bg, position: 'relative' }}
      aria-label={name}
    >
      <span>{initials}</span>
      {online && (
        <span style={{
          position: 'absolute',
          insetInlineEnd: 2, bottom: 2,
          width: size * 0.22, height: size * 0.22,
          borderRadius: '50%',
          background: '#2E7D4E',
          border: `${Math.max(2, size * 0.05)}px solid #F2E7CB`,
        }} />
      )}
    </div>
  )
}
