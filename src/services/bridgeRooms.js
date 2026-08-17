// src/services/bridgeRooms.js
// ─────────────────────────────────────────────────────────────
// שכבת Firestore לברידג' אונליין (אוסף bridgeRooms).
//
// למה קובץ נפרד ולא בתוך firebase.js? הקובץ ההוא כבר ענק (~3300 שורות),
// והפונקציות כאן עומדות בפני עצמן. משתמשים ב-db המיוצא משם.
//
// מבנה מסמך חדר:
//   {
//     hostUid, status: 'waiting' | 'playing' | 'ended',
//     isPrivate: boolean,              // חדר חברים לא ישודך אקראית
//     players: [{ id, name, photoURL }],   // עד 4
//     stateJson: string | null,        // מצב המשחק המלא כ-JSON (Firestore לא תומך במערך בתוך מערך)
//     seq: number,                     // מונה עולה — מזהה עדכון אחרון
//     createdAt, updatedAt
//   }
// צ'אט: תת-אוסף bridgeRooms/{roomId}/chat
// ─────────────────────────────────────────────────────────────
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
  collection, query, where, getDocs, orderBy, limit, addDoc,
} from 'firebase/firestore'
import { db } from './firebase.js'

const ROOMS = 'bridgeRooms'
const roomRef = (roomId) => doc(db, ROOMS, roomId)

// מזהה חדר קצר וקריא
function newRoomId() {
  return 'br-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

const asPlayer = (p) => ({
  id: p.id || p.uid,
  name: p.name || 'שחקן',
  photoURL: p.photoURL || null,
})

// ── יצירת חדר ─────────────────────────────────────────────
export async function createBridgeRoom(host, { isPrivate = false } = {}) {
  const roomId = newRoomId()
  const player = asPlayer(host)
  await setDoc(roomRef(roomId), {
    hostUid: player.id,
    status: 'waiting',
    isPrivate: !!isPrivate,
    players: [player],
    stateJson: null,
    seq: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return roomId
}

// ── הצטרפות לחדר קיים ─────────────────────────────────────
// מחזיר { ok, reason }. לא משתמשים ב-arrayUnion כדי לאכוף מקסימום 4 ולמנוע כפילויות.
export async function joinBridgeRoom(roomId, joiner) {
  const player = asPlayer(joiner)
  const snap = await getDoc(roomRef(roomId))
  if (!snap.exists()) return { ok: false, reason: 'not-found' }
  const room = snap.data()
  if (room.status === 'ended') return { ok: false, reason: 'ended' }

  const players = room.players || []
  if (players.some(p => p.id === player.id)) return { ok: false, reason: 'already-in' }
  if (players.length >= 4) return { ok: false, reason: 'full' }
  if (room.status === 'playing') return { ok: false, reason: 'started' }

  await updateDoc(roomRef(roomId), {
    players: [...players, player],
    updatedAt: serverTimestamp(),
  })
  return { ok: true }
}

// ── מעקב אחרי החדר בזמן אמת ───────────────────────────────
export function watchBridgeRoom(roomId, cb) {
  return onSnapshot(roomRef(roomId), (snap) => {
    if (!snap.exists()) { cb(null); return }
    const data = snap.data()
    let state = null
    if (data.stateJson) {
      try { state = JSON.parse(data.stateJson) } catch { state = null }
    }
    cb({ id: snap.id, ...data, state })
  }, () => cb(null))
}

// ── התחלת משחק (המארח בלבד) ───────────────────────────────
export async function startBridgeGame(roomId, state) {
  await updateDoc(roomRef(roomId), {
    status: 'playing',
    stateJson: JSON.stringify(state),
    seq: (state && state.seq) || 1,
    updatedAt: serverTimestamp(),
  })
}

// ── עדכון מצב המשחק ───────────────────────────────────────
// רק מי שבתורו כותב. seq עולה כדי שנוכל להתעלם מעדכונים ישנים.
export async function updateBridgeState(roomId, state) {
  await updateDoc(roomRef(roomId), {
    stateJson: JSON.stringify(state),
    seq: (state && state.seq) || 0,
    status: state && state.phase === 'done' ? 'playing' : 'playing',
    updatedAt: serverTimestamp(),
  })
}

// ── עזיבת חדר ─────────────────────────────────────────────
// אם לא נשאר אף אחד — מוחקים את החדר.
export async function leaveBridgeRoom(roomId, uid) {
  try {
    const snap = await getDoc(roomRef(roomId))
    if (!snap.exists()) return
    const room = snap.data()
    const players = (room.players || []).filter(p => p.id !== uid)
    if (!players.length) { await deleteDoc(roomRef(roomId)); return }
    await updateDoc(roomRef(roomId), {
      players,
      hostUid: room.hostUid === uid ? players[0].id : room.hostUid,
      updatedAt: serverTimestamp(),
    })
  } catch (e) { /* עזיבה היא best-effort */ }
}

// ── סימון סיום ────────────────────────────────────────────
export async function endBridgeRoom(roomId) {
  try { await updateDoc(roomRef(roomId), { status: 'ended', updatedAt: serverTimestamp() }) } catch (e) { /* ignore */ }
}

// ── שידוך אקראי ───────────────────────────────────────────
// מחפש חדר ציבורי שממתין ויש בו מקום; אם אין — פותח חדש.
export async function findOrCreateBridgeMatch(player) {
  const me = asPlayer(player)
  try {
    // תנאי שוויון בודד בלבד — שילוב של שני where + orderBy דורש
    // אינדקס משולב ב-Firestore, ובלעדיו השאילתה נכשלת —
    // ואז כל שחקן היה פותח חדר משל עצמו במקום להצטרף.
    const q = query(collection(db, ROOMS), where('status', '==', 'waiting'), limit(20))
    const snaps = await getDocs(q)
    const rooms = snaps.docs
      .map(s => ({ id: s.id, data: s.data() }))
      .filter(r => !r.data.isPrivate)
      .filter(r => {
        const n = (r.data.players || []).length
        return n > 0 && n < 4
      })
      .filter(r => !(r.data.players || []).some(p => p.id === me.id))
      .sort((a, b) => {
        const ta = a.data.createdAt && a.data.createdAt.seconds ? a.data.createdAt.seconds : 0
        const tb = b.data.createdAt && b.data.createdAt.seconds ? b.data.createdAt.seconds : 0
        return ta - tb   // הישן ביותר קודם — כך כולם מתכנסים לאותו שולחן
      })
    for (const r of rooms) {
      const res = await joinBridgeRoom(r.id, me)
      if (res.ok) return { roomId: r.id, created: false }
    }
  } catch (e) {
    console.error('findOrCreateBridgeMatch query failed:', e)
  }
  const roomId = await createBridgeRoom(me, { isPrivate: false })
  return { roomId, created: true }
}

// ── צ'אט ──────────────────────────────────────────────────
export async function sendBridgeChat(roomId, { uid, name, text }) {
  const clean = String(text || '').trim().slice(0, 400)
  if (!clean) return
  await addDoc(collection(db, ROOMS, roomId, 'chat'), {
    uid, name: name || 'שחקן', text: clean, ts: serverTimestamp(),
  })
}

export function watchBridgeChat(roomId, cb) {
  const q = query(collection(db, ROOMS, roomId, 'chat'), orderBy('ts', 'asc'), limit(100))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, () => cb([]))
}
