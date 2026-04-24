const journeyTemplates = [
  {
    keywords: ['run', 'jog', 'running', '5km', '10km', '3km', 'exercise'],
    location: '1.2966,103.7764',
    stops: [
      { search: 'park', duration: '25 min', vibe_desc: 'Start with an easy warm-up at a nearby running-friendly green space.' },
      { search: 'park connector', duration: '25 min', vibe_desc: 'Keep the route moving through a nearby connector or scenic path.' },
      { search: 'cafe', duration: '30 min', vibe_desc: 'Cool down with a post-run drink close to the route.' }
    ]
  },
  {
    keywords: ['solo', 'quiet', 'reading', 'chill', 'post-run', 'relax'],
    location: '1.2848,103.8304',
    stops: [
      { search: 'Tiong Bahru Bakery Foothills', duration: '45 min', vibe_desc: 'Start with a quiet coffee — decompress and reset.' },
      { search: 'Books Actually Tiong Bahru', duration: '30 min', vibe_desc: 'Browse slowly. No agenda, just good shelves.' },
      { search: 'Tiong Bahru Park', duration: '40 min', vibe_desc: 'End with a slow walk as the sky goes golden.' }
    ]
  },
  {
    keywords: ['date', 'romantic', 'evening', 'night'],
    location: '1.2807,103.8416',
    stops: [
      { search: 'Potato Head Singapore Keong Saik', duration: '45 min', vibe_desc: 'Start with sunset drinks and a view.' },
      { search: 'Thevar Keong Saik', duration: '60 min', vibe_desc: 'Dinner somewhere worth dressing up for.' },
      { search: 'Duxton Hill Singapore', duration: '30 min', vibe_desc: 'End with a slow neighbourhood walk.' }
    ]
  },
  {
    keywords: ['photography', 'photo', 'sunset', 'viewpoint'],
    location: '1.2784,103.8107',
    stops: [
      { search: 'Henderson Waves', duration: '40 min', vibe_desc: 'Best golden hour view in the south.' },
      { search: 'Telok Blangah Hill Park', duration: '30 min', vibe_desc: 'Heritage greenery, great textures for photos.' },
      { search: 'Mount Faber Peak', duration: '40 min', vibe_desc: 'End high up for the city lights shot.' }
    ]
  },
  {
    keywords: ['food', 'eat', 'hawker', 'local', 'hungry', 'dinner', 'friends', 'restaurant'],
    location: '1.2803,103.8449',
    stops: [
      { search: 'Maxwell Food Centre', duration: '40 min', vibe_desc: 'Start with the classics — chicken rice or laksa.' },
      { search: 'Chinatown Complex Food Centre', duration: '30 min', vibe_desc: 'Walk it off through the old streets.' },
      { search: 'Nanyang Old Coffee Chinatown', duration: '30 min', vibe_desc: 'End with kopi and something sweet.' }
    ]
  },
]

const groqSystemPrompt = `You are a hyperlocal Singapore city guide that plans personalised evening or activity routes.
Understand the user's intent from their prompt:
- If they mention "run", "jog", "walk" → plan a route with scenic running/walking spots connected by a path
- If they mention "dinner", "food", "eat", "friends" → plan food spots with a walk/chill spot after
- If they mention "date", "romantic" → plan drinks + dinner + scenic walk
- If they mention "solo", "quiet", "chill" → plan quiet cafe + browsing + park
- If they mention "photography", "sunset", "photo" → plan viewpoints timed for golden hour

Rules:
- All 3 stops must be in the SAME neighbourhood or within 1km of each other
- Stop names must be REAL Singapore places that exist on GrabMaps
- Vibe descriptions must match the activity (running route = energising descriptions, dinner = food descriptions)
- Duration should reflect the activity (running stop = 20-30 min, dinner = 60 min, cafe = 45 min)

Reply with ONLY a JSON array, no markdown, no backticks:
[
  { "search": "specific real place name", "duration": "X min", "vibe_desc": "activity-appropriate one line description" },
  ...
]`

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getHardcodedTemplate(prompt) {
  const q = (prompt || '').toLowerCase()
  for (const template of journeyTemplates) {
    if (template.keywords.some(k => q.includes(k))) {
      return template
    }
  }

  return journeyTemplates[0]
}

