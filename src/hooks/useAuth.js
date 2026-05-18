// src/hooks/useAuth.js
import { useEffect } from 'react'
import { onAuthStateChanged } from '../services/firebase.js'
import { auth, getUser, setPresence, createOrUpdateUser } from '../services/firebase.js'
import { useUserStore } from '../stores/userStore.js'

export function useAuth() {
  const { setAuthUser, setProfile, setAuthLoading } = useUserStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setAuthUser(firebaseUser)
        // Load or create profile
        let profile = await getUser(firebaseUser.uid)
        if (!profile) {
          // First login — create skeleton profile
          await createOrUpdateUser(firebaseUser.uid, {
            phone: firebaseUser.phoneNumber,
            name: '',
            status: 'available',
            interests: [],
          })
          profile = await getUser(firebaseUser.uid)
        }
        setProfile(profile)
        // Mark online
        await setPresence(firebaseUser.uid, 'available')
      } else {
        setAuthUser(null)
        setProfile(null)
        setAuthLoading(false)
      }
    })

    // Mark offline on tab close
    const handleUnload = () => {
      const uid = useUserStore.getState().authUser?.uid
      if (uid) setPresence(uid, 'offline')
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      unsub()
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])
}
