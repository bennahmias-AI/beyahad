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

// Watch the LIVE count of everyone currently in the app.
// Counts statuses 'available' and 'busy' (anyone with the app open),
// and includes the current user in the total.
export function watchOnlineCount(cb) {
  const q = query(
    collection(db, 'users'),
    where('status', 'in', ['available', 'busy']),
  )
  return onSnapshot(q, snap => {
    cb(snap.size)
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

export async function createCommunityPost({ kind, title, body, authorUid, authorName }) {
  const ref = await addDoc(collection(db, 'communityPosts'), {
    kind,
    title: title.trim(),
    body: body.trim(),
    authorUid,
    authorName: authorName || 'משתמש',
    views: 0,
    likes: [],
    createdAt: serverTimestamp(),
  })
  return ref.id
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
  const RECIPES = [
    { title: 'לביבות תפוחי אדמה של רחל', author: 'רחל אברהמי', body: 'מצרכים: 5 תפוחי אדמה גדולים, 1 בצל, 2 ביצים, 3 כפות קמח, מלח ופלפל.\n\nהכנה: מגררים את תפוחי האדמה והבצל, סוחטים היטב את הנוזלים. מוסיפים ביצים, קמח ותבלינים ומערבבים. מטגנים בשמן חם עד שמזהיב משני הצדדים. מגישים חם עם רסק תפוחים או שמנת חמוצה.' },
    { title: 'מרק עוף של סבתא מרים', author: 'מרים שלום', body: 'מצרכים: עוף שלם, 3 גזרים, 2 קישואים, שורש פטרוזיליה, בצל, מלח.\n\nהכנה: שמים את העוף בסיר עם מים ומביאים לרתיחה. מסירים את הקצף. מוסיפים את כל הירקות חתוכים גס ומבשלים על אש נמוכה שעה וחצי. הסוד — בישול איטי ולא ממהרים.' },
    { title: 'עוגת תפוחים של חנה', author: 'חנה גולדמן', body: 'מצרכים: 4 תפוחי עץ, 3 ביצים, כוס סוכר, כוס שמן, 2 כוסות קמח, אבקת אפייה, קינמון.\n\nהכנה: מקציפים ביצים וסוכר, מוסיפים שמן. מוסיפים קמח ואבקת אפייה. שופכים חצי לתבנית, מסדרים פרוסות תפוח עם קינמון, שופכים את השאר. אופים בחום 180 מעלות כ-45 דקות.' },
    { title: 'חמין של יעקב', author: 'יעקב לוי', body: 'מצרכים: שעועית יבשה, גריסים, 4 תפוחי אדמה, בשר בקר, 4 ביצים, בצל, פפריקה.\n\nהכנה: משרים את השעועית מהלילה. מסדרים בסיר את כל המצרכים בשכבות, מוסיפים מים שיכסו. מתבלים בפפריקה, מלח ופלפל. מבשלים על אש קטנה מאוד כל הלילה. מגישים בצהריים — ארוחה שמחממת את הלב.' },
    { title: 'סלט ירקות קצוץ של אסתר', author: 'אסתר כהן', body: 'מצרכים: 4 עגבניות, 3 מלפפונים, בצל סגול, פלפל, פטרוזיליה, לימון, שמן זית.\n\nהכנה: קוצצים את כל הירקות לקוביות קטנות ואחידות — זה הסוד לסלט טוב. מוסיפים פטרוזיליה קצוצה. מתבלים במיץ לימון סחוט טרי, שמן זית, מלח. מערבבים ומגישים מיד.' },
    { title: 'קציצות בקר ברוטב של דוד', author: 'דוד פרץ', body: 'מצרכים: חצי קילו בשר טחון, ביצה, פירורי לחם, בצל, שום. לרוטב: רסק עגבניות, מים, פפריקה.\n\nהכנה: מערבבים את הבשר עם ביצה, פירורי לחם ובצל מגורר. מגלגלים כדורים. מכינים רוטב מרסק עגבניות ומים, מביאים לרתיחה ומכניסים את הקציצות. מבשלים על אש נמוכה 40 דקות.' },
    { title: 'עוגיות שוקולד צ׳יפ של לאה', author: 'לאה ברקוביץ', body: 'מצרכים: 200 גרם חמאה, כוס סוכר חום, ביצה, 2 כוסות קמח, שוקולד צ׳יפס.\n\nהכנה: מקציפים חמאה רכה עם סוכר. מוסיפים ביצה וקמח. מוסיפים שוקולד צ׳יפס בנדיבות. יוצרים כדורים קטנים על תבנית עם נייר אפייה. אופים 12 דקות בחום 175. מצוין עם כוס תה.' },
    { title: 'שקשוקה של משה', author: 'משה דניאל', body: 'מצרכים: 5 עגבניות בשלות, פלפל אדום, בצל, שום, 4 ביצים, פפריקה, כמון.\n\nהכנה: מטגנים בצל ופלפל עד שמתרככים. מוסיפים עגבניות מגוררות ותבלינים, מבשלים 15 דקות עד שהרוטב סמיך. שוברים את הביצים לתוך הרוטב, מכסים ומבשלים עד שהחלבון מתייצב. מגישים עם לחם טרי.' },
  ]
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
  for (const r of RECIPES) {
    await addDoc(collection(db, 'communityPosts'), {
      kind: 'recipe', title: r.title, body: r.body,
      authorUid: authorUid || 'seed', authorName: r.author,
      views: Math.floor(Math.random() * 80) + 12,
      likes: [], createdAt: serverTimestamp(),
    })
    count++
  }
  for (const t of TIPS) {
    await addDoc(collection(db, 'communityPosts'), {
      kind: 'tip', title: t.title, body: t.body,
      authorUid: authorUid || 'seed', authorName: t.author,
      views: Math.floor(Math.random() * 80) + 12,
      likes: [], createdAt: serverTimestamp(),
    })
    count++
  }
  return count
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
