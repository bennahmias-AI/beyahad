// src/hooks/useNotifications.js
// ─────────────────────────────────────────────────────────────
// Hook מרכזי לאיסוף ההתראות של המשתמש מכל המקורות:
//   1. בקשות חברות נכנסות (friendships → incoming)
//   2. הודעות צ'אט פרטי שלא נקראו (directChats)
//   3. הזמנות למשחק מחברים (gameInvites)
//   4. לייקים חדשים על מתכון/עצה שלי (communityPosts)
//
// כל התראה מקבלת חותמת זמן (ts). "חדשה" = נוצרה אחרי notificationsSeenAt
// (הרגע האחרון שבו המשתמש פתח את רשימת ההתראות).
//
// מחזיר: { items, unseenCount }
//   items: מערך התראות ממוין מהחדש לישן, כל אחת:
//     { id, type, title, body, ts, isNew, ...payload }
//   unseenCount: כמה התראות חדשות (להצגה על הפעמון)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import {
  watchFriendships, watchIncomingInvites, watchMyDirectChats,
  watchUser, watchCommunityPosts, watchMyNotifications,
} from '../services/firebase.js'

// שמות ידידותיים לסוגי המשחקים (לכותרת ההזמנה)
const GAME_NAMES = {
  connect4: '4 בשורה',
  checkers: 'דמקה',
  sheshbesh: 'שש-בש',
  rummikub: 'רמיקוב',
  arena: 'מלך הזירה',
  bingo: 'הבינגו של אמי',
}

// ממיר Firestore Timestamp / מספר / null למילי-שניות
function toMillis(t) {
  if (!t) return 0
  if (typeof t === 'number') return t
  if (typeof t.toMillis === 'function') return t.toMillis()
  return 0
}

export function useNotifications(myUid) {
  const [incoming, setIncoming] = useState([])      // בקשות חברות
  const [invites, setInvites] = useState([])        // הזמנות למשחק
  const [chats, setChats] = useState([])            // שיחות פרטיות
  const [myPosts, setMyPosts] = useState([])        // מתכונים+עצות שלי (ללייקים)
  const [sysNotifs, setSysNotifs] = useState([])    // התראות ניהול/מערכת
  const [seenAt, setSeenAt] = useState(0)           // חותמת "ראיתי"

  // בקשות חברות נכנסות
  useEffect(() => {
    if (!myUid) return
    const unsub = watchFriendships(myUid, ({ incoming }) => setIncoming(incoming || []))
    return () => unsub && unsub()
  }, [myUid])

  // הזמנות למשחק
  useEffect(() => {
    if (!myUid) return
    const unsub = watchIncomingInvites(myUid, (list) => setInvites(list || []))
    return () => unsub && unsub()
  }, [myUid])

  // שיחות פרטיות
  useEffect(() => {
    if (!myUid) return
    const unsub = watchMyDirectChats(myUid, (list) => setChats(list || []))
    return () => unsub && unsub()
  }, [myUid])

  // חותמת "ראיתי התראות" — מהמסמך של המשתמש (חי, כדי שהמספר יתאפס מיד)
  useEffect(() => {
    if (!myUid) return
    const unsub = watchUser(myUid, (u) => setSeenAt(u?.notificationsSeenAt || 0))
    return () => unsub && unsub()
  }, [myUid])

  // לייקים — אוספים את המתכונים והעצות, ומסננים בצד הלקוח לאלו שלי
  useEffect(() => {
    if (!myUid) return
    const tips = []
    const recipes = []
    const merge = () => setMyPosts([...tips, ...recipes].filter(p => p.authorUid === myUid))
    const unsubT = watchCommunityPosts('tip', (list) => { tips.length = 0; tips.push(...list); merge() })
    const unsubR = watchCommunityPosts('recipe', (list) => { recipes.length = 0; recipes.push(...list); merge() })
    return () => { unsubT && unsubT(); unsubR && unsubR() }
  }, [myUid])

  // התראות ניהול/מערכת (אישור/דחיית תוכן, הודעה מההנהלה)
  useEffect(() => {
    if (!myUid) return
    const unsub = watchMyNotifications(myUid, (list) => setSysNotifs(list || []))
    return () => unsub && unsub()
  }, [myUid])

  // בונים את רשימת ההתראות המאוחדת
  const items = []

  // 1. בקשות חברות
  for (const f of incoming) {
    items.push({
      id: `friend_${f.docId}`,
      type: 'friend',
      title: 'בקשת חברות חדשה',
      body: `${f.otherName} רוצה להתחבר אליך`,
      ts: 0,  // friendships לא מחזיק חותמת זמינה כאן — תמיד "חדש" עד שמטפלים
      alwaysNew: true,
    })
  }

  // 2. הזמנות למשחק
  for (const inv of invites) {
    items.push({
      id: `invite_${inv.id}`,
      type: 'invite',
      title: 'הזמנה למשחק',
      body: `${inv.fromName} מזמין אותך ל${GAME_NAMES[inv.gameType] || 'משחק'}`,
      ts: toMillis(inv.createdAt),
      alwaysNew: true,
    })
  }

  // 3. הודעות צ'אט שלא נקראו — רק שיחות שבהן ההודעה האחרונה היא מהצד השני
  for (const c of chats) {
    if (!c.lastSenderUid || c.lastSenderUid === myUid) continue  // ההודעה האחרונה שלי — לא התראה
    items.push({
      id: `chat_${c.chatId}`,
      type: 'chat',
      title: `הודעה מ${c.lastSenderName || 'חבר'}`,
      body: c.lastText || '',
      ts: c.lastAt || 0,
      otherUid: c.otherUid,
      otherName: c.lastSenderName,
    })
  }

  // 4. לייקים על מתכון/עצה שלי — לכל פוסט עם לייקים, התראה אחת מסכמת
  for (const p of myPosts) {
    const likes = p.likes || []
    if (likes.length === 0) continue
    const kindLabel = p.kind === 'recipe' ? 'המתכון' : 'העצה'
    items.push({
      id: `like_${p.id}`,
      type: 'like',
      title: 'מישהו אהב את התוכן שלך ❤',
      body: `${likes.length} ${likes.length === 1 ? 'אדם אהב' : 'אנשים אהבו'} את ${kindLabel} "${p.title}"`,
      ts: toMillis(p.createdAt),  // אין חותמת ללייק עצמו — נשתמש בזמן הפוסט
      likeCount: likes.length,
      postId: p.id,
      kind: p.kind,
    })
  }

  // 5. התראות ניהול/מערכת — אישור/דחיית תוכן, הודעה מההנהלה
  for (const n of sysNotifs) {
    items.push({
      id: `sys_${n.id}`,
      type: n.type || 'admin',
      title: n.title || 'הודעה',
      body: n.body || '',
      ts: toMillis(n.createdAt),
    })
  }

  // קובעים מה "חדש": alwaysNew (בקשות/הזמנות שעדיין פתוחות) או ts אחרי seenAt
  const withNew = items.map(it => ({
    ...it,
    isNew: it.alwaysNew ? true : (it.ts > seenAt),
  }))

  // ממיינים מהחדש לישן (alwaysNew קודם, אחר כך לפי זמן)
  withNew.sort((a, b) => {
    if (a.alwaysNew && !b.alwaysNew) return -1
    if (!a.alwaysNew && b.alwaysNew) return 1
    return (b.ts || 0) - (a.ts || 0)
  })

  const unseenCount = withNew.filter(it => it.isNew).length

  return { items: withNew, unseenCount }
}
