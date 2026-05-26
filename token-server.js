// token-server.js — LiveKit token generator
// מיקום: C:\Users\User\Desktop\beyahad\token-server.js
// הרצה: node token-server.js (בחלון CMD נפרד)

import 'dotenv/config'
import http from 'http'
import { AccessToken } from 'livekit-server-sdk'

const PORT = 8080
const API_KEY = process.env.LIVEKIT_API_KEY
const API_SECRET = process.env.LIVEKIT_API_SECRET

if (!API_KEY || !API_SECRET) {
  console.error('❌ LIVEKIT_API_KEY or LIVEKIT_API_SECRET missing in .env file')
  process.exit(1)
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === '/token') {
    const room = url.searchParams.get('room')
    const username = url.searchParams.get('username') || 'anonymous'
    const uid = url.searchParams.get('uid') || ''

    if (!room) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'room parameter required' }))
      return
    }

    try {
      // identity carries the uid so the app can map participants
      // back to real user accounts (needed for the friends system).
      // Format: "<uid>__<random>"  (falls back to username if no uid)
      const identity = (uid || username) + '__' + Math.random().toString(36).slice(2, 8)
      const at = new AccessToken(API_KEY, API_SECRET, {
        identity,
        name: username,
      })
      at.addGrant({
        roomJoin: true,
        room,
        canPublish: true,
        canSubscribe: true,
      })

      const token = await at.toJwt()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ token }))
      console.log(`✓ Token issued for room=${room}, user=${username}`)
    } catch (e) {
      console.error('Token generation error:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`🚀 LiveKit token server running on http://localhost:${PORT}`)
  console.log(`   Token endpoint: http://localhost:${PORT}/token?room=ROOM&username=USER`)
})
