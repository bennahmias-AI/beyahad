import { initializeApp } from 'firebase/app'
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  onAuthStateChanged,
  deleteUser,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithCustomToken,
} from 'firebase/auth'
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp,
  collection, query, where, getDocs, orderBy, limit,
  addDoc, arrayUnion,
} from 'firebase/firestore'
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL,
} from 'firebase/storage'
import {
  getMessaging, getToken, onMessage, isSupported as isMessagingSupported,
} from 'firebase/messaging'
import { Capacitor } from '@capacitor/core'

// מאגר המתכונים לדוגמה (מקור אמת אחד, משמש גם את סקריפט התמונות)
import { SEED_RECIPES, SEED_AUTHORS } from '../data/seedRecipes.js'

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
export const storage = getStorage(app)

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

// אימות טלפון נייטיב (Capacitor)
// בתוך האפליקציה הנייטיב, reCAPTCHA של הדפדפן לא עובד; לכן משתמשים
// בתוסף @capacitor-firebase/authentication שמבצע אימות מכשיר דרך Play
// Integrity ושולח SMS. מקבלים ממנו verificationId, ואז מתחברים ל-JS SDK
// עם PhoneAuthProvider.credential — כך שמצב ההתחברות (auth) נשאר מקור
// האמת היחיד של האפליקציה (בדיוק כמו בדפדפן).
function isNativePlatform() {
  try { return Capacitor?.isNativePlatform?.() === true } catch { return false }
}

let _nativeVerificationId = null

async function sendOtpNative(phoneE164) {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication')
  _nativeVerificationId = null
  return new Promise((resolve, reject) => {
    let sentHandle, failHandle, settled = false, timer = null
    const cleanup = async () => {
      if (timer) clearTimeout(timer)
      try { await sentHandle?.remove?.() } catch {}
      try { await failHandle?.remove?.() } catch {}
    }
    const finish = async (fn) => { if (settled) return; settled = true; await cleanup(); fn() }
    timer = setTimeout(() => {
      const err = new Error('timeout'); err.code = 'auth/too-many-requests'
      finish(() => reject(err))
    }, 60000)
    FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
      _nativeVerificationId = event?.verificationId || null
      finish(() => resolve({ ok: true }))
    }).then(h => { sentHandle = h })
    FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
      const err = new Error(event?.message || 'verification-failed')
      err.code = 'auth/invalid-phone-number'
      finish(() => reject(err))
    }).then(h => { failHandle = h })
    FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: phoneE164 })
      .then((result) => {
        if (result?.verificationId && !_nativeVerificationId) {
          _nativeVerificationId = result.verificationId
          finish(() => resolve({ ok: true }))
        }
      })
      .catch((e) => finish(() => reject(e)))
  })
}

async function verifyOtpNative(code) {
  if (!_nativeVerificationId) {
    const err = new Error('no-verification-id'); err.code = 'auth/missing-verification-code'
    throw err
  }
  const credential = PhoneAuthProvider.credential(_nativeVerificationId, code)
  return await signInWithCredential(auth, credential)
}

export async function sendOtp(phone) {
  // אפליקציה נייטיב — דרך התוסף הנייטיב (בלי reCAPTCHA)
  if (isNativePlatform()) return sendOtpNative(phone)
  // דפדפן — reCAPTCHA בלתי-נראה (כמו קודם).
  // יוצרים את ה-RecaptchaVerifier פעם אחת בלבד ומשתמשים בו מחדש.
  // יצירה חוזרת על אותו אלמנט זורקת "reCAPTCHA has already been rendered in this element".
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    })
  }
  const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier)
  window.confirmationResult = result
  return result
}

export async function verifyOtp(code) {
  if (isNativePlatform()) return verifyOtpNative(code)
  return window.confirmationResult.confirm(code)
}

// ─── אימות במייל (ערוץ חלופי ל-SMS) ───
// מנגנון נפרד מ-Firebase Phone Auth: שרת מייצר קוד, שולח במייל
// (דרך Resend), מאמת ומחזיר custom token שאיתו מתחברים.
// עובד רק בדפדפן/PWA (Vercel) — ה-endpoints תחת /api.

// שולח קוד אימות למייל. מחזיר { ok } או { ok:false, reason }.
//   reason: 'bad-email' = מייל לא תקין / 'too-soon' = נשלח לפני פחות מ-30 שניות.
// הקריאות הן לכתובת מלאה (לא יחסית) כדי שיעבדו גם בלוקאלהוסט וגם באפליקציה הנייטיב.
const EMAIL_API_BASE = import.meta.env.VITE_API_BASE || 'https://beyahad-gamma.vercel.app'
export async function sendEmailCode(email) {
  if (!email) return { ok: false, reason: 'bad-email' }
  try {
    const res = await fetch(`${EMAIL_API_BASE}/api/send-email-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email).trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, reason: data.reason || 'error' }
    return { ok: true }
  } catch (e) {
    console.error('sendEmailCode error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מאמת קוד שהגיע במייל ומתחבר (signInWithCustomToken).
// מחזיר { ok, uid } או { ok:false, reason }.
//   reason: 'wrong-code' / 'expired' / 'too-many-attempts' / 'used' / 'no-code'.
export async function verifyEmailCode(email, code) {
  if (!email || !code) return { ok: false, reason: 'missing' }
  try {
    const res = await fetch(`${EMAIL_API_BASE}/api/verify-email-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email).trim(), code: String(code).trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) return { ok: false, reason: data.reason || 'error' }
    // מתחברים עם ה-custom token שהשרת החזיר
    await signInWithCustomToken(auth, data.token)
    return { ok: true, uid: data.uid }
  } catch (e) {
    console.error('verifyEmailCode error:', e)
    return { ok: false, reason: 'error' }
  }
}

export const signOut = () => fbSignOut(auth)
export { onAuthStateChanged }

// ─── אימות דו-שלבי לאדמין (מייל+סיסמה כגורם שני מעל טלפון+SMS) ──
// בודק אם לחשבון המחובר כבר מקושרת זהות מייל+סיסמה (provider 'password').
export function adminHasEmailFactor() {
  const u = auth.currentUser
  return !!u && (u.providerData || []).some(p => p.providerId === 'password')
}

// הגדרה חד-פעמית: מקשר מייל+סיסמה לחשבון המנהל המחובר (בטלפון). זורק בכשל.
export async function linkAdminEmail(email, password) {
  const cred = EmailAuthProvider.credential(email, password)
  await linkWithCredential(auth.currentUser, cred)
}

// אימות הגורם השני: מאמת מחדש את המנהל המחובר מול המייל+סיסמה שלו.
// נכשל אם הפרטים שגויים או שייכים לחשבון אחר — בלי לשבש את ה-session. זורק בכשל.
export async function verifyAdminEmail(email, password) {
  const cred = EmailAuthProvider.credential(email, password)
  await reauthenticateWithCredential(auth.currentUser, cred)
}

// ─── User profile ─────────────────────────────────────────────

// גלריית תמונות אישית (תת-אוסף users/{uid}/gallery, עד 6 תמונות).
// כל תמונה במסמך נפרד כדי לא לתפוח את מסמך המשתמש (מגבלת 1MB למסמך).
const GALLERY_MAX = 6

