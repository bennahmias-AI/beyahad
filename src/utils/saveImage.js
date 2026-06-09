// src/utils/saveImage.js
// ─────────────────────────────────────────────────────────────
// שמירה ושיתוף של תמונת ברכה (PNG/JPG) — חכם לפי סביבה:
//   • באפליקציה (Capacitor native / אנדרואיד):
//       - שמירה: לגלריית התמונות דרך @capacitor/filesystem
//         (תיקיית Pictures/ביחד).
//       - שיתוף: כותב קובץ זמני ל-Cache ופותח את חלון השיתוף
//         של אנדרואיד דרך @capacitor/share.
//     זה הכרחי כי ב-WebView גם <a download> וגם navigator.share
//     (עם קבצים) בדרך כלל לא עובדים.
//   • בדפדפן רגיל: שמירה = הורדה דרך <a download>;
//     שיתוף = navigator.share אם קיים, אחרת fallback של המסך.
//
// כל הפונקציות מחזירות { ok, where?/method?, error? } כדי שהמסך
// יוכל להציג הודעה במקום ליפול בשקט.
// ─────────────────────────────────────────────────────────────
import { Capacitor } from '@capacitor/core'

const isNative = () => {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

// ממיר Blob ל-base64 (ללא הקידומת data:...;base64,)
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = String(reader.result || '')
      const comma = res.indexOf(',')
      resolve(comma >= 0 ? res.slice(comma + 1) : res)
    }
    reader.onerror = () => reject(new Error('blob to base64 failed'))
    reader.readAsDataURL(blob)
  })
}

// הורדה רגילה בדפדפן (blob → <a download>)
function browserDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ═══════════════════════════════════════════════════════════════
// שמירה
// ═══════════════════════════════════════════════════════════════
async function nativeSaveToGallery(blob, filename) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const base64 = await blobToBase64(blob)
  // ExternalStorage → /storage/emulated/0/ ; תחת Pictures/ביחד כדי שיופיע בגלריה
  await Filesystem.writeFile({
    path: `Pictures/\u05d1\u05d9\u05d7\u05d3/${filename}`,
    data: base64,
    directory: Directory.ExternalStorage,
    recursive: true,
  })
  return { ok: true, where: 'gallery' }
}

export async function saveImageBlob(blob, filename = '\u05d1\u05e8\u05db\u05d4.png') {
  if (!blob) return { ok: false, error: 'no blob' }
  try {
    if (isNative()) return await nativeSaveToGallery(blob, filename)
    browserDownload(blob, filename)
    return { ok: true, where: 'download' }
  } catch (e) {
    console.error('saveImageBlob failed', e)
    // גיבוי — הורדת דפדפן
    try { browserDownload(blob, filename); return { ok: true, where: 'download' } }
    catch (e2) { return { ok: false, error: e2 || e } }
  }
}

// ═══════════════════════════════════════════════════════════════
// שיתוף
// ═══════════════════════════════════════════════════════════════
// ב-native: כותב קובץ זמני ל-Cache ומשתף את ה-URI שלו.
async function nativeShare(blob, filename, title) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const base64 = await blobToBase64(blob)
  const writeRes = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  })
  // צריך URI מלא (file://...) לשיתוף
  const uriRes = writeRes?.uri
    ? writeRes
    : await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  await Share.share({
    title: title || '\u05d1\u05e8\u05db\u05d4 \u05de\u05d0\u05e4\u05dc\u05d9\u05e7\u05e6\u05d9\u05d9\u05ea \u05d1\u05d9\u05d7\u05d3',
    text: title || '',
    files: [uriRes.uri],
  })
  return { ok: true, method: 'native-share' }
}

// בדפדפן: navigator.share עם קובץ אם אפשר; אחרת מחזיר notSupported
// כדי שהמסך יחליט על fallback (וואטסאפ / הורדה).
async function browserShare(blob, filename, title) {
  try {
    const file = new File([blob], filename, { type: blob.type || 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: title || '', text: title || '' })
      return { ok: true, method: 'web-share-files' }
    }
    if (navigator.share) {
      await navigator.share({ title: title || '', text: title || '' })
      return { ok: true, method: 'web-share-text' }
    }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: true, method: 'aborted' }
    console.error('browserShare failed', e)
  }
  return { ok: false, notSupported: true }
}

export async function shareImageBlob(blob, filename = '\u05d1\u05e8\u05db\u05d4.png', title = '') {
  if (!blob) return { ok: false, error: 'no blob' }
  try {
    if (isNative()) return await nativeShare(blob, filename, title)
    return await browserShare(blob, filename, title)
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: true, method: 'aborted' }
    console.error('shareImageBlob failed', e)
    return { ok: false, error: e }
  }
}
