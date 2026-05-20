import { initializeApp } from 'firebase/app'
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
  collection, query, where, getDocs, orderBy, limit,
  addDoc,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// ─── Auth ─────────────────────────────────────────────────────

export function setupRecaptcha(containerId) {
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear() } catch(e) {}
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {},
    'error-callback': () => {},
  })
  return window.recaptchaVerifier
}

export async function sendOtp(phone) {
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear() } catch(e) {}
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
  })
  await window.recaptchaVerifier.render()
  const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
  window.confirmationResult = result
  return result
}

export async function verifyOtp(code) {
  return window.confirmationResult.confirm(code)
}

export const signOut = () => fbSignOut(auth)
export { onAuthStateChanged }

// ─── User profile ─────────────────────────────────────────────

export async function createOrUpdateUser(uid, data) {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export function watchUser(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
  })
}

export async function setPresence(uid, status) {
  try {
    await updateDoc(doc(db, 'users', uid), { status, lastSeenAt: serverTimestamp() })
  } catch(e) { /* ignore if doc doesn't exist yet */ }
}

export async function getAvailableUsers(myUid, blocked = []) {
  const q = query(collection(db, 'users'), where('status', '==', 'available'))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== myUid && !blocked.includes(u.id))
}

export function watchAvailableUsers(myUid, cb, blocked = []) {
  const q = query(collection(db, 'users'), where('status', '==', 'available'))
  return onSnapshot(q, snap => {
    const users = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.id !== myUid && !blocked.includes(u.id))
    cb(users)
  }, err => {
    console.error('watchAvailableUsers error:', err)
  })
}

// ─── Cafe sessions ────────────────────────────────────────────

function pairRoomName(uidA, uidB) {
  const [a, b] = [uidA, uidB].sort()
  const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)
  return `kafe-${safe(a)}-${safe(b)}`
}

export async function createCafeSession(myUid, partnerUid, livekitRoom) {
  const ref = await addDoc(collection(db, 'cafeSessions'), {
    participants: [myUid, partnerUid],
    status: 'connecting',
    livekitRoom,
    startedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCafeSession(sessionId, data) {
  await updateDoc(doc(db, 'cafeSessions', sessionId), { ...data, updatedAt: serverTimestamp() })
}

export function watchCafeSession(sessionId, cb) {
  return onSnapshot(doc(db, 'cafeSessions', sessionId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
  })
}

export async function endCafeSession(sessionId) {
  await updateDoc(doc(db, 'cafeSessions', sessionId), { status: 'ended', endedAt: serverTimestamp() })
}

// ─── Cafe Matchmaking Queue ──────────────────────────────────
// Logic: when a user clicks "קפה בסלון", they join the queue.
// If there's already someone waiting → match them, both get the same room.
// If not → wait. The other user's join will match them.

export async function joinCafeQueue(uid, name) {
  // Step 1: look for someone else waiting (not me)
  const q = query(
    collection(db, 'cafeQueue'),
    where('status', '==', 'waiting'),
    orderBy('joinedAt', 'asc'),
    limit(5),
  )
  const snap = await getDocs(q)

  const otherUser = snap.docs.find(d => d.id !== uid)

  if (otherUser) {
    // Match found! Create room and update both queue entries
    const otherUid = otherUser.id
    const otherName = otherUser.data().name || 'משתמש'
    const room = pairRoomName(uid, otherUid)

    // Update the other user's entry with matched status + room
    await updateDoc(doc(db, 'cafeQueue', otherUid), {
      status: 'matched',
      matchedWith: uid,
      matchedWithName: name,
      livekitRoom: room,
      matchedAt: serverTimestamp(),
    })

    // Create my entry directly as matched
    await setDoc(doc(db, 'cafeQueue', uid), {
      name,
      status: 'matched',
      matchedWith: otherUid,
      matchedWithName: otherName,
      livekitRoom: room,
      joinedAt: serverTimestamp(),
      matchedAt: serverTimestamp(),
    })

    return { matched: true, room, partner: { id: otherUid, name: otherName } }
  } else {
    // No one waiting - join the queue
    await setDoc(doc(db, 'cafeQueue', uid), {
      name,
      status: 'waiting',
      joinedAt: serverTimestamp(),
    })
    return { matched: false }
  }
}

export function watchCafeQueueEntry(uid, cb) {
  return onSnapshot(doc(db, 'cafeQueue', uid), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  })
}

export async function leaveCafeQueue(uid) {
  try {
    await deleteDoc(doc(db, 'cafeQueue', uid))
  } catch(e) {
    console.error('leaveCafeQueue error:', e)
  }
}

// ─── Parliament sessions ───────────────────────────────

export const PARLIAMENT_ROOM = 'parliament-main'

// ─── Singing room (שירה בציבור) ─────────────────────
// A single shared room. Everyone joins freely. No turn logic —
// the special twist (everyone muted to each other) is handled
// client-side in the SingingScreen.

export const SINGING_ROOM = 'singing-main'

export async function joinParliamentSession(uid, livekitRoom) {
  const q = query(
    collection(db, 'parliamentSessions'),
    where('livekitRoom', '==', livekitRoom),
    where('status', '==', 'active'),
  )
  const snap = await getDocs(q)

  if (!snap.empty) {
    const existing = snap.docs[0]
    const data = existing.data()
    const participants = data.participants || []
    if (!participants.includes(uid)) {
      await updateDoc(doc(db, 'parliamentSessions', existing.id), {
        participants: [...participants, uid],
        updatedAt: serverTimestamp(),
      })
    }
    return existing.id
  } else {
    const ref = await addDoc(collection(db, 'parliamentSessions'), {
      participants: [uid],
      status: 'active',
      livekitRoom,
      startedAt: serverTimestamp(),
    })
    return ref.id
  }
}

// ─── Parliament discussion state sync ────────────────────────
// The discussion state (whose turn, timer, phase) is stored in the
// session doc so all participants stay perfectly in sync. The "host"
// (first participant) is the only one who writes the state forward.

export async function updateParliamentState(sessionId, discussion) {
  try {
    await updateDoc(doc(db, 'parliamentSessions', sessionId), {
      discussion,
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('updateParliamentState error:', e)
  }
}

export function watchParliamentSession(sessionId, cb) {
  return onSnapshot(doc(db, 'parliamentSessions', sessionId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  }, err => {
    console.error('watchParliamentSession error:', err)
  })
}

export async function leaveParliamentSession(sessionId, uid) {
  try {
    const snap = await getDoc(doc(db, 'parliamentSessions', sessionId))
    if (!snap.exists()) return
    const data = snap.data()
    const participants = (data.participants || []).filter(p => p !== uid)

    if (participants.length === 0) {
      await updateDoc(doc(db, 'parliamentSessions', sessionId), {
        status: 'ended',
        endedAt: serverTimestamp(),
      })
    } else {
      await updateDoc(doc(db, 'parliamentSessions', sessionId), {
        participants,
        updatedAt: serverTimestamp(),
      })
    }
  } catch(e) {
    console.error('leaveParliamentSession error:', e)
  }
}

// ─── LiveKit token ────────────────────────────────────────────

export async function fetchLiveKitToken(room, participantName) {
  const url = import.meta.env.VITE_LIVEKIT_TOKEN_URL
  if (!url) throw new Error('VITE_LIVEKIT_TOKEN_URL not set')
  const res = await fetch(`${url}?room=${encodeURIComponent(room)}&username=${encodeURIComponent(participantName)}`)
  if (!res.ok) throw new Error('Token fetch failed: ' + res.status)
  const data = await res.json()
  return data.token
}
