/**
 * api/chat.js
 * POST /api/chat
 *
 * Three layers of cost reduction:
 *  1. Response cache  — identical (location + veteran status) queries return stored
 *                       answers instantly with zero API cost. TTL: 24 hours.
 *  2. Prompt caching  — Anthropic caches the system prompt tokens (~90% cheaper
 *                       on repeat calls within the cache window).
 *  3. Auth enrichment — veteran status read from stored profile server-side.
 *
 * Cache key = sha256( normalized_location + "|" + isVeteran )
 * This means "Tustin CA", "tustin, ca", "Tustin, CA" all hit the same cache entry.
 */

import { createHash } from 'crypto'
import { authFromHeader } from '../lib/auth.js'
import { getUserById } from '../lib/db.js'

// ── In-process response cache (works in both dev and prod serverless) ─────────
// For production at scale, swap this Map for a Vercel KV get/set.
// Each serverless instance has its own Map, but most repeated searches from the
// same user will land on the same warm instance within a session.
const responseCache = new Map()
const CACHE_TTL_MS  = 24 * 60 * 60 * 1000  // 24 hours

function cacheKey(location, isVeteran) {
  const normalized = location.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(normalized + '|' + isVeteran).digest('hex').slice(0, 16)
}

function getCached(key) {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { responseCache.delete(key); return null }
  return entry.value
}

function setCached(key, value) {
  // Evict oldest entries if cache grows large (>500 entries)
  if (responseCache.size >= 500) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100)
    oldest.forEach(([k]) => responseCache.delete(k))
  }
  responseCache.set(key, { value, ts: Date.now() })
}

// ── Extract the primary location from the last user message ──────────────────
// We only cache single-location first queries, not multi-turn follow-ups.
function extractLocation(messages) {
  if (messages.length !== 1) return null   // only cache first query
  const text = messages[0].content ?? ''
  // Strip our appended context annotations
  const clean = text.replace(/\[Context:.*?\]/gs, '').replace(/\[Please search.*?\]/g, '').trim()
  if (clean.length > 120) return null      // too long to be a simple location query
  return clean
}

// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' })

  let { messages, system, model, max_tokens } = req.body

  // ── Auth enrichment ────────────────────────────────────────────────────────
  let isVeteranFromProfile = false
  const decoded = authFromHeader(req.headers.authorization)
  if (decoded) {
    try {
      const user = await getUserById(decoded.sub)
      if (user?.isVeteran) {
        isVeteranFromProfile = true
        if (!system.includes('VETERAN STATUS')) {
          system += '\n\nVETERAN STATUS: This user is a verified veteran (from their saved profile). Always include veteran-specific benefits.'
        }
      }
    } catch (_) {}
  }

  const isVeteran = isVeteranFromProfile || system.includes('VETERAN STATUS')

  // ── Response cache check ───────────────────────────────────────────────────
  const location = extractLocation(messages)
  const key      = location ? cacheKey(location, isVeteran) : null

  if (key) {
    const cached = getCached(key)
    if (cached) {
      console.log('[response-cache] HIT key=' + key + ' location="' + location + '"')
      // Return in the same shape the client expects
      return res.status(200).json({
        content: [{ type: 'text', text: cached }],
        _fromCache: true,
      })
    }
    console.log('[response-cache] MISS key=' + key + ' location="' + location + '"')
  }

  // ── Prompt caching (system prompt token reuse) ─────────────────────────────
  const systemWithCache = [
    { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
  ]

  // ── Call Anthropic ─────────────────────────────────────────────────────────
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

    // Log token usage so you can verify both cache layers
    if (data.usage) {
      const u = data.usage
      console.log(
        '[anthropic] input=' + u.input_tokens +
        ' prompt_cache_read=' + (u.cache_read_input_tokens ?? 0) +
        ' prompt_cache_write=' + (u.cache_creation_input_tokens ?? 0) +
        ' output=' + u.output_tokens
      )
    }

    // Store the response text for future identical queries
    if (key) {
      const text = data.content?.map(b => b.text || '').join('')
      if (text) setCached(key, text)
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('[chat]', err)
    return res.status(500).json({ error: 'Failed to reach Anthropic API' })
  }
}
