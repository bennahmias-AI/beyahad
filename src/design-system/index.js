export const colors = {
  bgPage: '#EFE8DA', bgApp: '#F6F0E3', surface: '#FBF7EE', surface2: '#EBE4D2',
  ink: '#1B2540', ink2: '#4A5274', ink3: '#8389A4',
  line: '#DDD3BE', lineStrong: '#C3B695',
  burgundy: '#7E2C2E', burgundyDeep: '#5A1D1E', burgundySoft: '#E8D0CF',
  teal: '#2C5566', tealDeep: '#173846', tealSoft: '#C8D6DC',
  mustard: '#B89048', mustardDeep: '#8A6A2E', mustardSoft: '#ECDBB6',
  forest: '#4F6B4A', forestDeep: '#354D31', forestSoft: '#D0DBC9',
  wine: '#6B3A4F', wineDeep: '#482638', wineSoft: '#DFC9D2',
  coral: '#B7634A', coralDeep: '#8C4A36',
  success: '#4F6B4A', danger: '#7E2C2E', live: '#A33B30', gold: '#B89048',
}

export const fonts = {
  display: "'Assistant', 'Rubik', system-ui, sans-serif",
  body: "'Assistant', 'Rubik', system-ui, -apple-system, sans-serif",
}

const AVATAR_POOL = ['#7E2C2E','#4F6B4A','#B89048','#6B3A4F','#2C5566','#7B4A2C','#3D3458','#7A5C18']
export const avatarColor = (name = '') =>
  AVATAR_POOL[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_POOL.length]

export const shadows = {
  sm: '0 1px 2px rgba(20,23,42,.04), 0 2px 6px rgba(20,23,42,.04)',
  md: '0 4px 14px rgba(20,23,42,.06), 0 2px 4px rgba(20,23,42,.04)',
  lg: '0 20px 40px -10px rgba(20,23,42,.18), 0 4px 12px rgba(20,23,42,.06)',
}
