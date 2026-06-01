// src/hooks/useVoiceRecorder.js
// ─────────────────────────────────────────────────────────────
// Hook להקלטה קולית באמצעות MediaRecorder API.
//
// מחזיר:
//   recording   — האם מקליטים כרגע
//   seconds     — כמה שניות הוקלטו (לטיימר)
//   error       — הודעת שגיאה (למשל אם אין הרשאת מיקרופון)
//   start()     — מתחיל הקלטה (מבקש הרשאת מיקרופון)
//   stop()      — עוצר ומחזיר Promise עם { blob, durationSec }
//   cancel()    — עוצר ומבטל בלי להחזיר כלום
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)
  const cancelledRef = useRef(false)

  // ניקוי בעת הסרת הקומפוננטה
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const start = async () => {
    setError('')
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // בוחרים פורמט נתמך (webm/opus ברוב הדפדפנים, mp4 ב-Safari)
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4'
        else mimeType = ''
      }
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.start()

      startTimeRef.current = Date.now()
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 250)
    } catch (e) {
      console.error('useVoiceRecorder start error:', e)
      setError('לא הצלחנו לגשת למיקרופון. ודאו שאישרתם הרשאה.')
      setRecording(false)
    }
  }

  // עוצר ומחזיר Promise<{ blob, durationSec }>. אם בוטל — מחזיר null.
  const stop = () => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      if (!mr || mr.state === 'inactive') { resolve(null); return }

      const durationSec = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))

      mr.onstop = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
        setRecording(false)
        if (cancelledRef.current) { resolve(null); return }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        resolve({ blob, durationSec })
      }
      mr.stop()
    })
  }

  const cancel = async () => {
    cancelledRef.current = true
    await stop()
  }

  return { recording, seconds, error, start, stop, cancel }
}
