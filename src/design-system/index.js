export const colors = {
  bgPage: '#E5D9BD', bgApp: '#F2E7CB', surface: '#FFFAEC', surface2: '#ECDFBF',
  ink: '#1A2547', ink2: '#3B4A6B', ink3: '#6B7A92',
  line: '#D6C5A0', lineStrong: '#B89E70',
  burgundy: '#A8392A', burgundyDeep: '#6E1F13', burgundySoft: '#F2C2A8',
  teal: '#1F5A6B', tealDeep: '#0D3D4A',
  mustard: '#D9A82A', mustardDeep: '#8B6818',
  forest: '#3B6B43', forestDeep: '#1F4D2A',
  wine: '#6B2D4A', wineDeep: '#45172F',
  success: '#2E7D4E', danger: '#A8392A', live: '#C73224', gold: '#FFC857',
}

export const fonts = {
  display: "'Suez One', 'Heebo', system-ui, sans-serif",
  body: "'Heebo', system-ui, -apple-system, sans-serif",
}

const AVATAR_POOL = ['#A8392A','#3B6B43','#D9A82A','#6B2D4A','#1F5A6B','#8B4527','#4A3B6B','#806118']
export const avatarColor = (name = '') =>
  AVATAR_POOL[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % AVATAR_POOL.length]

export const shadows = {
  sm: '0 3px 0 #B89E70',
  md: '0 5px 0 #1A2547',
  lg: '0 8px 0 #1A2547',
}
