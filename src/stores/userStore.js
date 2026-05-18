// src/stores/userStore.js
import { create } from 'zustand'

export const useUserStore = create((set, get) => ({
  // Firebase auth user (uid, phoneNumber)
  authUser: null,
  // Full profile from Firestore
  profile: null,
  // loading states
  authLoading: true,

  setAuthUser: (authUser) => set({ authUser, authLoading: false }),
  setProfile:  (profile)  => set({ profile }),
  setAuthLoading: (v)     => set({ authLoading: v }),

  // Convenience
  get uid()  { return get().authUser?.uid },
  get name() { return get().profile?.name || 'אורח' },
  get isLoggedIn() { return !!get().authUser },

  reset: () => set({ authUser: null, profile: null, authLoading: false }),
}))
