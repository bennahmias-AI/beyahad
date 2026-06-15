// src/hooks/useAuth.js
import { useEffect } from 'react'
import { onAuthStateChanged } from '../services/firebase.js'
import { auth, getUser, watchUser, setPresence, createOrUpdateUser, logActivity } from '../services/firebase.js'
import { useUserStore } from '../stores/userStore.js'

// uids שכבר נרשמה להם "כניסה" בטעינת העמוד הזו (מונע רישום כפול)
const loggedLogins = new Set()

export function useAuth() {
  const { setAuthUser, setProfile, setAuthLoading } = useUserStore()

  useEffect(() => {
    let unsubUser = null   // מאזין חי למסמך המשתמש — נחתם מחדש על כל login/logout

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // ניקית מאזין קודם של הפרופיל לפני שמטפלים בכניסה/יציאה
      if (unsubUser) { try { unsubUser() } catch {} ; unsubUser = null }

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
          // לפני יצירת שלד — מוודאים שהמשתמש עדיין מחובר. אם AuthPage זיהה משתמש לא רשום
          // והתנתק בזמן שחיכינו (1.2 שניות) — לא ליצור שלד עבור חשבון שכבר לא קיים.
          if (auth.currentUser?.uid !== firebaseUser.uid) {
            return
          }
          // Still nothing — this is a genuine first login without a profile.
          // Create a skeleton, but DO NOT write an empty name (merge:true keeps
          // any name that gets written later by AuthPage).
          await createOrUpdateUser(firebaseUser.uid, {
            phone: firebaseUser.phoneNumber || '',
            status: 'available',
            interests: [],
            onboarded: false,
          })
          profile = await getUser(firebaseUser.uid)
        }

        // Sync email from Auth -> Firestore doc, so it appears in the admin board.
        // Phone-auth users have no email (skipped); email-registered users get it stored.
        if (firebaseUser.email && profile && profile.email !== firebaseUser.email) {
          try { await createOrUpdateUser(firebaseUser.uid, { email: firebaseUser.email }) } catch (e) {}
          profile = { ...profile, email: firebaseUser.email }
        }

        setProfile(profile)
        setAuthLoading(false)

        // ── מאזין חי למסמך המשתמש ──
        // כל עדכון על המסמך (pendingReturn, status, photoURL וכו'') מסונכרן מייד עם ה-store —
        // חיוני לתקנון שה-PendingReturnToast יזהה pendingReturn מיד כשהמשתמש יוצא ממשחק
        unsubUser = watchUser(firebaseUser.uid, (updated) => {
          if (updated) setProfile(updated)
        })

        // Mark online
        await setPresence(firebaseUser.uid, 'available')

        // רישום "כניסה" ביומן הפעילות — פעם אחת לכל משתמש בטעינת העמוד הזו
        if (!loggedLogins.has(firebaseUser.uid)) {
          loggedLogins.add(firebaseUser.uid)
          logActivity({ uid: firebaseUser.uid, name: profile?.name || '', type: 'login' })
        }
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
      if (unsubUser) { try { unsubUser() } catch {} }
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])
}
