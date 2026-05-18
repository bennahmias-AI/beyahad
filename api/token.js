import { AccessToken } from 'livekit-server-sdk'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { room, username } = req.query

  if (!room || !username) {
    res.status(400).json({ error: 'room and username required' })
    return
  }

  const API_KEY = process.env.LIVEKIT_API_KEY
  const API_SECRET = process.env.LIVEKIT_API_SECRET

  if (!API_KEY || !API_SECRET) {
    res.status(500).json({ error: 'LiveKit credentials not configured' })
    return
  }

  try {
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: username,
      ttl: '2h',
    })

    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    })

    const token = await at.toJwt()

    res.status(200).json({ token })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
