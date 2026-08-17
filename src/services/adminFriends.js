// src/services/adminFriends.js
// ─────────────────────────────────────────────────────────────
// חיבור חברויות מצד המנהל — הוספת חברים למשתמש מתוך בורד הניהול.
//
// מבנה מסמך חברות (תואם למה שהאפליקציה יוצרת בעצמה):
//   friendships/{uidA__uidB}   ← שני ה-uid ממוינים אלפביתית, מופרדים ב-"__"
//   {
//     users: [uidA, uidB],           // מערך שני המשתתפים
//     names: { [uid]: 'שם פרטי' },   // מפה של שמות לתצוגה מהירה
//     requester: uid,                // מי יזם
//     status: 'pending' | 'accepted',
//     createdAt: serverTimestamp()
//   }
//
// כשמנהל מחבר שני משתמשים — יוצרים ישר status:'accepted',
// כך ששניהם רואים אחד את השני ברשימת החברים בלי צורך באישור.
// ─────────────────────────────────────────────────────────────
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs,
} from 'firebase/firestore'
import { db } from './firebase.js'

// מזהה המסמך — תמיד באותו סדר, כדי שלא ייווצרו כפילויות
export function friendshipId(uidA, uidB) {
  return [uidA, uidB].sort().join('__')
}

// חיבור שני משתמשים כחברים (מאושר מיידית).
// מחזיר { ok, already } — already=true אם כבר היו חברים.
export async function adminLinkFriends(a, b) {
  if (!a || !b || !a.uid || !b.uid || a.uid === b.uid) return { ok: false }
  const id = friendshipId(a.uid, b.uid)
  const ref = doc(db, 'friendships', id)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    const data = snap.data() || {}
    if (data.status === 'accepted') return { ok: true, already: true }
    // בקשה שהייתה תלויה — המנהל מאשר אותה
    await updateDoc(ref, { status: 'accepted' })
    return { ok: true, already: false }
  }

  await setDoc(ref, {
    users: [a.uid, b.uid].sort(),
    names: { [a.uid]: a.name || '', [b.uid]: b.name || '' },
    requester: a.uid,
    status: 'accepted',
    createdAt: serverTimestamp(),
  })
  return { ok: true, already: false }
}

// כל החברויות של משתמש (מאושרות + ממתינות) — לתצוגה בבורד הניהול
export async function adminGetFriendUids(uid) {
  if (!uid) return { accepted: [], pending: [] }
  const q = query(collection(db, 'friendships'), where('users', 'array-contains', uid))
  const snaps = await getDocs(q)
  const accepted = [], pending = []
  snaps.forEach(s => {
    const d = s.data() || {}
    const other = (d.users || []).find(u => u !== uid)
    if (!other) return
    if (d.status === 'accepted') accepted.push(other)
    else pending.push(other)
  })
  return { accepted, pending }
}
