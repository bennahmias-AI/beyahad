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
