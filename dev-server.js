/**
 * dev-server.js
 * Local Express server that mirrors all Vercel serverless functions.
 * Run alongside `npm run dev` (Vite) for local full-stack development.
 *
 * Usage:
 *   node dev-server.js        (Terminal 1)
 *   npm run dev               (Terminal 2)
 */

import express from 'express'
import dotenv from 'dotenv'
import { createRequire } from 'module'

dotenv.config({ path: '.env.local' })

const app = express()
app.use(express.json())

// Dynamically load and call each handler
async function loadHandler(path) {
  const mod = await import(path + '?t=' + Date.now())
  return mod.default
}

// Helper: create a minimal req/res shim compatible with Vercel handler signature
function mount(routePath, modulePath) {
  app.all(routePath, async (req, res) => {
    try {
      const handler = await loadHandler(modulePath)
      await handler(req, res)
    } catch (err) {
      console.error('[dev-server]', err)
      if (!res.headersSent) res.status(500).json({ error: err.message })
    }
  })
}

mount('/api/chat',               './api/chat.js')
mount('/api/auth/register',      './api/auth/register.js')
mount('/api/auth/login',         './api/auth/login.js')
mount('/api/auth/profile',       './api/auth/profile.js')

app.listen(3001, () => {
  console.log('✅ Dev API server running on http://localhost:3001')
  console.log('   Routes:')
  console.log('     POST /api/chat')
  console.log('     POST /api/auth/register')
  console.log('     POST /api/auth/login')
  console.log('     GET  /api/auth/profile')
  console.log('     PATCH /api/auth/profile')
  console.log('')
  console.log('   Run `npm run dev` in another terminal to start Vite.')
})
