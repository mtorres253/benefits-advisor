// dev-server.js
// Run this locally alongside `npm run dev` to test the API proxy.
// Usage: node dev-server.js
// Requires: npm install express dotenv (one-time, already in devDependencies)

import express from 'express'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const app = express()
app.use(express.json())

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in .env.local' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Proxy failed' })
  }
})

app.listen(3001, () => {
  console.log('✅ Dev API proxy running on http://localhost:3001')
  console.log('   Run `npm run dev` in another terminal to start Vite.')
})
