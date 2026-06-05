// src/stores/radioStore.js
// ─────────────────────────────────────────────────────────────
// State גלובלי לרדיו האונליין. חי ברמת האפליקציה כדי שהנגן ימשיך
// לנגן גם כשעוברים בין דפים.
//
//   station   — התחנה המתנגנת כרגע { id, name, url, favicon, country, tags } או null
//   playing   — האם מתנגן עכשיו
//   volume    — עוצמת קול 0..1
//   loading   — האם התחנה בטעינה (buffering)
//   favorites — רשימת תחנות מועדפות (נשמר ב-localStorage)
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { useUserStore } from './userStore.js'
import { logActivity } from '../services/firebase.js'

const FAV_KEY = 'beyahad_radio_favorites'

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFavorites(favs) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)) } catch {}
}

export const useRadioStore = create((set, get) => ({
  station: null,
  playing: false,
  volume: 0.8,
  loading: false,
  favorites: loadFavorites(),

  // בוחרים תחנה חדשה ומנגנים אותה
  playStation: (station) => {
    set({ station, playing: true, loading: true })
    // רישום לבקרת הניהול — מי האזין ולאיזו תחנה (best-effort)
    try {
      const { authUser, profile } = useUserStore.getState()
      if (authUser?.uid && station?.name) {
        logActivity({ uid: authUser.uid, name: profile?.name || '', type: 'radio', detail: station.name })
      }
    } catch { /* לעולם לא חוסם נגינה */ }
  },

  // עצירה / המשך של התחנה הנוכחית
  togglePlay: () => set(s => ({ playing: s.station ? !s.playing : false })),
  setPlaying: (playing) => set({ playing }),
  setLoading: (loading) => set({ loading }),
  setVolume: (volume) => set({ volume }),

  // עצירה מלאה (סגירת הנגן)
  stop: () => set({ station: null, playing: false, loading: false }),

  // מועדפים — toggle
  toggleFavorite: (station) => {
    const favs = get().favorites
    const exists = favs.find(f => f.id === station.id)
    const next = exists
      ? favs.filter(f => f.id !== station.id)
      : [...favs, station]
    saveFavorites(next)
    set({ favorites: next })
  },

  isFavorite: (id) => Boolean(get().favorites.find(f => f.id === id)),
}))
