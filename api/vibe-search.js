const vibeMap = [
  { keywords: ['quiet', 'solo', 'reading', 'study'], search: ['library', 'cafe', 'bookstore'] },
  { keywords: ['evening photography', 'photography', 'sunset', 'viewpoint'], search: ['rooftop', 'henderson waves', 'gardens by the bay'] },
  { keywords: ['date night', 'romantic', 'date'], search: ['rooftop bar', 'fine dining', 'restaurant'] },
  { keywords: ['local eats', 'hawker', 'cheap food', 'singaporean food'], search: ['hawker centre', 'kopitiam', 'food court'] },
  { keywords: ['post-run', 'run', 'chill', 'relax'], search: ['cafe', 'park', 'juice bar'] },
  { keywords: ['coffee', 'cafe', 'work'], search: ['cafe', 'coffee', 'coworking'] },
  { keywords: ['nature', 'green', 'park', 'outdoor'], search: ['park', 'garden', 'nature reserve'] },
  { keywords: ['art', 'museum', 'culture'], search: ['museum', 'art gallery', 'heritage'] },
  { keywords: ['bar', 'drinks', 'nightlife'], search: ['bar', 'rooftop bar', 'cocktail bar'] },
]

const groqSystemPrompt = `You are a hyperlocal Singapore city guide.
Convert a vibe description into 1-3 short POI search keywords for Singapore.
Reply with ONLY a JSON array of strings. No explanation, no markdown, no backticks.
Examples:
"quiet spots for reading" -> ["library", "cafe", "bookstore"]
"date night" -> ["rooftop bar", "fine dining", "restaurant"]
"post-run chill" -> ["cafe", "juice bar", "park"]
"evening photography" -> ["rooftop", "viewpoint", "heritage"]
"local eats" -> ["hawker centre", "kopitiam", "food court"]`

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getHardcodedKeywords(query) {
  const q = (query || '').toLowerCase()
  for (const vibe of vibeMap) {
    if (vibe.keywords.some(k => q.includes(k))) {
      return vibe.search
    }
  }

  return ['cafe', 'park', 'restaurant']
}

function profilePrompt(profile = {}, neighbourhood) {
  const interests = Array.isArray(profile.interests) ? profile.interests.join(', ') : ''
  return `User profile: age ${profile.age || 'unknown'}, lives in ${profile.neighbourhood || 'unknown'}, interests: ${interests || 'unknown'}.
User is currently in: ${neighbourhood || 'Singapore'}. Prioritise places near them.`
}

async function callGroq(query, profile, neighbourhood) {
  if (!process.env.GROQ_KEY) {
    throw new Error('Missing GROQ_KEY')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: groqSystemPrompt },
        { role: 'user', content: `${profilePrompt(profile, neighbourhood)}\n\nVibe query: ${query}` }
      ],
      max_tokens: 150,
      temperature: 0.3
    })
  })

  const data = await response.json()
  if (!response.ok) {
    console.log('Groq error response:', JSON.stringify(data))
    throw new Error(`Groq HTTP ${response.status}: ${data.error?.message}`)
  }

  const text = data.choices?.[0]?.message?.content?.trim() || '[]'
  const parsed = JSON.parse(text)

  if (!Array.isArray(parsed)) return []

  return parsed
    .filter(keyword => typeof keyword === 'string')
    .map(keyword => keyword.trim())
    .filter(Boolean)
    .slice(0, 3)
}

async function grabFetch(url, key) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${key}` }
      })
      const text = await res.text()

      if (!res.ok) {
        console.log(`GrabMaps HTTP ${res.status}:`, text)
        throw new Error(`GrabMaps HTTP ${res.status}`)
      }

      try {
        return JSON.parse(text)
      } catch (error) {
        console.log('GrabMaps non-JSON response:', text)
        throw error
      }
    } catch (error) {
      console.log(`GrabMaps fetch attempt ${attempt + 1} failed:`, error.message)
      if (attempt === 0) await wait(800)
    }
  }

  return {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { query, profile, lat = 1.3521, lng = 103.8198, neighbourhood } = req.body

  let keywords = getHardcodedKeywords(query)
  try {
    const groqResult = await callGroq(query, profile, neighbourhood)
    if (groqResult && groqResult.length > 0) keywords = groqResult
  } catch (error) {
    console.log('Groq unavailable, using fallback:', error.message)
  }

  try {
    const allResults = await Promise.all(keywords.map(async keyword => {
      const params = new URLSearchParams({
        keyword, country: 'SGP', location: `${lat},${lng}`, limit: '3'
      })
      try {
        const grabData = await grabFetch('https://maps.grab.com/api/v1/maps/poi/v1/search?' + params, process.env.GRABMAPS_KEY)
        return (grabData.places ?? []).map(p => ({ ...p, _keyword: keyword }))
      } catch (error) {
        console.log(`GrabMaps keyword search failed for "${keyword}":`, error.message)
        return []
      }
    }))

    const seen = new Set()
    const results = allResults.flat().filter(p => {
      if (!p.poi_id || seen.has(p.poi_id)) return false
      seen.add(p.poi_id)
      return true
    }).slice(0, 6)

    res.status(200).json({ keywords, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export const config = { api: { bodyParser: true } }
