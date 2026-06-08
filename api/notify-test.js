// api/notify-test.js — מנוטרל (כלי אבחון זמני, לא בשימוש)
export default function handler(req, res) {
  res.status(410).json({ ok: false, error: 'diagnostic disabled' })
}
