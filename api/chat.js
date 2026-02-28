// api/chat.js
// Vercel Serverless Function — proxies requests to Anthropic.
// The system prompt is injected here (server-side) with cache_control so
// Anthropic caches it between calls, cutting costs ~90% on repeat requests.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server.' })
  }

  const { messages, system, model, max_tokens } = req.body

  // Wrap the system prompt as a content block with cache_control.
  // Anthropic will cache this on the first call and reuse it for 5–60 min,
  // charging only 10% of the normal input token cost on cache hits.
  const systemWithCache = [
    {
      type: 'text',
      text: system,
      cache_control: { type: 'ephemeral' },
    },
  ]

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',   // required to enable caching
      },
      body: JSON.stringify({
        model,
        max_tokens,
        system: systemWithCache,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    // Log cache stats in server logs so you can verify it's working
    if (data.usage) {
      const u = data.usage
      console.log(
        `[cache] input=${u.input_tokens} | cache_read=${u.cache_read_input_tokens ?? 0} | cache_write=${u.cache_creation_input_tokens ?? 0} | output=${u.output_tokens}`
      )
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('Proxy error:', err)
    return res.status(500).json({ error: 'Failed to reach Anthropic API.' })
  }
}
