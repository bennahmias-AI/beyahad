// src/stores/sessionStore.js
import { create } from 'zustand'

export const useSessionStore = create((set) => ({
  // Active cafe session
  cafeSession: null,
  cafePartner: null,
  livekitToken: null,
  livekitRoom: null,

  setCafeSession: (session) => set({ cafeSession: session }),
  setCafePartner: (partner) => set({ cafePartner: partner }),
  setLivekit: ({ token, room }) => set({ livekitToken: token, livekitRoom: room }),

  clearCafe: () => set({
    cafeSession: null,
    cafePartner: null,
    livekitToken: null,
    livekitRoom: null,
  }),

  // Active parliament session
  parliamentSession: null,
  parliamentToken: null,
  parliamentRoom: null,

  setParliamentSession: (session) => set({ parliamentSession: session }),
  setParliamentLivekit: ({ token, room }) => set({ parliamentToken: token, parliamentRoom: room }),

  clearParliament: () => set({
    parliamentSession: null,
    parliamentToken: null,
    parliamentRoom: null,
  }),
}))