function detectJourneyType(prompt) {
  const q = (prompt || '').toLowerCase()
  let journeyType = 'chill'
  if (/run|jog|running|5km|10km|3km|exercise/.test(q)) journeyType = 'run'
  if (/dinner|food|eat|hawker|restaurant/.test(q)) journeyType = 'food'
  if (/date|romantic/.test(q)) journeyType = 'date'
  if (/photo|sunset|photography/.test(q)) journeyType = 'photography'
  return journeyType
}

function normalizeGroqStops(stops) {
  if (!Array.isArray(stops) || stops.length !== 3) return []

  return stops.map(stop => ({
    search: typeof stop.search === 'string' ? stop.search.trim() : '',
    duration: typeof stop.duration === 'string' ? stop.duration.trim() : '30 min',
    vibe_desc: typeof stop.vibe_desc === 'string' ? stop.vibe_desc.trim() : 'A nearby stop that fits the mood.'
  })).filter(stop => stop.search)
}

function profilePrompt(profile = {}, neighbourhood) {
  const interests = Array.isArray(profile.interests) ? profile.interests.join(', ') : ''
  return `User profile: age ${profile.age || 'unknown'}, lives in ${profile.neighbourhood || 'unknown'}, interests: ${interests || 'unknown'}.
User is currently in: ${neighbourhood || 'Singapore'}. Prioritise places near them.`
}

function getGroqSystemPrompt(journeyType, neighbourhood) {
  if (journeyType === 'run') {
    return `${groqSystemPrompt}

Plan a running route with 3 stops. Stop 1 and 2 should be parks or running spots near ${neighbourhood || 'the mentioned location'}. Stop 3 should be a cafe or chill spot for post-run. Keep stops within 3km of each other. Return JSON with stops array.`
  }

  return groqSystemPrompt
}

async function callGroq(prompt, profile, neighbourhood, journeyType) {
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
        { role: 'system', content: getGroqSystemPrompt(journeyType, neighbourhood) },
        { role: 'user', content: `${profilePrompt(profile, neighbourhood)}\n\nRoute prompt: ${prompt}` }
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
  return normalizeGroqStops(JSON.parse(text))
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

  const { prompt, profile, lat = 1.3521, lng = 103.8198, neighbourhood } = req.body
  const journeyType = detectJourneyType(prompt)

  const fallbackTemplate = getHardcodedTemplate(prompt)
  let template = fallbackTemplate
  try {
    const groqResult = await callGroq(prompt, profile, neighbourhood, journeyType)
    if (groqResult && groqResult.length > 0) {
      template = { ...fallbackTemplate, stops: groqResult }
    }
  } catch (error) {
    console.log('Groq unavailable, using fallback:', error.message)
  }

  try {
    const stopsWithPlaces = await Promise.all(
      template.stops.map(async (stop, i) => {
        try {
          const params = new URLSearchParams({
            keyword: stop.search, country: 'SGP', location: `${lat},${lng}`, limit: '1'
          })
          const grabData = await grabFetch('https://maps.grab.com/api/v1/maps/poi/v1/search?' + params, process.env.GRABMAPS_KEY)
          const place = (grabData.places ?? [])[0] ?? null
          return { ...stop, place, order: i + 1 }
        } catch (error) {
          console.log(`GrabMaps stop search failed for "${stop.search}":`, error.message)
          return { ...stop, place: null, order: i + 1 }
        }
      })
    )

    const validStops = stopsWithPlaces.filter(s => s.place)
    let geometry = null
    let totalDuration = 0
    let totalDistance = 0
    let legs = []

    if (validStops.length >= 2) {
      try {
        const params = new URLSearchParams()
        validStops.forEach(s => {
          params.append('coordinates', `${s.place.location.longitude},${s.place.location.latitude}`)
        })
        params.set('profile', 'walking')
        params.set('overview', 'full')

        const routeData = await grabFetch('https://maps.grab.com/api/v1/maps/eta/v1/direction?' + params, process.env.GRABMAPS_KEY)
        geometry = routeData.routes?.[0]?.geometry ?? null
        totalDuration = routeData.routes?.[0]?.duration ?? 0
        totalDistance = routeData.routes?.[0]?.distance ?? 0
        legs = routeData.routes?.[0]?.legs ?? []
      } catch (error) {
        console.log('Route error:', error.message)
      }
    }

    res.status(200).json({ stops: stopsWithPlaces, geometry, totalDuration, totalDistance, legs, journeyType })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

export const config = { api: { bodyParser: true } }