export async function getGallery(uid) {
  if (!uid) return []
  const snap = await getDocs(query(collection(db, 'users', uid, 'gallery'), orderBy('createdAt', 'asc')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addGalleryPhoto(uid, dataURL) {
  const existing = await getDocs(collection(db, 'users', uid, 'gallery'))
  if (existing.size >= GALLERY_MAX) throw new Error('gallery-full')
  const ref = await addDoc(collection(db, 'users', uid, 'gallery'), { dataURL, createdAt: serverTimestamp() })
  return ref.id
}

export async function removeGalleryPhoto(uid, photoId) {
  await deleteDoc(doc(db, 'users', uid, 'gallery', photoId))
}

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

// ===== ADMIN — ניהול =====
// תפקידים: 'admin' | 'premium' | 'user' (ברירת מחדל ללא שדה = 'user').
// blocked: true — משתמש חסום. האכיפה האמיתית בצד השרת נמצאת ב-firestore.rules.

// מגדיר תפקיד למשתמש.
export async function setUserRole(uid, role) {
  await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() })
}

// חוסם / משחרר משתמש.
export async function setUserBlocked(uid, blocked) {
  await updateDoc(doc(db, 'users', uid), { blocked: !!blocked, updatedAt: serverTimestamp() })
}

// ===== חסימה אישית בין משתמשים (blockedUsers) =====
// בנפרד מ-blocked (חסימה גלובלית של אדמין), כל משתמש מחזיק רשימה אישית
// blockedUsers: [uid...] של משתמשים שהוא בחר לחסום. משתמש חסום לא יופיע
// לו ברשימות (קפה/חברים), ולא יוכל לשלוח לו הודעות/לדבר איתו.
// הסינון בפועל נעשה בצד הלקוח (getAvailableUsers/watchAvailableUsers מקבלים
// את הרשימה), והכלל ב-directChats מונע הודעות הדדיות.

// חוסם משתמש אחר (מוסיף ל-blockedUsers של המשתמש המחובר).
export async function blockUser(myUid, targetUid) {
  if (!myUid || !targetUid || myUid === targetUid) return { ok: false, reason: 'bad-args' }
  try {
    await updateDoc(doc(db, 'users', myUid), {
      blockedUsers: arrayUnion(targetUid),
      updatedAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    console.error('blockUser error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מבטל חסימה אישית (מסיר מ-blockedUsers).
export async function unblockUser(myUid, targetUid) {
  if (!myUid || !targetUid) return { ok: false, reason: 'bad-args' }
  try {
    const snap = await getDoc(doc(db, 'users', myUid))
    const list = (snap.exists() && snap.data().blockedUsers) || []
    await updateDoc(doc(db, 'users', myUid), {
      blockedUsers: list.filter(u => u !== targetUid),
      updatedAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    console.error('unblockUser error:', e)
    return { ok: false, reason: 'error' }
  }
}

// בודק אם targetUid חסום ע"י המשתמש המחובר (בדיקה חד-פעמית).
export async function isUserBlockedByMe(myUid, targetUid) {
  if (!myUid || !targetUid) return false
  try {
    const snap = await getDoc(doc(db, 'users', myUid))
    const list = (snap.exists() && snap.data().blockedUsers) || []
    return list.includes(targetUid)
  } catch (e) {
    return false
  }
}

// ===== דיווחים (reports) =====
// משתמש מדווח על משתמש אחר או על תוכן פוגעני. הדיווח נשמר באוסף reports
// שרק אדמין קורא (נאכף ב-firestore.rules). האדמין רואה את כל הדיווחים
// בפאנל הניהול ויכול לטפל (לחסום משתמש / למחוק תוכן / לסמן כטופל).
//   reports/{id}: { reporterUid, reporterName, targetType, targetId,
//                   targetName, reason, note, status, createdAt }
//   targetType: 'user' | 'tip' | 'recipe'
//   reason: 'offensive' | 'harassment' | 'spam' | 'other'
//   status: 'open' | 'resolved'
export async function submitReport({ reporterUid, reporterName, targetType, targetId, targetName, reason, note }) {
  if (!reporterUid || !targetType || !targetId) return { ok: false, reason: 'bad-args' }
  try {
    await addDoc(collection(db, 'reports'), {
      reporterUid,
      reporterName: reporterName || '',
      targetType,
      targetId,
      targetName: targetName || '',
      reason: reason || 'other',
      note: String(note || '').slice(0, 500),
      status: 'open',
      createdAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    console.error('submitReport error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מאזין לכל הדיווחים (לפאנל הניהול) — החדשים קודם. רק אדמין (נאכף בכללים).
export function watchReports(cb) {
  return onSnapshot(collection(db, 'reports'), snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => {
      const am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0
      const bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0
      return bm - am
    })
    cb(list)
  }, err => {
    console.error('watchReports error:', err)
    cb([])
  })
}

// מסמן דיווח כטופל (status: 'resolved'). רק אדמין.
export async function resolveReport(reportId) {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
    })
    return { ok: true }
  } catch (e) {
    console.error('resolveReport error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מוחק דיווח לגמרי (אחרי טיפול). רק אדמין.
export async function deleteReport(reportId) {
  try {
    await deleteDoc(doc(db, 'reports', reportId))
    return { ok: true }
  } catch (e) {
    console.error('deleteReport error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מאזין למספר הדיווחים הפתוחים (status=='open') — למונה בפאנל. רק אדמין.
export function watchOpenReportsCount(cb) {
  const qy = query(collection(db, 'reports'), where('status', '==', 'open'))
  return onSnapshot(qy, snap => cb(snap.size), err => {
    console.error('watchOpenReportsCount error:', err)
    cb(0)
  })
}

// מגדיר/מעדכן מספר טלפון למשתמש קיים — דרך צד-שרת (Admin SDK).
// מצמיד את הטלפון לחשבון ה-Auth הקיים, כך שכניסה ב-SMS תכניס אותו
// לחשבון הזה (שומר על ה-uid, המידע וההרשאות). דורש שהקורא יהיה אדמין.
// מחזיר { ok, phone } בהצלחה, או { ok:false, reason } בכשל.
//   reason: 'phone-taken' = המספר כבר שייך לחשבון אחר (למשל חשבון בדיקה).
export async function adminSetUserPhone(uid, phone) {
  if (!uid || !phone) return { ok: false, reason: 'missing' }
  try {
    const idToken = await auth.currentUser.getIdToken()
    const res = await fetch('/api/set-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ uid, phone }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, reason: data.reason || 'error' }
    return data
  } catch (e) {
    console.error('adminSetUserPhone error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מגדיר/מעדכן מייל למשתמש קיים — דרך צד-שרת (Admin SDK). תאום
// ל-adminSetUserPhone. מעדכן את המייל גם בחשבון ה-Auth וגם במסמך users,
// כך שכניסה בקוד-מייל תמצא את המשתמש. דורש שהקורא יהיה אדמין.
// מחזיר { ok, email } בהצלחה, או { ok:false, reason } בכשל.
//   reason: 'email-taken' = המייל כבר שייך לחשבון אחר / 'bad-email' = מייל לא תקין.
export async function adminSetUserEmail(uid, email) {
  if (!uid || !email) return { ok: false, reason: 'missing' }
  try {
    const idToken = await auth.currentUser.getIdToken()
    const res = await fetch('/api/set-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ uid, email }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, reason: data.reason || 'error' }
    return data
  } catch (e) {
    console.error('adminSetUserEmail error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מאזין לכל המשתמשים (חי — לבורד הניהול). מוגן בצד השרת שרק אדמין יקבל את כל המסמכים.
export function watchAllUsers(cb) {
  return onSnapshot(collection(db, 'users'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, err => {
    console.error('watchAllUsers error:', err)
    cb([])
  })
}

// שליפה חד-פעמית של כל המשתמשים (לייצוא CSV).
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// שליפה חד-פעמית של כל פוסטי הקהילה (לסטטיסטיקות וייצוא).
export async function getAllCommunityPosts() {
  const snap = await getDocs(collection(db, 'communityPosts'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// סטטיסטיקות פעילות לבורד הניהול — קפה בסלון + פרלמנט.
// סופר "היום" לפי startedAt. כל אוסף נספר בנפרד כך שכשל באחד
// (למשל הרשאות) לא מאפס את השני. דורש שהכללים יתירו לאדמין לקרוא.
export async function getActivityStats() {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()
  const tally = async (col) => {
    try {
      const snap = await getDocs(collection(db, col))
      let today = 0
      snap.docs.forEach(d => {
        const ts = d.data().startedAt
        const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0
        if (ms >= todayMs) today++
      })
      return { total: snap.size, today }
    } catch (e) {
      console.error(`getActivityStats ${col}:`, e)
      return { total: 0, today: 0 }
    }
  }
  const [cafe, parl] = await Promise.all([tally('cafeSessions'), tally('parliamentSessions')])
  return {
    cafeToday: cafe.today, cafeTotal: cafe.total,
    parliamentToday: parl.today, parliamentTotal: parl.total,
  }
}

// ===== יומן פעילות (activityLog) =====
// כל אירוע משמעותי נרשם עם חותמת זמן, כדי שהמנהל יוכל לבדוק
// פעילות לפי טווח תאריכים. נאסף מרגע ההוספה ואילך (אין מידע רטרואקטיבי).
//   activityLog/{id}: { uid, name, type, detail, ts }
//   type: 'login' | 'cafe' | 'parliament' | 'singing' | 'game'
export async function logActivity({ uid, name, type, detail }) {
  if (!uid || !type) return
  try {
    await addDoc(collection(db, 'activityLog'), {
      uid,
      name: name || '',
      type,
      detail: detail || '',
      ts: serverTimestamp(),
    })
  } catch (e) {
    // best-effort — רישום פעילות לעולם לא חוסם את הזרימה
  }
}

// ספירת שיחות קפה + פרלמנט בטווח תאריכים [fromMs, toMs].
// משתמש באוספים שנשמרים (יש להם היסטוריה אמיתית גם אחורה).
export async function getActivityInRange(fromMs, toMs) {
  const from = new Date(fromMs), to = new Date(toMs)
  const tally = async (col) => {
    try {
      const qy = query(
        collection(db, col),
        where('startedAt', '>=', from),
        where('startedAt', '<=', to),
      )
      const snap = await getDocs(qy)
      return snap.size
    } catch (e) {
      console.error(`getActivityInRange ${col}:`, e)
      return 0
    }
  }
  const [cafe, parliament] = await Promise.all([tally('cafeSessions'), tally('parliamentSessions')])
  return { cafe, parliament }
}

// שליפת יומן הפעילות בטווח תאריכים — החדש ביותר קודם.
// שאילתת טווח על שדה יחיד (ts) + מיון על אותו שדה — ללא composite index.
export async function getActivityLog(fromMs, toMs, max = 400) {
  try {
    const qy = query(
      collection(db, 'activityLog'),
      where('ts', '>=', new Date(fromMs)),
      where('ts', '<=', new Date(toMs)),
      orderBy('ts', 'desc'),
      limit(max),
    )
    const snap = await getDocs(qy)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) {
    console.error('getActivityLog error:', e)
    return []
  }
}

// שליפת יומן הפעילות של משתמש ספציפי בטווח תאריכים.
// כדי לא לדרוש composite index (uid + ts), מסננים לפי uid בצד הלקוח
// על תוצאת שאילתת הטווח. max גבוה יותר כי מסננים אחרי השליפה.
export async function getActivityLogForUser(uid, fromMs, toMs, max = 800) {
  if (!uid) return []
  try {
    const qy = query(
      collection(db, 'activityLog'),
      where('ts', '>=', new Date(fromMs)),
      where('ts', '<=', new Date(toMs)),
      orderBy('ts', 'desc'),
      limit(max),
    )
    const snap = await getDocs(qy)
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.uid === uid)
  } catch (e) {
    console.error('getActivityLogForUser error:', e)
    return []
  }
}

// ===== התראות ניהול / מערכת (notifications) =====
// אוסף שאליו מנהל כותב התראה אישית למשתמש (אישור/דחיית
// תוכן, או הודעה מההנהלה). המשתמש קורא רק את אלו שמיועדות לו (toUid).
//   notifications/{id}: { toUid, type, title, body, createdAt }
export async function sendUserNotification({ toUid, type, title, body }) {
  if (!toUid) return
  try {
    await addDoc(collection(db, 'notifications'), {
      toUid,
      type: type || 'admin',
      title: title || '',
      body: body || '',
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('sendUserNotification error:', e)
  }
}

// מאזין להתראות המערכת/ניהול של המשתמש (לפעמון). מיון בצד הלקוח.
export function watchMyNotifications(myUid, cb) {
  const qy = query(collection(db, 'notifications'), where('toUid', '==', myUid))
  return onSnapshot(qy, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, err => {
    console.error('watchMyNotifications error:', err)
    cb([])
  })
}

// מחיקת משתמש ע"י מנהל — מוחק את מסמך המשתמש (פרופיל + נתונים).
// הערה: מחיקת חשבון ה-Auth עצמו דורשת פונקציית שרת (Admin SDK); מהלקוח
// אפשר רק להסיר את המסמך. לחסימה קבועה עדיף setUserBlocked.
export async function adminDeleteUser(uid) {
  if (!uid) return
  await deleteDoc(doc(db, 'users', uid))
}

// מחיקת חשבון (הזכות להישכח) — עם תקופת צינון של 48 שעות.
//
// כדי להגן על משתמשים (במיוחד מבוגרים) מלחיצה בטעות, אנחנו לא מוחקים
// מיד. במקום זה מסמנים את החשבון כ"מתוזמן למחיקה" עם חותמת זמן.
// במהלך 48 השעות המשתמש יכול להיכנס ולבטל. אחרי 48 שעות, פונקציית
// שרת (Cloud Function מתוזמנת) אמורה למחוק את החשבון בפועל ולשלוח
// מייל אישור.
//
// ⚠️ צד-שרת שעדיין צריך להיבנות (דורש Blaze + Cloud Functions):
//   1. Scheduled Function שרצה כל כמה שעות, מוצאת users עם
//      deletionScheduledAt שעבר, ומוחקת את המסמך + את ה-Auth user
//      (admin.auth().deleteUser) + נתונים קשורים.
//   2. שליחת מייל: כשמסמנים למחיקה — מייל "חשבונך יימחק בעוד 48 שעות,
//      להלן קישור לביטול"; וכשנמחק בפועל — מייל אישור.
// עד שהשרת ייבנה — הסימון נשמר והמשתמש יכול לבטל, אבל המחיקה
// בפועל לא תתבצע אוטומטית.

const DELETION_GRACE_MS = 48 * 60 * 60 * 1000   // 48 שעות

// מסמן את החשבון למחיקה בעוד 48 שעות. מחזיר את חותמת הזמן הסופית (ms).
export async function scheduleAccountDeletion(uid) {
  if (!uid) return { ok: false, reason: 'no-uid' }
  const scheduledAt = Date.now() + DELETION_GRACE_MS
  try {
    await updateDoc(doc(db, 'users', uid), {
      deletionScheduledAt: scheduledAt,
      deletionRequestedAt: Date.now(),
      // status: 'available' עדיין — אבל מסומן למחיקה. נכבה נראות בזמן הצינון.
    })
    return { ok: true, scheduledAt }
  } catch (e) {
    console.error('scheduleAccountDeletion error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מבטל מחיקה מתוזמנת — מסיר את הסימון.
export async function cancelAccountDeletion(uid) {
  if (!uid) return { ok: false, reason: 'no-uid' }
  try {
    await updateDoc(doc(db, 'users', uid), {
      deletionScheduledAt: null,
      deletionRequestedAt: null,
    })
    return { ok: true }
  } catch (e) {
    console.error('cancelAccountDeletion error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מחיקה מיידית ומלאה — לשימוש פנימי / לעתיד (כשיוחלט למחוק מיד).
// מוחק את מסמך המשתמש ואת המידע המזוהה איתו, ולבסוף את משתמש ה-Auth.
// הערה: מחיקת Auth user דורשת התחברות טריה (recent login).
export async function deleteUserAccount(uid) {
  if (!uid) return { ok: false, reason: 'no-uid' }
  // שלב 1 — מוחקים את מסמך המשתמש (הפרופיל וכל הנתונים האישיים)
  try {
    await deleteDoc(doc(db, 'users', uid))
  } catch (e) {
    console.error('deleteUserAccount: failed to delete user doc:', e)
  }
  // שלב 2 — ניקוי תור הקפה אם נתקע (best-effort)
  try {
    await deleteDoc(doc(db, 'cafeQueue', uid))
  } catch { /* אין רשומה — בסדר */ }
  // שלב 3 — מוחקים את משתמש ה-Auth עצמו
  try {
    const user = auth.currentUser
    if (user && user.uid === uid) {
      await deleteUser(user)
    }
    return { ok: true }
  } catch (e) {
    console.error('deleteUserAccount: failed to delete auth user:', e)
    if (e?.code === 'auth/requires-recent-login') {
      return { ok: false, reason: 'requires-recent-login' }
    }
    return { ok: false, reason: 'error' }
  }
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
    .filter(u => u.id !== myUid && !blocked.includes(u.id) && !u.deletionScheduledAt)
}

export function watchAvailableUsers(myUid, cb, blocked = []) {
  const q = query(collection(db, 'users'), where('status', '==', 'available'))
  return onSnapshot(q, snap => {
    const users = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.id !== myUid && !blocked.includes(u.id) && !u.deletionScheduledAt)
    cb(users)
  }, err => {
    console.error('watchAvailableUsers error:', err)
  })
}

// Watch the LIVE count of everyone currently in the app.
// Counts only users whose `lastSeenAt` is fresh (within the last
// 2 minutes) — this avoids "ghost" users whose status got stuck on
// 'available' because they closed the browser abruptly.
const ONLINE_WINDOW_MS = 2 * 60 * 1000   // 2 minutes

export function watchOnlineCount(cb) {
  const q = query(
    collection(db, 'users'),
    where('status', 'in', ['available', 'busy']),
  )
  return onSnapshot(q, snap => {
    const now = Date.now()
    let live = 0
    snap.docs.forEach(d => {
      const data = d.data()
      const seen = data.lastSeenAt
      // lastSeenAt is a Firestore Timestamp — convert to millis
      const seenMs = seen && typeof seen.toMillis === 'function'
        ? seen.toMillis()
        : 0
      if (seenMs && (now - seenMs) < ONLINE_WINDOW_MS) {
        live++
      }
    })
    cb(live)
  }, err => {
    console.error('watchOnlineCount error:', err)
    cb(0)
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

// ─── Community posts — tips & recipes (קהילה) ────────────────
// Collection 'communityPosts'. Each doc:
//   { kind: 'tip' | 'recipe', title, body, authorUid, authorName,
//     views, likes: [uid...], createdAt }

export async function createCommunityPost({ kind, title, body, recipe, photos, category, authorUid, authorName, approved = false }) {
  const data = {
    kind,
    title: (title || '').trim(),
    body: (body || '').trim(),
    authorUid,
    authorName: authorName || 'משתמש',
    category: category || 'other',
    approved: !!approved,   // משתמש רגיל → false (ממתין לאישור); אדמין → true
    views: 0,
    likes: [],
    createdAt: serverTimestamp(),
  }
  if (kind === 'recipe') {
    data.cooked = []
    data.photos = Array.isArray(photos) ? photos.slice(0, 3) : []
    if (recipe) {
      data.recipe = {
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(Boolean) : [],
        steps: Array.isArray(recipe.steps) ? recipe.steps.filter(Boolean) : [],
        cookTime: (recipe.cookTime || '').trim(),
      }
    }
  }
  const ref = await addDoc(collection(db, 'communityPosts'), data)
  return ref.id
}

// ===== MODERATION — אישור תוכן קהילה =====
// פוסט חדש של משתמש רגיל נשמר עם approved:false (ממתין). רק אדמין
// מאשר (setPostApproval) — נאכף גם בכללי Firestore. תוכן ותיק/seed ללא
// השדה נחשב מאושר (תאימות לאחור), ולכן מסונן בצד הלקוח לפי approved !== false.

// מאשר / מבטל אישור של פוסט (רק אדמין — מאוכף בכללים).
export async function setPostApproval(postId, approved) {
  await updateDoc(doc(db, 'communityPosts', postId), {
    approved: !!approved,
    updatedAt: serverTimestamp(),
  })
}

// מאזין לכל הפוסטים הממתינים לאישור (approved == false).
// משמש את תור הניהול ואת מונה הפעמון. שאילתה פשוטה (where יחיד) +
// מיון בצד הלקוח — כדי לא לדרוש composite index.
export function watchPendingPosts(cb) {
  const qy = query(collection(db, 'communityPosts'), where('approved', '==', false))
  return onSnapshot(qy, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => {
      const am = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0
      const bm = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0
      return bm - am
    })
    cb(list)
  }, err => {
    console.error('watchPendingPosts error:', err)
    cb([])
  })
}

// uploadRecipePhoto — מעלה תמונת מתכון ל-Storage ומחזיר URL
export async function uploadRecipePhoto({ uid, blob }) {
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const path = `recipePhotos/${uid || 'anon'}/${fileId}.jpg`
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' })
  return await getDownloadURL(fileRef)
}

// toggleRecipeCooked — סימון/ביטול "הכנתי את המתכון" (toggle)
export async function toggleRecipeCooked(postId, uid) {
  try {
    const ref = doc(db, 'communityPosts', postId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const cooked = snap.data().cooked || []
    const next = cooked.includes(uid)
      ? cooked.filter(u => u !== uid)
      : [...cooked, uid]
    await updateDoc(ref, { cooked: next })
  } catch (e) {
    console.error('toggleRecipeCooked error:', e)
  }
}

// updateCommunityPost — עדכון פוסט קיים.
// resetApproval=true → מחזיר את הפוסט ל"ממתין לאישור" (משתמש רגיל שעורך).
// אדמין שעורך מעביר resetApproval=false כדי שהפוסט יישאר מאושר.
// (הרשאות נאכפות גם בכללי Firestore: מחבר או אדמין.)
export async function updateCommunityPost(postId, { title, body, recipe, photos, category, resetApproval = false }) {
  const fields = {}
  if (title != null) fields.title = String(title).trim()
  if (body != null) fields.body = String(body).trim()
  if (category != null) fields.category = category || 'other'
  if (photos != null) fields.photos = Array.isArray(photos) ? photos.slice(0, 3) : []
  if (recipe != null) {
    fields.recipe = {
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.filter(Boolean) : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps.filter(Boolean) : [],
      cookTime: (recipe.cookTime || '').trim(),
    }
  }
  if (resetApproval) fields.approved = false   // עריכת משתמש רגיל → חוזר לאישור
  fields.updatedAt = serverTimestamp()
  try {
    await updateDoc(doc(db, 'communityPosts', postId), fields)
  } catch (e) {
    console.error('updateCommunityPost error:', e)
    throw e
  }
}

// deleteCommunityPost — מחיקת פוסט (רק המחבר)
export async function deleteCommunityPost(postId) {
  try {
    await deleteDoc(doc(db, 'communityPosts', postId))
  } catch (e) {
    console.error('deleteCommunityPost error:', e)
    throw e
  }
}

// Live list of posts of a given kind ('tip' or 'recipe'), newest first.
export function watchCommunityPosts(kind, cb) {
  const q = query(
    collection(db, 'communityPosts'),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, err => {
    console.error('watchCommunityPosts error:', err)
    cb([])
  })
}

// Increment the view counter (called when a post is opened).
export async function incrementPostViews(postId) {
  try {
    const ref = doc(db, 'communityPosts', postId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    await updateDoc(ref, { views: (snap.data().views || 0) + 1 })
  } catch (e) {
    console.error('incrementPostViews error:', e)
  }
}

// Toggle a like on a post for the given user.
export async function togglePostLike(postId, uid) {
  try {
    const ref = doc(db, 'communityPosts', postId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const likes = snap.data().likes || []
    const next = likes.includes(uid)
      ? likes.filter(u => u !== uid)
      : [...likes, uid]
    await updateDoc(ref, { likes: next })
  } catch (e) {
    console.error('togglePostLike error:', e)
  }
}

// One-time seed of starter tips & recipes. Runs from the app
// (authenticated user) so it passes the security rules.
// Returns the number of items inserted.
export async function seedCommunityContent(authorUid) {
  const TIPS = [
    { title: 'השקיה נכונה של בגוניה', author: 'משה דניאל', body: 'בגוניה אוהבת לחות אבל שונאת הצפה. הכלל הפשוט: בודקים את האדמה עם האצבע — אם השכבה העליונה יבשה, הגיע הזמן להשקות. בקיץ פעמיים בשבוע, בחורף פעם בשבוע. חשוב שהעציץ יהיה עם ניקוז טוב, אחרת השורשים נרקבים.' },
    { title: 'איך לחסוך בחשבון החשמל', author: 'יעקב לוי', body: 'כמה הרגלים קטנים שחוסכים הרבה: מנתקים מהשקע מכשירים שלא בשימוש (גם במצב כבוי הם צורכים). משתמשים בנורות LED. מפעילים מכונת כביסה רק כשהיא מלאה. בחורף סוגרים תריסים בלילה לשמירת חום.' },
    { title: 'תרגילי מתיחה קלים לבוקר', author: 'רחל אברהמי', body: 'מתחילים את היום בעדינות: גלגול כתפיים לאחור 10 פעמים. מתיחת צוואר עדינה לכל צד. הרמת ידיים מעל הראש ונשימה עמוקה. כל תרגיל לאט ובלי כאב. חמש דקות בבוקר עושות הבדל גדול.' },
    { title: 'איך מסירים כתמים מבגדים', author: 'אסתר כהן', body: 'הכלל החשוב: מטפלים בכתם מיד, לפני שמתייבש. כתם שמן — מפזרים טלק או קמח שיספוג. כתם יין — מלח על הכתם הרטוב. כתם דם — מים קרים בלבד, לעולם לא חמים. תמיד שוטפים מהצד האחורי של הבד החוצה.' },
    { title: 'שמירה על הזיכרון בגיל המבוגר', author: 'חנה גולדמן', body: 'המוח הוא שריר — צריך להפעיל אותו. פתרון תשבצים, קריאת ספרים, לימוד דברים חדשים. חשוב גם קשר חברתי — שיחה טובה מפעילה את המוח. שינה טובה ופעילות גופנית עוזרות גם הן. והכי חשוב — לא לפחד, שכחה קטנה היא נורמלית.' },
    { title: 'טיפ להירדמות טובה יותר', author: 'דוד פרץ', body: 'שעה לפני השינה מנתקים מסכים — הטלוויזיה והטלפון מקשים על ההירדמות. כוס חלב חם או תה קמומיל מרגיעים. שומרים על שעת שינה קבועה, גם בסוף״ש. החדר צריך להיות חשוך וקריר. אם לא נרדמים — קמים, קוראים קצת, וחוזרים למיטה.' },
    { title: 'איך לבחור אבטיח מתוק', author: 'לאה ברקוביץ', body: 'כמה סימנים לאבטיח טוב: מחפשים כתם צהוב על הקליפה — שם הוא נח על האדמה והבשיל. מקישים עליו — צליל עמוק ומהדהד הוא סימן טוב. אבטיח כבד יחסית לגודלו מלא במים ומתוק. הזנב צריך להיות יבש.' },
    { title: 'לשמור על קשר עם הנכדים', author: 'מרים שלום', body: 'הנכדים עסוקים, אבל הקשר חשוב לשני הצדדים. שיחת וידאו קצרה שווה יותר משיחת טלפון ארוכה. מתעניינים בדברים שלהם — המשחקים, החברים. שולחים תמונה או מסר קצר באמצע השבוע. הקשר נבנה מהדברים הקטנים והקבועים.' },
  ]

  let count = 0
  // מתכונים מובנים — מזהה מסמך קבוע לכל מתכון (seed-recipe-{id}) כדי
  // שהרצה חוזרת / לחיצה כפולה רק תדרוס את אותו מסמך, בלי לשכפל.
  for (const r of SEED_RECIPES) {
    const cover = r.hasImage ? `/recipe-seed/${r.id}.jpg` : null
    await setDoc(doc(db, 'communityPosts', `seed-recipe-${r.id}`), {
      kind: 'recipe',
      seed: true,
      title: r.title,
      body: '',
      category: r.category || 'other',
      recipe: {
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        cookTime: '',
      },
      photos: cover ? [cover] : [],
      cooked: [],
      approved: true,
      authorUid: authorUid || 'seed',
      authorName: r.author,
      views: Math.floor(Math.random() * 80) + 12,
      likes: [],
      createdAt: serverTimestamp(),
    })
    count++
  }
  for (let i = 0; i < TIPS.length; i++) {
    const t = TIPS[i]
    await setDoc(doc(db, 'communityPosts', `seed-tip-${i + 1}`), {
      kind: 'tip', seed: true, title: t.title, body: t.body,
      category: t.category || 'other',
      approved: true,
      authorUid: authorUid || 'seed', authorName: t.author,
      views: Math.floor(Math.random() * 80) + 12,
      likes: [], createdAt: serverTimestamp(),
    })
    count++
  }
  return count
}

// מנקה את כל תוכן הדוגמה (מתכונים + טיפים) שנזרע בעבר — כולל הכפילויות
// שנוצרו לפני שה-seed הפך לאידמפוטני. מזוהה לפי הדגל seed===true או לפי
// שם מחבר מרשימת המחברים הבדויים (SEED_AUTHORS). כלל ה-Firestore מתיר
// מחיקה רק למחבר (authorUid==uid), כך שמתכונים אמיתיים של משתמשים אחרים
// לעולם לא ייגעו. מחזיר את מספר הפריטים שנמחקו.
export async function clearSeededContent() {
  let removed = 0
  const snap = await getDocs(collection(db, 'communityPosts'))
  for (const d of snap.docs) {
    const data = d.data()
    const isSeed = data.seed === true || SEED_AUTHORS.includes(data.authorName)
    if (!isSeed) continue
    try {
      await deleteDoc(d.ref)
      removed++
    } catch (e) {
      // best-effort — מסמך של מחבר אחר ייחסם ע"י הכללים, וזה בסדר
    }
  }
  return removed
}

// ניקוי + זריעה מחדש בפעולה אחת — לחיצה אחת מחזירה את תוכן הדוגמה
// למצב נקי: עותק יחיד של כל מתכון (כולל הקטגוריות החדשות).
export async function resetSeedContent(authorUid) {
  await clearSeededContent()
  return await seedCommunityContent(authorUid)
}

// ─── Friendships (חברים קרובים) ──────────────────────────────
// Collection 'friendships'. Each doc id is a deterministic pair key
// so the same two users can never create duplicate requests.
//   { users: [uidA, uidB], requester, status: 'pending'|'accepted',
//     names: { [uid]: name }, createdAt, acceptedAt }

// deterministic doc id for a pair (sorted so it's identical both ways)
function friendshipId(uidA, uidB) {
  return [uidA, uidB].sort().join('__')
}

// Send a friend request from `me` to `target`.
export async function sendFriendRequest(me, target) {
  if (!me?.uid || !target?.uid || me.uid === target.uid) return
  const id = friendshipId(me.uid, target.uid)
  const ref = doc(db, 'friendships', id)
  const snap = await getDoc(ref)
  if (snap.exists()) return  // already friends or request pending

  await setDoc(ref, {
    users: [me.uid, target.uid].sort(),
    requester: me.uid,
    status: 'pending',
    names: { [me.uid]: me.name || 'משתמש', [target.uid]: target.name || 'משתמש' },
    createdAt: serverTimestamp(),
  })
}

// Accept a pending friend request.
export async function acceptFriendRequest(friendshipDocId) {
  try {
    await updateDoc(doc(db, 'friendships', friendshipDocId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('acceptFriendRequest error:', e)
  }
}

// Decline / remove a friend request or friendship.
export async function removeFriendship(friendshipDocId) {
  try {
    await deleteDoc(doc(db, 'friendships', friendshipDocId))
  } catch (e) {
    console.error('removeFriendship error:', e)
  }
}

// Live watch of all friendship docs that involve me.
// Calls cb with { friends, incoming, outgoing } arrays.
export function watchFriendships(myUid, cb) {
  const q = query(
    collection(db, 'friendships'),
    where('users', 'array-contains', myUid),
  )
  return onSnapshot(q, snap => {
    const friends = []   // accepted
    const incoming = []  // pending, someone else asked me
    const outgoing = []  // pending, I asked someone else
    snap.docs.forEach(d => {
      const data = d.data()
      const otherUid = (data.users || []).find(u => u !== myUid)
      const entry = {
        docId: d.id,
        otherUid,
        otherName: (data.names || {})[otherUid] || 'משתמש',
        status: data.status,
        requester: data.requester,
      }
      if (data.status === 'accepted') friends.push(entry)
      else if (data.requester === myUid) outgoing.push(entry)
      else incoming.push(entry)
    })
    cb({ friends, incoming, outgoing })
  }, err => {
    console.error('watchFriendships error:', err)
    cb({ friends: [], incoming: [], outgoing: [] })
  })
}

// Check the friendship status between me and one other user.
// Returns 'none' | 'pending' | 'accepted'.
export async function getFriendshipStatus(myUid, otherUid) {
  try {
    const snap = await getDoc(doc(db, 'friendships', friendshipId(myUid, otherUid)))
    if (!snap.exists()) return 'none'
    return snap.data().status === 'accepted' ? 'accepted' : 'pending'
  } catch (e) {
    return 'none'
  }
}

// "אנשים שאולי תכירו" — חברים של חברים (mutual).
// מחזיר עד topN מועמדים {uid, name, photoURL, mutualCount}, ממוין לפי מספר חברים משותפים.
// מדלג על עצמי, על חברים קיימים ועל בקשות פתוחות.
export async function getSuggestedFriends(myUid, topN = 12) {
  if (!myUid) return []
  try {
    const mySnap = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', myUid)))
    const exclude = new Set([myUid])
    const myFriendUids = []
    mySnap.docs.forEach(d => {
      const data = d.data()
      const other = (data.users || []).find(u => u !== myUid)
      if (!other) return
      exclude.add(other)   // חבר מאושר או בקשה פתוחה — לא להציע שוב
      if (data.status === 'accepted') myFriendUids.push(other)
    })
    if (myFriendUids.length === 0) return []

    const counts = new Map()   // uid מועמד -> כמה חברים משותפים
    for (const fUid of myFriendUids.slice(0, 30)) {
      const fSnap = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', fUid)))
      fSnap.docs.forEach(d => {
        const data = d.data()
        if (data.status !== 'accepted') return
        const cand = (data.users || []).find(u => u !== fUid)
        if (!cand || exclude.has(cand)) return
        counts.set(cand, (counts.get(cand) || 0) + 1)
      })
    }

    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN)
    const out = []
    for (const [uid, mutualCount] of ranked) {
      const u = await getUser(uid)
      if (!u || u.blocked || u.deletionScheduledAt) continue
      const name = [u.name, u.lastName].filter(Boolean).join(' ') || u.name || 'משתמש'
      out.push({ uid, name, photoURL: u.photoURL || null, mutualCount })
    }
    return out
  } catch (e) {
    console.error('getSuggestedFriends error:', e)
    return []
  }
}

// ─── משפחה (לולאת משפחה) ──────────────────────────────
// המשפחה נשענת על אותו אוסף friendships, עם תיוג relation:'family'.
// ההתחברות נעשית בקוד הזמנה שמשותף בקישור (וואטסאפ): בן משפחה יוצר קוד,
// הצד השני פותח את הקישור / מקליד את הקוד — ונוצרת חברות משפחתית מאושרת מיד
// (הקישור עצמו הוא ההסכמה, ולכן אין צורך בשלב אישור נפרד).
//   familyInvites/{code}: { inviterUid, inviterName, used, createdAt }

// מחולל קוד הזמנה קצר וברור (אותיות גדולות + ספרות, בלי תווים מבלבלים)
function familyInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// יוצר קוד/קישור הזמנה למשפחה. מחזיר { code }.
export async function createFamilyInvite({ uid, name }) {
  if (!uid) return null
  const code = familyInviteCode()
  await setDoc(doc(db, 'familyInvites', code), {
    inviterUid: uid,
    inviterName: name || 'בן משפחה',
    used: false,
    createdAt: serverTimestamp(),
  })
  return { code }
}

// מאשר הזמנת משפחה לפי קוד — יוצר חברות משפחתית מאושרת בין המזמין למשתמש.
// מחזיר { ok, inviterUid, inviterName } או { ok:false, reason }.
export async function acceptFamilyInvite({ code, me }) {
  if (!code || !me?.uid) return { ok: false, reason: 'missing' }
  const clean = String(code).trim().toUpperCase()
  try {
    const inviteSnap = await getDoc(doc(db, 'familyInvites', clean))
    if (!inviteSnap.exists()) return { ok: false, reason: 'not-found' }
    const invite = inviteSnap.data()
    const inviterUid = invite.inviterUid
    if (!inviterUid || inviterUid === me.uid) return { ok: false, reason: 'self' }

    const id = friendshipId(me.uid, inviterUid)
    await setDoc(doc(db, 'friendships', id), {
      users: [me.uid, inviterUid].sort(),
      requester: inviterUid,
      status: 'accepted',
      relation: 'family',
      names: { [me.uid]: me.name || 'בן משפחה', [inviterUid]: invite.inviterName || 'בן משפחה' },
      createdAt: serverTimestamp(),
      acceptedAt: serverTimestamp(),
    }, { merge: true })

    // מסמנים את ההזמנה כנוצלה (best-effort; אותו קוד יכול לשמש כמה בני משפחה)
    try { await updateDoc(doc(db, 'familyInvites', clean), { used: true }) } catch {}

    return { ok: true, inviterUid, inviterName: invite.inviterName || 'בן משפחה' }
  } catch (e) {
    console.error('acceptFamilyInvite error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מאזין לבני המשפחה שלי — חברויות מאושרות עם relation:'family'.
// מחזיר מערך של { docId, otherUid, otherName }.
export function watchFamily(myUid, cb) {
  const q = query(
    collection(db, 'friendships'),
    where('users', 'array-contains', myUid),
  )
  return onSnapshot(q, snap => {
    const family = []
    snap.docs.forEach(d => {
      const data = d.data()
      if (data.relation !== 'family' || data.status !== 'accepted') return
      const otherUid = (data.users || []).find(u => u !== myUid)
      family.push({
        docId: d.id,
        otherUid,
        otherName: (data.names || {})[otherUid] || 'בן משפחה',
      })
    })
    cb(family)
  }, err => {
    console.error('watchFamily error:', err)
    cb([])
  })
}

// ─── Game rooms — זירת משחקים אונליין ────────────────────
// התשתית הכללית למשחקי רשת — משמשת את Connect4 ולכל משחק עתידי.
//
// מבנה המסמך:
//   gameRooms/{roomId}:
//     gameType: 'connect4' | 'chess' | ...
//     players: [{ uid, name, color: 'P1'|'P2' }]
//     status: 'waiting' | 'playing' | 'ended'
//     gameState: { board, currentTurn, winner, ... } — תלוי במשחק
//     inviteCode: '6 תווים' (רק אם להזמנת חבר)
//     isPrivate: boolean
//     createdAt, updatedAt

// מחולל קוד הזמנה בן 6 תווים (אותיות גדולות + מספרים, בלי תווים מבלבלים כמו O/0/I/1)
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// מצב המשחק ההתחלתי ל-Connect 4.
// ⚠️ חשוב: Firestore לא תומך במערכים מקוננים (nested arrays).
// לכן הלוח נשמר כמערך שטוח של 42 תאים (6 שורות × 7 עמודות),
// כאשר התא בשורה r ועמודה c נמצא באינדקס r*7+c.
// בצד הלקוח נמיר את זה חזרה למערך דו-ממדי בעת הצורך.
// אותו דבר עם winningCells: מערך שטוח של זוגות [r,c] מפוצל לשני שדות.
function initialConnect4State() {
  return {
    board: Array(42).fill(null),  // 6×7 = 42, שטוח
    currentTurn: 'P1',
    winner: null,
    winningCells: [],  // נשמר כמערך של מחרוזות 'r,c' (לא מערכים מקוננים)
    lastMove: null,    // null או { row, col, player } — אובייקט שטוח
  }
}

// יוצר חדר משחק חדש (שחקן יחיד ממתין או מה הצטרף שני — לפי סוג החדר).
// roomType: 'random' = פתוח למתאמה רנדומלית / 'private' = עם קוד הזמנה
export async function createGameRoom({ gameType, creator, roomType }) {
  const inviteCode = roomType === 'private' ? generateInviteCode() : null
  const initialState = gameType === 'connect4' ? initialConnect4State() : {}

  const ref = await addDoc(collection(db, 'gameRooms'), {
    gameType,
    players: [{
      uid: creator.uid,
      name: creator.name || 'משתמש',
      color: 'P1',
    }],
    status: 'waiting',
    gameState: initialState,
    inviteCode,
    isPrivate: roomType === 'private',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { roomId: ref.id, inviteCode }
}

// מחפש חדר לפי קוד הזמנה (עבור הצטרפות לחבר דרך קוד).
// מחזיר { roomId } אם נמצא, null אחרת.
export async function findRoomByCode(code) {
  // שאילתא פשוטה — רק inviteCode (אינדקס יחיד, לא דורש composite)
  const q = query(
    collection(db, 'gameRooms'),
    where('inviteCode', '==', code.toUpperCase()),
    limit(5),
  )
  const snap = await getDocs(q)
  // מסננים בצד הלקוח שהחדר עדיין מחכה
  const waitingRoom = snap.docs.find(d => d.data().status === 'waiting')
  if (!waitingRoom) return null
  return { roomId: waitingRoom.id, ...waitingRoom.data() }
}

// מצטרף לחדר קיים כשחקן שני. ממלא את מקום P2.
export async function joinGameRoom(roomId, player) {
  const ref = doc(db, 'gameRooms', roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('החדר לא קיים')
  const data = snap.data()
  if (data.status !== 'waiting') throw new Error('המשחק כבר התחיל')
  if ((data.players || []).length >= 2) throw new Error('החדר מלא')

  await updateDoc(ref, {
    players: [...(data.players || []), {
      uid: player.uid,
      name: player.name || 'משתמש',
      color: 'P2',
    }],
    status: 'playing',
    updatedAt: serverTimestamp(),
  })
}

// מסתכל על חדר משחק בזמן אמת.
export function watchGameRoom(roomId, cb) {
  return onSnapshot(doc(db, 'gameRooms', roomId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  }, err => {
    console.error('watchGameRoom error:', err)
  })
}

// מעדכן את מצב המשחק (לאחר מהלך של שחקן).
export async function updateGameState(roomId, gameState) {
  try {
    await updateDoc(doc(db, 'gameRooms', roomId), {
      gameState,
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('updateGameState error:', e)
  }
}

// מעדכן שדות כלליים בחדר (למשל הצבעות "שחק שוב" — rematch).
// תומך גם ב-field paths מקוננים כמו 'rematch.P1'.
export async function updateGameRoom(roomId, fields) {
  try {
    await updateDoc(doc(db, 'gameRooms', roomId), {
      ...fields,
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('updateGameRoom error:', e)
  }
}

// שליחת הודעת צ'אט בתוך חדר משחק.
// ההודעות נשמרות כמערך על מסמך החדר (chat). משתמשים ב-arrayUnion
// כדי להוסיף הודעה בלי לדרוס הודעות אחרות. אסור serverTimestamp בתוך מערך,
// לכן הזמן נשמר כ-ts (מילי-שניות מצד הלקוח) לצורך מיון/תצוגה.
export async function sendGameChat(roomId, message) {
  try {
    await updateDoc(doc(db, 'gameRooms', roomId), {
      chat: arrayUnion(message),
    })
  } catch (e) {
    console.error('sendGameChat error:', e)
  }
}

// עזיבת החדר (מחקת את ה-doc).
// משמש לניקוי כשהמשחק מסתיים או השחקן עוזב לפני שמישהו הצטרף.
export async function leaveGameRoom(roomId) {
  try {
    await deleteDoc(doc(db, 'gameRooms', roomId))
  } catch (e) {
    console.error('leaveGameRoom error:', e)
  }
}

// ─── התאמת רנדומלית (matchmaking) ──────────────────────
// לוגיקה: המשתמש לוחץ "שחקן רנדומלי" → מחפש חדר קיים מחכה לשחקן,
// אם קיים — מצטרף מיד. אם לא — יוצר חדר חדש ומחכה.
//
// שימוש בשאילתא פשוטה (רק 2 where, בלי orderBy) כדי לא לדרוש composite index ב-Firestore.
// המיון והסינון לפי isPrivate נעשים בצד הלקוח על תוצאות מצומצמות.
export async function findOrCreateMatch({ gameType, player }) {
  // שלב 1: חיפוש חדרים פתוחים מסוג המשחק הנכון
  const q = query(
    collection(db, 'gameRooms'),
    where('gameType', '==', gameType),
    where('status', '==', 'waiting'),
    limit(20),
  )
  const snap = await getDocs(q)

  // מסננים בצד הלקוח: לא חדר שלי, יש בו מקום, ולא פרטי
  const availableRoom = snap.docs.find(d => {
    const data = d.data()
    const players = data.players || []
    if (data.isPrivate) return false                     // חדר עם קוד הזמנה — לא לרנדומלי
    if (players.length !== 1) return false               // צריך בדיוק שחקן אחד שמחכה
    if (players[0].uid === player.uid) return false      // לא להצטרף לחדר של עצמי
    return true
  })

  if (availableRoom) {
    // נמצא — מצטרף
    await joinGameRoom(availableRoom.id, player)
    return { roomId: availableRoom.id, isCreator: false }
  } else {
    // לא נמצא — יוצרים חדר חדש ומחכים
    const { roomId } = await createGameRoom({
      gameType,
      creator: player,
      roomType: 'random',
    })
    return { roomId, isCreator: true }
  }
}

// ─── הזמנות לחברים למשחק ──────────────────────────────
// הלוגיקה: שחקן A לוחץ "הזמן את שחקן B" → יוצר את החדר הפרטי וגם
// יוצר doc ב-gameInvites שמופיע אצל B. אם B מאשר — הוא מצטרף לחדר.
// אם דוחה / לא מגיב תוך 60 שניות — ההזמנה נמחקת.
//
// מבנה המסמך:
//   gameInvites/{inviteId}:
//     fromUid, fromName
//     toUid, toName
//     gameType: 'connect4' | ...
//     roomId: id של החדר ב-gameRooms
//     status: 'pending' | 'accepted' | 'declined' | 'expired'
//     createdAt

export async function sendGameInvite({ from, to, gameType, roomId }) {
  const ref = await addDoc(collection(db, 'gameInvites'), {
    fromUid: from.uid,
    fromName: from.name || 'משתמש',
    toUid: to.uid,
    toName: to.name || 'משתמש',
    gameType,
    roomId,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// מאזין להזמנות נכנסות (pending) של המשתמש הזה.
// משמש את ה-GameInviteListener שיציג popup.
export function watchIncomingInvites(myUid, cb) {
  const q = query(
    collection(db, 'gameInvites'),
    where('toUid', '==', myUid),
    where('status', '==', 'pending'),
  )
  return onSnapshot(q, snap => {
    const invites = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb(invites)
  }, err => {
    console.error('watchIncomingInvites error:', err)
  })
}

// השולח מאזין לסטטוס של ההזמנה שלו — כדי לדעת אם התקבלה/נדחתה.
export function watchInvite(inviteId, cb) {
  return onSnapshot(doc(db, 'gameInvites', inviteId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  })
}

// אישור הזמנה — המוזמן מצטרף לחדר ומסמן את ההזמנה accepted.
export async function acceptGameInvite(inviteId, player) {
  const inviteRef = doc(db, 'gameInvites', inviteId)
  const snap = await getDoc(inviteRef)
  if (!snap.exists()) throw new Error('ההזמנה לא קיימת יותר')
  const data = snap.data()
  if (data.status !== 'pending') throw new Error('ההזמנה לא תקפה יותר')

  // מצטרפים לחדר
  await joinGameRoom(data.roomId, player)
  // מעדכנים את ההזמנה ל-accepted
  await updateDoc(inviteRef, {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
  })
  return data.roomId
}

// דחיית הזמנה — מסמן ההזמנה כ-declined (השולח יראה את זה ויבטל).
export async function declineGameInvite(inviteId) {
  try {
    await updateDoc(doc(db, 'gameInvites', inviteId), {
      status: 'declined',
      declinedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('declineGameInvite error:', e)
  }
}

// מחיקה מלאה של ההזמנה — לשלב הניקוי הסופי.
export async function deleteGameInvite(inviteId) {
  try {
    await deleteDoc(doc(db, 'gameInvites', inviteId))
  } catch (e) {
    console.error('deleteGameInvite error:', e)
  }
}

// ─── מי רוצה להיות מיליונר — טבלת מובילים יומית ─────────
// שומרים את הניקוד הטוב ביותר לכל משתמש לכל יום במסמך יחיד
// (מזהה = `${dateKey}__${uid}`). כך לכל אדם שורה אחת — התוצאה הכי טובה שלו.
//
//   millionaireScores/{dateKey__uid}:
//     uid, name, points, dateKey, updatedAt

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// שומר ניקוד — רק אם הוא גבוה מהתוצאה הקודמת של המשתמש היום.
export async function saveMillionaireScore(uid, name, points) {
  if (!uid) return
  const dateKey = todayKey()
  const ref = doc(db, 'millionaireScores', `${dateKey}__${uid}`)
  try {
    const snap = await getDoc(ref)
    const prev = snap.exists() ? (snap.data().points || 0) : -1
    if (points > prev) {
      await setDoc(ref, {
        uid,
        name: name || 'משתמש',
        points,
        dateKey,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }
  } catch (e) {
    console.error('saveMillionaireScore error:', e)
  }
}

// מחזיר את המובילים של היום (ממוין יורד, top N).
// שאילתה פשוטה (where יחיד) — ללא orderBy, כך לא נדרש composite index.
export async function getMillionaireLeaderboard(topN = 10) {
  const dateKey = todayKey()
  try {
    const q = query(
      collection(db, 'millionaireScores'),
      where('dateKey', '==', dateKey),
    )
    const snap = await getDocs(q)
    return snap.docs
      .map(d => d.data())
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, topN)
  } catch (e) {
    console.error('getMillionaireLeaderboard error:', e)
    return []
  }
}

// ─── רמיקוב — חדרי משחק רב-משתתפים (2-4) ─────────────
// התשתית הכללית (gameRooms) בנויה ל-2 שחקנים. לרמיקוב אנו צריכים
// 2-4 שחקנים והתחלה יזומת ע"י המארח — לכן אוסף נפרד של פונקציות.
//
//   rummikubRooms/{roomId}:
//     hostUid, players: [{ uid, name }], status: 'waiting'|'playing'|'ended',
//     gameStateJson: מצב המשחק מהמנוע (JSON), maxPlayers, roomType, inviteCode

export async function createRummikubRoom({ host, roomType, maxPlayers = 4 }) {
  const inviteCode = roomType === 'private' ? generateInviteCode() : null
  const ref = await addDoc(collection(db, 'rummikubRooms'), {
    hostUid: host.uid,
    players: [{ uid: host.uid, name: host.name || 'משתמש' }],
    status: 'waiting',
    gameStateJson: '',
    maxPlayers,
    roomType,
    isPrivate: roomType === 'private',
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { roomId: ref.id, inviteCode }
}

// מצטרף לחדר רמיקוב קיים (אם יש מקום ועדיין מחכה).
export async function joinRummikubRoom(roomId, player) {
  const ref = doc(db, 'rummikubRooms', roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('החדר לא קיים')
  const data = snap.data()
  if (data.status !== 'waiting') throw new Error('המשחק כבר התחיל')
  const players = data.players || []
  if (players.some(p => p.uid === player.uid)) return  // כבר בפנים
  if (players.length >= (data.maxPlayers || 4)) throw new Error('החדר מלא')
  await updateDoc(ref, {
    players: [...players, { uid: player.uid, name: player.name || 'משתמש' }],
    updatedAt: serverTimestamp(),
  })
}

// המארח מתחיל את המשחק (מעביר ל-playing עם מצב התחלתי).
export async function startRummikubGame(roomId, gameState) {
  await updateDoc(doc(db, 'rummikubRooms', roomId), {
    status: 'playing',
    gameStateJson: JSON.stringify(gameState),
    updatedAt: serverTimestamp(),
  })
}

// מעדכן את מצב המשחק (אחרי תור).
export async function updateRummikubState(roomId, gameState) {
  try {
    await updateDoc(doc(db, 'rummikubRooms', roomId), {
      gameStateJson: JSON.stringify(gameState),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('updateRummikubState error:', e)
  }
}

export function watchRummikubRoom(roomId, cb) {
  return onSnapshot(doc(db, 'rummikubRooms', roomId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  }, err => { console.error('watchRummikubRoom error:', err) })
}

export async function leaveRummikubRoom(roomId) {
  try { await deleteDoc(doc(db, 'rummikubRooms', roomId)) }
  catch (e) { console.error('leaveRummikubRoom error:', e) }
}

// שולח הודעת צ'אט בחדר רמיקוב (מתווסף למערך chat).
export async function sendRummikubChat(roomId, message) {
  try {
    await updateDoc(doc(db, 'rummikubRooms', roomId), {
      chat: arrayUnion(message),
    })
  } catch (e) {
    console.error('sendRummikubChat error:', e)
  }
}

// מתאמה רנדומלית לרמיקוב — מצטרף לחדר ממתין (עם אותו מספר שחקנים מבוקש)
// או יוצר חדש. maxPlayers קובע לכמה שחקנים החדר ממתין.
// כשהחדר מתמלא בדיוק ל-maxPlayers — המשחק מתחיל אוטומטית (ראה צד הלקוח).
export async function findOrCreateRummikubMatch({ player, maxPlayers = 4 }) {
  const q = query(
    collection(db, 'rummikubRooms'),
    where('status', '==', 'waiting'),
    limit(20),
  )
  const snap = await getDocs(q)
  const room = snap.docs.find(d => {
    const data = d.data()
    if (data.isPrivate) return false
    if ((data.maxPlayers || 4) !== maxPlayers) return false   // רק חדר עם אותו מספר שחקנים מבוקש
    const players = data.players || []
    if (players.length >= (data.maxPlayers || 4)) return false
    if (players.some(p => p.uid === player.uid)) return false
    return true
  })
  if (room) {
    await joinRummikubRoom(room.id, player)
    return { roomId: room.id, isHost: false }
  }
  const { roomId } = await createRummikubRoom({ host: player, roomType: 'random', maxPlayers })
  return { roomId, isHost: true }
}

// ─── מלך הזירה — דו-קרב טריוויה אונליין (2 שחקנים) ─────
// חידון 1-על-1: שני השחקנים מקבלים את אותן 20 השאלות, כל אחד
// בוחר תשובה בלי לראות את של השני, עד 30 שניות לשאלה. כשנעל —
// נחשפת התשובה ומי ענה מה. מי שצובר יותר נקודות מנצח.
//
//   arenaRooms/{roomId}:
//     hostUid, players: [{ uid, name }], status: 'waiting'|'playing'|'ended',
//     gameStateJson: מצב המשחק (שאלות, תשובות, ניקוד), roomType, isPrivate, inviteCode

export async function createArenaRoom({ host, roomType, maxPlayers = 2 }) {
  const inviteCode = roomType === 'private' ? generateInviteCode() : null
  const ref = await addDoc(collection(db, 'arenaRooms'), {
    hostUid: host.uid,
    players: [{ uid: host.uid, name: host.name || 'משתמש' }],
    status: 'waiting',
    gameStateJson: '',
    maxPlayers,
    roomType,
    isPrivate: roomType === 'private',
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { roomId: ref.id, inviteCode }
}

export async function joinArenaRoom(roomId, player) {
  const ref = doc(db, 'arenaRooms', roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('החדר לא קיים')
  const data = snap.data()
  if (data.status !== 'waiting') throw new Error('המשחק כבר התחיל')
  const players = data.players || []
  if (players.some(p => p.uid === player.uid)) return  // כבר בפנים
  if (players.length >= (data.maxPlayers || 2)) throw new Error('החדר מלא')
  await updateDoc(ref, {
    players: [...players, { uid: player.uid, name: player.name || 'משתמש' }],
    updatedAt: serverTimestamp(),
  })
}

// המארח מתחיל את המשחק (מעביר ל-playing עם מצב התחלתי).
export async function startArenaGame(roomId, gameState) {
  await updateDoc(doc(db, 'arenaRooms', roomId), {
    status: 'playing',
    gameStateJson: JSON.stringify(gameState),
    updatedAt: serverTimestamp(),
  })
}

// מעדכן את מצב המשחק (אחרי תשובה / מעבר שאלה).
export async function updateArenaState(roomId, gameState) {
  try {
    await updateDoc(doc(db, 'arenaRooms', roomId), {
      gameStateJson: JSON.stringify(gameState),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('updateArenaState error:', e)
  }
}

export function watchArenaRoom(roomId, cb) {
  return onSnapshot(doc(db, 'arenaRooms', roomId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  }, err => { console.error('watchArenaRoom error:', err) })
}

export async function leaveArenaRoom(roomId) {
  try { await deleteDoc(doc(db, 'arenaRooms', roomId)) }
  catch (e) { console.error('leaveArenaRoom error:', e) }
}

// שולח הודעת צ'אט בחדר מלך הזירה (מתווסף למערך chat).
export async function sendArenaChat(roomId, message) {
  try {
    await updateDoc(doc(db, 'arenaRooms', roomId), {
      chat: arrayUnion(message),
    })
  } catch (e) {
    console.error('sendArenaChat error:', e)
  }
}

// מתאמה רנדומלית למלך הזירה — מצטרף לחדר ממתין (עם אותו מספר שחקנים מבוקש)
// או יוצר חדש. maxPlayers קובע לכמה שחקנים החדר ממתין (2 או 3).
export async function findOrCreateArenaMatch({ player, maxPlayers = 2 }) {
  const q = query(
    collection(db, 'arenaRooms'),
    where('status', '==', 'waiting'),
    limit(20),
  )
  const snap = await getDocs(q)
  const room = snap.docs.find(d => {
    const data = d.data()
    if (data.isPrivate) return false
    if ((data.maxPlayers || 2) !== maxPlayers) return false
    const players = data.players || []
    if (players.length >= (data.maxPlayers || 2)) return false
    if (players.some(p => p.uid === player.uid)) return false
    return true
  })
  if (room) {
    await joinArenaRoom(room.id, player)
    return { roomId: room.id, isHost: false }
  }
  const { roomId } = await createArenaRoom({ host: player, roomType: 'random', maxPlayers })
  return { roomId, isHost: true }
}

// ─── בינגו — חדרי משחק רב-משתתפים (עד 10) ─────────────
// מודל זהה לרמיקוב/מלך-הזירה: חדר עם מארח, עד maxPlayers שחקנים,
// gameStateJson מחזיק את מצב המשחק (כרטיסים, מספרים שיצאו, מנצח).
// המארח הוא ה"מקריא" — רק הוא כותב את המספר הבא קדימה.
//
//   bingoRooms/{roomId}:
//     hostUid, players: [{ uid, name }], status: 'waiting'|'playing'|'ended',
//     gameStateJson, maxPlayers, roomType, isPrivate, inviteCode

export async function createBingoRoom({ host, roomType, maxPlayers = 10 }) {
  const inviteCode = roomType === 'private' ? generateInviteCode() : null
  const ref = await addDoc(collection(db, 'bingoRooms'), {
    hostUid: host.uid,
    players: [{ uid: host.uid, name: host.name || 'משתמש' }],
    status: 'waiting',
    gameStateJson: '',
    maxPlayers,
    roomType,
    isPrivate: roomType === 'private',
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { roomId: ref.id, inviteCode }
}

export async function joinBingoRoom(roomId, player) {
  const ref = doc(db, 'bingoRooms', roomId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('החדר לא קיים')
  const data = snap.data()
  if (data.status !== 'waiting') throw new Error('המשחק כבר התחיל')
  const players = data.players || []
  if (players.some(p => p.uid === player.uid)) return  // כבר בפנים
  if (players.length >= (data.maxPlayers || 10)) throw new Error('החדר מלא')
  await updateDoc(ref, {
    players: [...players, { uid: player.uid, name: player.name || 'משתמש' }],
    updatedAt: serverTimestamp(),
  })
}

// המארח מתחיל את המשחק (מעביר ל-playing עם מצב התחלתי).
export async function startBingoGame(roomId, gameState) {
  await updateDoc(doc(db, 'bingoRooms', roomId), {
    status: 'playing',
    gameStateJson: JSON.stringify(gameState),
    updatedAt: serverTimestamp(),
  })
}

// מעדכן את מצב המשחק (מספר חדש שיצא / הכרזת מנצח).
export async function updateBingoState(roomId, gameState) {
  try {
    await updateDoc(doc(db, 'bingoRooms', roomId), {
      gameStateJson: JSON.stringify(gameState),
      updatedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('updateBingoState error:', e)
  }
}

export function watchBingoRoom(roomId, cb) {
  return onSnapshot(doc(db, 'bingoRooms', roomId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  }, err => { console.error('watchBingoRoom error:', err) })
}

export async function leaveBingoRoom(roomId) {
  try { await deleteDoc(doc(db, 'bingoRooms', roomId)) }
  catch (e) { console.error('leaveBingoRoom error:', e) }
}

// שולח הודעת צ'אט בחדר בינגו (מתווסף למערך chat).
export async function sendBingoChat(roomId, message) {
  try {
    await updateDoc(doc(db, 'bingoRooms', roomId), {
      chat: arrayUnion(message),
    })
  } catch (e) {
    console.error('sendBingoChat error:', e)
  }
}

// מתאמה רנדומלית לבינגו — מצטרף לחדר ממתין או יוצר חדש.
// בבינגו אין צורך שהחדר יתמלא — המארח מתחיל ידנית כשמוכנים.
export async function findOrCreateBingoMatch({ player, maxPlayers = 10 }) {
  const q = query(
    collection(db, 'bingoRooms'),
    where('status', '==', 'waiting'),
    limit(20),
  )
  const snap = await getDocs(q)
  const room = snap.docs.find(d => {
    const data = d.data()
    if (data.isPrivate) return false
    const players = data.players || []
    if (players.length >= (data.maxPlayers || 10)) return false
    if (players.some(p => p.uid === player.uid)) return false
    return true
  })
  if (room) {
    await joinBingoRoom(room.id, player)
    return { roomId: room.id, isHost: false }
  }
  const { roomId } = await createBingoRoom({ host: player, roomType: 'random', maxPlayers })
  return { roomId, isHost: true }
}

// ─── LiveKit token ────────────────────────────────────────────

export async function fetchLiveKitToken(room, participantName, uid = '') {
  const url = import.meta.env.VITE_LIVEKIT_TOKEN_URL
  if (!url) throw new Error('VITE_LIVEKIT_TOKEN_URL not set')
  const res = await fetch(
    `${url}?room=${encodeURIComponent(room)}` +
    `&username=${encodeURIComponent(participantName)}` +
    `&uid=${encodeURIComponent(uid)}`
  )
  if (!res.ok) throw new Error('Token fetch failed: ' + res.status)
  const data = await res.json()
  return data.token
}

// ─── צ'אט פרטי בין חברים ────────────────────────────
// מזהה שיחה יציב — שני ה-uids ממוינים ומחוברים, כך ששני הצדדים מגיעים לאותה שיחה.
export function directChatId(uidA, uidB) {
  return [uidA, uidB].sort().join('__')
}

// שולח הודעה פרטית. יוצר את מסמך השיחה אם עוד לא קיים.
// תומך בהודעת טקסט (text) או בהודעה קולית (audioUrl + durationSec).
export async function sendDirectMessage({ fromUid, toUid, text, senderName, audioUrl, durationSec }) {
  const chatId = directChatId(fromUid, toUid)
  const ref = doc(db, 'directChats', chatId)
  const isVoice = Boolean(audioUrl)
  const message = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    senderUid: fromUid,
    senderName: senderName || '',
    type: isVoice ? 'voice' : 'text',
    text: isVoice ? '' : String(text || '').slice(0, 2000),
    audioUrl: isVoice ? audioUrl : '',
    durationSec: isVoice ? Math.round(durationSec || 0) : 0,
    at: Date.now(),
  }
  // טקסט תצוגה לרשימת השיחות וההתראות
  const preview = isVoice ? '\uD83C\uDFA4 הודעה קולית' : message.text
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [fromUid, toUid].sort(),
      messages: [message],
      lastText: preview,
      lastAt: message.at,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } else {
    await updateDoc(ref, {
      messages: arrayUnion(message),
      lastText: preview,
      lastAt: message.at,
      updatedAt: serverTimestamp(),
    })
  }
  // התראת push לנמען (best-effort)
  notifyPush({ toUid, type: 'chat', title: senderName || 'הודעה חדשה', body: preview, url: '/' })
  return message.id
}

// מעלה הקלטה קולית ל-Firebase Storage ומחזיר קישור הורדה ציבורי.
// הקובץ נשמר תחת voiceMessages/{chatId}/{messageId}.webm
export async function uploadVoiceMessage({ fromUid, toUid, blob }) {
  const chatId = directChatId(fromUid, toUid)
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const path = `voiceMessages/${chatId}/${fileId}.webm`
  const fileRef = storageRef(storage, path)
  await uploadBytes(fileRef, blob, { contentType: blob.type || 'audio/webm' })
  const url = await getDownloadURL(fileRef)
  return url
}

// מאזין להודעות בשיחה פרטית בין שני משתמשים.
export function watchDirectChat(uidA, uidB, cb) {
  const chatId = directChatId(uidA, uidB)
  return onSnapshot(doc(db, 'directChats', chatId), snap => {
    if (snap.exists()) cb(snap.data().messages || [])
    else cb([])
  }, err => { console.error('watchDirectChat error:', err) })
}

// מאזין לכל השיחות הפרטיות שאני משתתף בהן (לצורך התראות).
// מחזיר מערך של { chatId, otherUid, lastText, lastAt, lastSenderUid }.
export function watchMyDirectChats(myUid, cb) {
  const q = query(
    collection(db, 'directChats'),
    where('participants', 'array-contains', myUid),
  )
  return onSnapshot(q, snap => {
    const chats = snap.docs.map(d => {
      const data = d.data()
      const msgs = data.messages || []
      const last = msgs.length ? msgs[msgs.length - 1] : null
      const otherUid = (data.participants || []).find(u => u !== myUid)
      return {
        chatId: d.id,
        otherUid,
        lastText: data.lastText || (last ? last.text : ''),
        lastAt: data.lastAt || (last ? last.at : 0),
        lastSenderUid: last ? last.senderUid : null,
        lastSenderName: last ? last.senderName : '',
      }
    })
    cb(chats)
  }, err => { console.error('watchMyDirectChats error:', err) })
}

// ─── התראות — חותמת "ראיתי התראות" ──────────────────
// שומרים במסמך המשתמש את הרגע האחרון שבו פתח את רשימת ההתראות.
// כל התראה שקרתה אחרי הזמן הזה נחשבת "חדשה".
export async function markNotificationsSeen(uid) {
  if (!uid) return
  try {
    await updateDoc(doc(db, 'users', uid), { notificationsSeenAt: Date.now() })
  } catch (e) {
    console.error('markNotificationsSeen error:', e)
  }
}

// ─── שיחות וידאו בין חברים ───────────────────────────
// שיחה ישירה עם "צלצול": A מתקשר → נוצר doc ב-videoCalls שמופיע אצל B
// כחלונית צלצול. אם B עונה → שניהם מצטרפים לאותו חדר LiveKit. אם דוחה /
// לא עונה / A מבטל — ה-doc מתעדכן והצד השני רואה ומתנתק.
//
//   videoCalls/{callId}:
//     fromUid, fromName, fromPhoto
//     toUid, toName
//     room: שם חדר LiveKit ייחודי לשיחה
//     status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed'
//     createdAt, answeredAt, endedAt

// שם חדר LiveKit ייחודי לשיחת וידאו (כולל חותמת זמן — חדר חדש לכל שיחה)
function videoCallRoomName(uidA, uidB) {
  const [a, b] = [uidA, uidB].sort()
  const safe = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30)
  return `vcall-${safe(a)}-${safe(b)}-${Date.now().toString(36)}`
}

// בודק אם משתמש מחובר עכשיו (status פעיל + נראה לאחרונה ב-2 הדקות האחרונות)
export async function isUserOnline(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (!snap.exists()) return false
    const data = snap.data()
    const seen = data.lastSeenAt
    const seenMs = seen && typeof seen.toMillis === 'function' ? seen.toMillis() : 0
    const fresh = seenMs && (Date.now() - seenMs) < ONLINE_WINDOW_MS
    return Boolean(fresh) && ['available', 'busy'].includes(data.status)
  } catch (e) {
    return false
  }
}

// יוזם שיחת וידאו לחבר. מחזיר { callId, room }.
export async function startVideoCall({ from, to, audioOnly = false }) {
  const room = videoCallRoomName(from.uid, to.uid)
  const ref = await addDoc(collection(db, 'videoCalls'), {
    fromUid: from.uid,
    fromName: from.name || 'משתמש',
    fromPhoto: from.photoURL || '',
    toUid: to.uid,
    toName: to.name || 'משתמש',
    room,
    status: 'ringing',
    audioOnly: Boolean(audioOnly),
    createdAt: serverTimestamp(),
  })
  // התראת push לנמען — שיחה נכנסת (מגיעה גם כשהאפליקציה סגורה)
  notifyPush({ toUid: to.uid, type: 'call', title: from.name ? `${from.name} מתקשר/ת אליך` : 'שיחה נכנסת', body: audioOnly ? 'שיחת קול' : 'שיחת וידאו', url: '/' })
  return { callId: ref.id, room }
}

// מאזין לשיחות נכנסות (ringing) של המשתמש הזה — ל-VideoCallListener.
export function watchIncomingCalls(myUid, cb) {
  const q = query(
    collection(db, 'videoCalls'),
    where('toUid', '==', myUid),
    where('status', '==', 'ringing'),
  )
  return onSnapshot(q, snap => {
    const calls = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb(calls)
  }, err => {
    console.error('watchIncomingCalls error:', err)
  })
}

// מאזין לסטטוס של שיחה מסוימת (שני הצדדים מאזינים — לדעת אם נענתה/נדחתה/הסתיימה).
export function watchVideoCall(callId, cb) {
  return onSnapshot(doc(db, 'videoCalls', callId), snap => {
    if (snap.exists()) cb({ id: snap.id, ...snap.data() })
    else cb(null)
  }, err => {
    console.error('watchVideoCall error:', err)
  })
}

// המקבל עונה לשיחה — מסמן accepted.
export async function acceptVideoCall(callId) {
  try {
    await updateDoc(doc(db, 'videoCalls', callId), {
      status: 'accepted',
      answeredAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('acceptVideoCall error:', e)
  }
}

// המקבל דוחה את השיחה — מסמן declined (המתקשר רואה ומתנתק).
export async function declineVideoCall(callId) {
  try {
    await updateDoc(doc(db, 'videoCalls', callId), {
      status: 'declined',
      endedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('declineVideoCall error:', e)
  }
}

// סיום שיחה (אחד הצדדים ניתק, או המתקשר ביטל לפני מענה).
export async function endVideoCall(callId) {
  try {
    await updateDoc(doc(db, 'videoCalls', callId), {
      status: 'ended',
      endedAt: serverTimestamp(),
    })
  } catch (e) {
    console.error('endVideoCall error:', e)
  }
}

// מחיקה סופית של doc השיחה (ניקוי אחרי שהסתיימה).
export async function deleteVideoCall(callId) {
  try {
    await deleteDoc(doc(db, 'videoCalls', callId))
  } catch (e) {
    console.error('deleteVideoCall error:', e)
  }
}

// ─── התראות Push (FCM) ───────────────────────────────
// תשתית Firebase Cloud Messaging להתראות שמגיעות גם כשהאפליקציה סגורה.
//
// זרימה:
//   1. enableNotifications(uid) — מבקש הרשאה, מקבל token, שומר אותו תחת המשתמש.
//   2. ה-Cloud Function (בצד השרת) שולחת push ל-token השמור.
//   3. firebase-messaging-sw.js מציג את ההתראה (גם כשהאפליקציה סגורה).
//
// ה-token נשמרים כמערך תחת users/{uid}.fcmTokens — כי למשתמש יכולים
// להיות כמה מכשירים (טלפון + טאבלט + מחשב).

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

let _messaging = null

// מאתחל את messaging רק אם הדפדפן תומך (לא כל דפדפן תומך, במיוחד גרסאות iOS ישנות)
async function getMessagingIfSupported() {
  if (_messaging) return _messaging
  try {
    const supported = await isMessagingSupported()
    if (!supported) return null
    _messaging = getMessaging(app)
    return _messaging
  } catch (e) {
    console.warn('FCM not supported:', e)
    return null
  }
}

// בודק אם הדפדפן/מכשיר תומך בהתראות push בכלל
export async function notificationsSupported() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  return await getMessagingIfSupported() !== null
}

// מחזיר את מצב ההרשאה הנוכחי: 'granted' | 'denied' | 'default' | 'unsupported'
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// מבקש הרשאה להתראות, מקבל FCM token ושומר אותו תחת המשתמש.
// מחזיר { ok: true, token } בהצלחה, או { ok: false, reason } אחרת.
export async function enableNotifications(uid) {
  if (!uid) return { ok: false, reason: 'no-uid' }
  if (!VAPID_KEY) {
    console.error('VITE_FIREBASE_VAPID_KEY לא מוגדר — צריך להגדיר ב-.env')
    return { ok: false, reason: 'no-vapid-key' }
  }

  const messaging = await getMessagingIfSupported()
  if (!messaging) return { ok: false, reason: 'unsupported' }

  // מבקשים הרשאה מהמשתמש
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' }
  }

  try {
    // רושמים את ה-service worker של FCM (נפרד מ-SW ה-PWA)
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    })
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })
    if (!token) return { ok: false, reason: 'no-token' }

    // שומרים את ה-token תחת המשתמש (arrayUnion — לא דורס token אחרים)
    await updateDoc(doc(db, 'users', uid), {
      fcmTokens: arrayUnion(token),
      notificationsEnabled: true,
    })
    return { ok: true, token }
  } catch (e) {
    console.error('enableNotifications error:', e)
    return { ok: false, reason: 'error' }
  }
}

// מכבה התראות למכשיר הנוכחי — מסיר את ה-token מהמשתמש ומסמן כמכובה.
export async function disableNotifications(uid) {
  if (!uid) return
  try {
    const messaging = await getMessagingIfSupported()
    let token = null
    if (messaging && VAPID_KEY) {
      try {
        const swReg = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope')
        token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg || undefined })
      } catch {}
    }
    const fields = { notificationsEnabled: false }
    if (token) {
      // מסירים רק את ה-token של המכשיר הזה (אחרים נשארים)
      const snap = await getDoc(doc(db, 'users', uid))
      const tokens = (snap.exists() && snap.data().fcmTokens) || []
      fields.fcmTokens = tokens.filter(t => t !== token)
    }
    await updateDoc(doc(db, 'users', uid), fields)
  } catch (e) {
    console.error('disableNotifications error:', e)
  }
}

// מרענן אוטומטית את ה-FCM token — אם ההרשאה כבר ניתנה.
// פותר התיישנות של הטוקן/המנוי בלי שהמשתמש יכבה וידליק ידנית. שקט, best-effort.
// משתמש באותו scope ייעודי כמו enableNotifications, כדי לא להתנגש עם sw.js.
let _lastTokenRefresh = 0
export async function ensureFcmTokenFresh(uid) {
  if (!uid) return
  const now = Date.now()
  if (now - _lastTokenRefresh < 4 * 60 * 1000) return   // לכל היותר אחת ל-4 דקות
  _lastTokenRefresh = now
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!VAPID_KEY) return
    const messaging = await getMessagingIfSupported()
    if (!messaging) return
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    })
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
    if (token) {
      await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token), notificationsEnabled: true })
    }
  } catch (e) { /* best-effort — לא חוסם */ }
}

// מאזין להודעות שמגיעות כשהאפליקציה פתוחה (foreground).
// מחזיר פונקציית unsubscribe. ה-cb מקבל את ה-payload.
// שומר FCM token של האפליקציה הנייטיב (Capacitor/Android) בשדה נפרד
// מ-fcmTokens של הדפדפן. השליחה לטוקנים האלה שונה (notification payload
// + ערוץ נייטיב עם צלצול), ולכן notify.js מטפל בהם בנפרד.
export async function saveNativeFcmToken(uid, token) {
  if (!uid || !token) return
  try {
    await updateDoc(doc(db, 'users', uid), {
      fcmTokensNative: arrayUnion(token),
      notificationsEnabled: true,
    })
  } catch (e) {
    console.error('saveNativeFcmToken error:', e)
  }
}

export async function onForegroundMessage(cb) {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return () => {}
  return onMessage(messaging, cb)
}

// שולח בקשת push דרך ה-endpoint בצד השרת (api/notify).
// best-effort — לא חוסם את הזרימה; בלוקאל (אין endpoint) פשוט נכשל בשקט.
export async function notifyPush({ toUid, type, title, body, url }) {
  if (!toUid || !type) return
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUid, type, title: title || '', body: body || '', url: url || '/' }),
    })
  } catch (e) {
    // best-effort — מתעלמים מכשל (למשל כשאין שרת מקומי)
  }
}

