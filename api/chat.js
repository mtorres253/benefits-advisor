/**
 * api/chat.js
 * POST /api/chat
 *
 * Proxies requests to Anthropic with:
 *  - Server-side API key injection
 *  - Prompt caching (saves ~90% on repeat system prompt tokens)
 *  - Optional auth: if a valid JWT is present, veteran status is read from
 *    the stored profile so the client does not need to send it manually
 */

import { authFromHeader } from '../lib/auth.js'
import { getUserById } from '../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })

  let { messages, system, model, max_tokens } = req.body

  // Optional: enrich from user profile.
  // If a logged-in user sends a JWT, we read their stored isVeteran flag.
  const decoded = authFromHeader(req.headers.authorization)
  if (decoded) {
    try {
      const user = await getUserById(decoded.sub)
      if (user?.isVeteran && !system.includes('VETERAN STATUS')) {
        system += '\n\nVETERAN STATUS: This user is a verified veteran (from their saved profile). Always include veteran-specific benefits.'
      }
    } catch (_) {
      // Non-fatal
    }
  }

  const systemWithCache = [
    { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
  ]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({ model, max_tokens, system: systemWithCache, messages }),
    })

    const data = await response.json()
    if (!response.ok) return res.status(response.status).json(data)

    if (data.usage) {
      const u = data.usage
      console.log('[cache] input=' + u.input_tokens + ' read=' + (u.cache_read_input_tokens ?? 0) + ' write=' + (u.cache_creation_input_tokens ?? 0) + ' output=' + u.output_tokens)
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('[chat]', err)
    return res.status(500).json({ error: 'Failed to reach Anthropic API' })
  }
}
