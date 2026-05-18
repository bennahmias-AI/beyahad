// token-server.js — ESM version
import 'dotenv/config'
import http from 'http'
import { parse } from 'url'
import { AccessToken } from 'livekit-server-sdk'

const API_KEY    = process.env.LIVEKIT_API_KEY
const API_SECRET = process.env.LIVEKIT_API_SECRET
const PORT       = process.env.PORT || 8080

if (!API_KEY || !API_SECRET) {
  console.error('❌  Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env')
  process.exit(1)
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const { pathname, query } = parse(req.url, true)

  if (pathname !== '/token') {
    res.writeHead(404); res.end('Not found'); return
  }

  const { room, username } = query
  if (!room || !username) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'room and username required' }))
    return
  }

  try {
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity: username,
      ttl: '2h',
    })
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })

    const token = await at.toJwt()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ token }))
    console.log(`✅ Token: room=${room} user=${username}`)
  } catch (e) {
    console.error(e)
    res.writeHead(500)
    res.end(JSON.stringify({ error: e.message }))
  }
})

server.listen(PORT, () => {
  console.log(`\n🚀 Token server running on http://localhost:${PORT}`)
  console.log(`   GET /token?room=ROOM&username=NAME\n`)
})
