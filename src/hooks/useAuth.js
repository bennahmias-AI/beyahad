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

        // Try to load the profile. Retry a few times — on first registration,
        // AuthPage writes the profile (with the real name) at roughly the same
        // moment this runs. We wait briefly so we don't race it and overwrite
        // the real name with a blank skeleton.
        let profile = await getUser(firebaseUser.uid)

        if (!profile) {
          // Wait a moment and retry — AuthPage may still be writing the profile
          await new Promise(r => setTimeout(r, 1200))
          profile = await getUser(firebaseUser.uid)
        }

        if (!profile) {
          // Still nothing — this is a genuine first login without a profile.
          // Create a skeleton, but DO NOT write an empty name (merge:true keeps
          // any name that gets written later by AuthPage).
          await createOrUpdateUser(firebaseUser.uid, {
            phone: firebaseUser.phoneNumber || '',
            status: 'available',
            interests: [],
          })
          profile = await getUser(firebaseUser.uid)
        }

        setProfile(profile)
        setAuthLoading(false)

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
