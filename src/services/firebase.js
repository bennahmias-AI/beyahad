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
  doc, setDoc, getDoc, updateDoc,
  onSnapshot, serverTimestamp,
  collection, query, where, getDocs,
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
  // Re-create verifier fresh every time to avoid stale state
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

// ─── Cafe sessions ────────────────────────────────────────────

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

// ─── LiveKit token ────────────────────────────────────────────

export async function fetchLiveKitToken(room, participantName) {
  const url = import.meta.env.VITE_LIVEKIT_TOKEN_URL
  if (!url) throw new Error('VITE_LIVEKIT_TOKEN_URL not set')
  const res = await fetch(`${url}?room=${encodeURIComponent(room)}&username=${encodeURIComponent(participantName)}`)
  if (!res.ok) throw new Error('Token fetch failed: ' + res.status)
  const data = await res.json()
  return data.token
}
