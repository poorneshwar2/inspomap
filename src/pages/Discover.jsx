import { useEffect, useRef, useState } from 'react'
import useLocation from '../hooks/useLocation'

const SAVED_KEY = 'inspomap_saved'
const PROFILE_KEY = 'inspomap_profile'
const STATS_KEY = 'inspomap_stats'
const MAP_CENTER = [103.8198, 1.3521]
const DEFAULT_LOCATION = { lat: 1.3521, lng: 103.8198 }

const inspirationCards = [
  { emoji: '📚', title: 'Quiet corners', subtitle: 'Libraries, cafes & bookstores', accent: '#1D9E75', query: 'quiet corners' },
  { emoji: '🌅', title: 'Golden hour', subtitle: 'Sunset spots & viewpoints', accent: '#D85A30', query: 'golden hour' },
  { emoji: '🍜', title: 'Local flavours', subtitle: 'Hawker gems & kopitiams', accent: '#BA7517', query: 'local flavours' },
  { emoji: '🌙', title: 'After Dark', subtitle: 'Bars, music & late-night energy', accent: '#534AB7', query: 'after dark nightlife' },
  { emoji: '🔍', title: 'Hidden Gems', subtitle: 'Off-beaten spots worth saving', accent: '#0F6E56', query: 'hidden gems' }
]

function getJourneyStops(journey) {
  return (journey?.stops || [])
    .filter(stop => stop?.place?.location)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}

function getPlaceId(place) {
  const lat = place.location?.latitude ?? place.lat ?? ''
  const lng = place.location?.longitude ?? place.lng ?? ''
  return `${place.name || 'place'}-${lat}-${lng}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function toSavedPlace(place, details) {
  return {
    id: `${getPlaceId(place)}-${Date.now()}`,
    name: place.name || 'Saved place',
    address: place.formatted_address || place.address || 'Singapore',
    lat: Number(place.location?.latitude ?? place.lat ?? 1.3521),
    lng: Number(place.location?.longitude ?? place.lng ?? 103.8198),
    vibes: details.vibes,
    note: details.note,
    visibility: details.visibility,
    visits: 1,
    savedAt: new Date().toISOString(),
    friends: [],
    photos: []
  }
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getVibeColor(keyword = '') {
  const vibe = keyword.toLowerCase()
  if (vibe.includes('photo') || vibe.includes('sunset') || vibe.includes('golden') || vibe.includes('view')) return '#534AB7'
  if (vibe.includes('food') || vibe.includes('eat') || vibe.includes('hawker') || vibe.includes('kopitiam') || vibe.includes('local')) return '#D99A28'
  if (vibe.includes('date') || vibe.includes('night') || vibe.includes('bar')) return '#D85A50'
  return '#1D9E75'
}

function getJourneyIcon(type) {
  const icons = {
    run: '🏃',
    food: '🍜',
    date: '🌙',
    photography: '📸',
    chill: '✨'
  }
  return icons[type] || icons.chill
}

function getJourneyTitle(type) {
  const titles = {
    run: '🏃 Your run route',
    food: '🍜 Your food trail',
    date: '🌙 Your date night',
    photography: '📸 Your photo walk',
    chill: '✨ Your chill evening'
  }
  return titles[type] || '✨ Your evening plan'
}

function getLegLabel(leg, journeyType = 'chill', stopIndex = 0) {
  if (!leg) return '🚶 Short walk to next stop'
  const distance = ((leg.distance || 0) / 1000).toFixed(1)
  if (journeyType === 'run' && stopIndex < 2) {
    const runMinutes = Math.max(1, Math.round((leg.distance || 0) / 1000 / 8 * 60))
    return `🏃 ${runMinutes} min run · ${distance}km`
  }
  const minutes = Math.max(1, Math.round((leg.duration || 0) / 60))
  return `🚶 ${minutes} min walk · ${distance}km`
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function grabFetch(url, apiKey) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      const text = await res.text()
      if (!res.ok) throw new Error(`GrabMaps HTTP ${res.status}: ${text}`)
      return JSON.parse(text)
    } catch (error) {
      console.log(`GrabMaps frontend fetch attempt ${attempt + 1} failed:`, error.message)
      if (attempt === 0) await wait(800)
    }
  }
  return {}
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatWalkingBadge(walking) {
  if (!walking) return 'Nearby'
  const distance = walking.meters >= 1000 ? `${(walking.meters / 1000).toFixed(1)}km` : `${walking.meters}m`
  return `🚶 ${walking.mins} min · ${distance}`
}

function getProfileContext() {
  try {
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')
    if (profile.personaliseResults === false) return {}
    return {
      age: profile.age,
      neighbourhood: profile.neighbourhood,
      interests: profile.interests
    }
  } catch (error) {
    console.error('Could not load profile context', error)
    return {}
  }
}

function incrementSearchStats(searchQuery) {
  try {
    const stats = JSON.parse(localStorage.getItem(STATS_KEY) || '{}')
    const nextStats = {
      ...stats,
      vibesSearched: Number(stats.vibesSearched || 0) + 1,
      postRunSearched: Boolean(stats.postRunSearched || searchQuery.toLowerCase().includes('post-run') || searchQuery.toLowerCase().includes('post run'))
    }
    localStorage.setItem(STATS_KEY, JSON.stringify(nextStats))
  } catch (error) {
    console.error('Could not update search stats', error)
  }
}

export default function Discover() {
  const { location, loading: locationLoading } = useLocation()
  const mapRef = useRef(null)
  const userMarkerRef = useRef(null)
  const nearbyMarkersRef = useRef([])
  const watchIdRef = useRef(null)
  const [mode, setMode] = useState('search')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [places, setPlaces] = useState([])
  const [journey, setJourney] = useState(null)
  const [saveTarget, setSaveTarget] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [activeJourney, setActiveJourney] = useState(false)
  const [activeStopIndex, setActiveStopIndex] = useState(0)
  const [toast, setToast] = useState('')
  const [arrivalToast, setArrivalToast] = useState(null)
  const [detectedNeighbourhood, setDetectedNeighbourhood] = useState('Singapore')

  useEffect(() => {
    if (mapRef.current) return
    const initMap = () => {
      if (!window.maplibregl) { setTimeout(initMap, 200); return }
      if (mapRef.current) return
      mapRef.current = new window.maplibregl.Map({
        container: 'grab-map',
        style: 'https://maptiles.stg-myteksi.com/v1/styles/mono.json',
        center: MAP_CENTER,
        zoom: 12
      })
      mapRef.current.on('load', () => setMapLoaded(true))
      mapRef.current.addControl(new window.maplibregl.NavigationControl(), 'top-right')
      mapRef.current.on('moveend', fetchNearbyPlaces)
    }
    initMap()
  }, [location])

  useEffect(() => {
    if (!location || !mapRef.current || !window.maplibregl) return

    if (userMarkerRef.current) userMarkerRef.current.remove()
    const el = document.createElement('div')
    el.style.cssText = `
      width: 16px; height: 16px; border-radius: 50%;
      background: #4A90E2; border: 3px solid white;
      box-shadow: 0 0 0 4px rgba(74,144,226,0.3);
    `
    userMarkerRef.current = new window.maplibregl.Marker({ element: el })
      .setLngLat([location.lng, location.lat])
      .addTo(mapRef.current)

    mapRef.current.flyTo({ center: [location.lng, location.lat], zoom: 13, duration: 700 })
    detectNeighbourhood(location)
  }, [location])

  useEffect(() => {
    return () => {
      stopJourneyWatch()
      nearbyMarkersRef.current.forEach(marker => marker.remove())
      nearbyMarkersRef.current = []
      if (userMarkerRef.current) userMarkerRef.current.remove()
    }
  }, [])

  function decodePolyline6(encoded) {
    const coords = []
    let index = 0, lat = 0, lng = 0
    while (index < encoded.length) {
      let b, shift = 0, result = 0
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lat += (result & 1) ? ~(result >> 1) : result >> 1
      shift = 0; result = 0
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lng += (result & 1) ? ~(result >> 1) : result >> 1
      coords.push([lng / 1e6, lat / 1e6])
    }
    return coords
  }

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(''), 2000)
  }

  function getCurrentLocation() {
    return location || DEFAULT_LOCATION
  }

  async function detectNeighbourhood(nextLocation) {
    if (!nextLocation || !import.meta.env.VITE_GRABMAPS_KEY) return
    const reverseData = await grabFetch(
      `https://maps.grab.com/api/v1/maps/poi/v1/reverse-geo?location=${nextLocation.lat},${nextLocation.lng}`,
      import.meta.env.VITE_GRABMAPS_KEY
    )
    const nextNeighbourhood = reverseData.places?.[0]?.administrative_areas
      ?.find(area => area.type === 'Municipality')?.name ?? 'Singapore'
    setDetectedNeighbourhood(nextNeighbourhood)
  }

  async function getWalkingDistance(fromLat, fromLng, toLat, toLng) {
    if (!import.meta.env.VITE_GRABMAPS_KEY) return null
    try {
      const params = new URLSearchParams()
      params.append('coordinates', `${fromLng},${fromLat}`)
      params.append('coordinates', `${toLng},${toLat}`)
      params.set('profile', 'walking')
      const data = await grabFetch(
        'https://maps.grab.com/api/v1/maps/eta/v1/direction?' + params,
        import.meta.env.VITE_GRABMAPS_KEY
      )
      const duration = data.routes?.[0]?.duration ?? 0
      const distance = data.routes?.[0]?.distance ?? 0
      if (!duration && !distance) return null
      return {
        mins: Math.max(1, Math.round(duration / 60)),
        meters: Math.round(distance)
      }
    } catch (error) {
      console.log('Walking distance unavailable:', error.message)
      return null
    }
  }

  async function addWalkingBadges(results) {
    const currentLocation = getCurrentLocation()
    const topResults = await Promise.all(results.slice(0, 3).map(async place => {
      const walking = await getWalkingDistance(
        currentLocation.lat,
        currentLocation.lng,
        place.location?.latitude,
        place.location?.longitude
      )
      return { ...place, _walking: walking }
    }))
    return [...topResults, ...results.slice(3)]
  }

  function clearNearbyMarkers() {
    nearbyMarkersRef.current.forEach(marker => marker.remove())
    nearbyMarkersRef.current = []
  }

  async function fetchNearbyPlaces() {
    if (!mapRef.current || !window.maplibregl || !import.meta.env.VITE_GRABMAPS_KEY) return
    const center = mapRef.current.getCenter()
    const params = new URLSearchParams({
      location: `${center.lat},${center.lng}`,
      radius: '0.5',
      limit: '8',
      rankBy: 'popularity'
    })
    const data = await grabFetch(
      'https://maps.grab.com/api/v1/maps/place/v2/nearby?' + params,
      import.meta.env.VITE_GRABMAPS_KEY
    )
    const nearbyPlaces = data.places ?? []
    clearNearbyMarkers()
    nearbyPlaces.forEach(place => {
      const lat = place.location?.latitude
      const lng = place.location?.longitude
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return
      const el = document.createElement('div')
      el.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#ccc;border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.18);'
      const marker = new window.maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapRef.current)
      nearbyMarkersRef.current.push(marker)
    })
  }

  function stopJourneyWatch() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setArrivalToast(null)
  }

  function handleArrivalCheckin() {
    const stop = getJourneyStops(journey)[activeStopIndex]
    if (!stop) return
    saveJourneyStop(stop, 1)
    setArrivalToast(null)
    setActiveStopIndex(index => Math.min(index + 1, getJourneyStops(journey).length - 1))
  }

  function clearRouteLine() {
    const map = mapRef.current
    if (!map) return
    try {
      if (map.getLayer('route')) map.removeLayer('route')
      if (map.getSource('route')) map.removeSource('route')
    } catch (error) {
      console.error('Could not clear route', error)
    }
  }

  function drawRouteLine(geometry) {
    const map = mapRef.current
    if (!map || !geometry) return

    const draw = () => {
      const coordinates = decodePolyline6(geometry)
      if (!coordinates.length) return
      const routeData = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates
        }
      }

      try {
        if (map.getSource('route')) {
          map.getSource('route').setData(routeData)
        } else {
          map.addSource('route', {
            type: 'geojson',
            data: routeData
          })
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#1D9E75',
              'line-width': 3,
              'line-opacity': 0.8,
              'line-dasharray': [2, 1]
            }
          })
        }
      } catch (error) {
        console.error('Could not draw route', error)
      }
    }

    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)
  }

  useEffect(() => {
    if (!activeJourney || !journey || !navigator.geolocation) {
      stopJourneyWatch()
      return
    }

    stopJourneyWatch()
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const stop = getJourneyStops(journey)[activeStopIndex]
        if (!stop?.place?.location) return
        const distance = getDistanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          stop.place.location.latitude,
          stop.place.location.longitude
        )
        if (distance <= 150) {
          setArrivalToast({
            stopName: stop.place.name,
            message: `You made it to ${stop.place.name}! 🎉 Tap to check in`
          })
        }
      },
      error => console.log('Journey location watch unavailable:', error.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => stopJourneyWatch()
  }, [activeJourney, activeStopIndex, journey])

  function saveJourneyStop(stop, visits = 1) {
    if (!stop?.place) return
    const journeyType = journey?.journeyType || 'chill'
    const nextPlace = toSavedPlace(stop.place, {
      vibes: [journeyType],
      note: stop.vibe_desc || '',
      visibility: 'public'
    })
    nextPlace.visits = visits

    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
      const current = Array.isArray(saved) ? saved : []
      const existingIndex = current.findIndex(place => place.name === nextPlace.name && place.address === nextPlace.address)
      if (existingIndex >= 0) {
        const nextSaved = [...current]
        nextSaved[existingIndex] = {
          ...nextSaved[existingIndex],
          visits: Number(nextSaved[existingIndex].visits || 0) + visits,
          vibes: Array.from(new Set([...(nextSaved[existingIndex].vibes || []), journeyType]))
        }
        localStorage.setItem(SAVED_KEY, JSON.stringify(nextSaved))
      } else {
        localStorage.setItem(SAVED_KEY, JSON.stringify([nextPlace, ...current]))
      }
      showToast(visits > 1 ? 'Visited ✓' : 'Saved!')
    } catch (error) {
      console.error('Could not save journey stop', error)
      localStorage.setItem(SAVED_KEY, JSON.stringify([nextPlace]))
      showToast('Saved!')
    }
  }

  async function handleSearch(nextQuery = query) {
    const searchQuery = nextQuery.trim()
    if (!searchQuery) return
    setQuery(searchQuery)
    setLoading(true)
    incrementSearchStats(searchQuery)
    setPlaces([])
    setJourney(null)
    setActiveJourney(false)
    clearRouteLine()
    if (window._markers) window._markers.forEach(m => m.remove())
    window._markers = []
    try {
      const currentLocation = getCurrentLocation()
      const res = await fetch('https://project-70zb3.vercel.app/api/vibe-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          neighbourhood: detectedNeighbourhood,
          profile: getProfileContext()
        })
      })
      const data = await res.json()
      const results = await addWalkingBadges(data.results ?? [])
      setPlaces(results)
      if (results.length > 0 && mapRef.current) {
        results.forEach((place, i) => {
          const el = document.createElement('div')
          el.style.cssText = `width:28px;height:28px;border-radius:50%;background:#1D9E75;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:600;cursor:pointer;`
          el.innerText = i + 1
          const marker = new window.maplibregl.Marker({ element: el })
            .setLngLat([place.location.longitude, place.location.latitude])
            .addTo(mapRef.current)
          window._markers.push(marker)
        })
        mapRef.current.flyTo({ center: [results[0].location.longitude, results[0].location.latitude], zoom: 14, duration: 1000 })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleJourney() {
    const journeyQuery = query.trim()
    if (!journeyQuery) return
    setLoading(true)
    incrementSearchStats(journeyQuery)
    setJourney(null)
    setPlaces([])
    if (window._markers) window._markers.forEach(m => m.remove())
    window._markers = []
    try {
      const currentLocation = getCurrentLocation()
      const res = await fetch('https://project-70zb3.vercel.app/api/vibe-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: journeyQuery,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          neighbourhood: detectedNeighbourhood,
          profile: getProfileContext()
        })
      })
      const data = await res.json()
      console.log('Journey data:', JSON.stringify(data))
      const orderedStops = getJourneyStops(data)
      setJourney({ ...data, stops: orderedStops })
      setActiveStopIndex(0)
      setActiveJourney(false)
      drawRouteLine(data.geometry)
      const colors = ['#1D9E75', '#534AB7', '#D85A30']
      orderedStops.forEach((stop, i) => {
        const el = document.createElement('div')
        el.style.cssText = `width:30px;height:30px;border-radius:50%;background:${colors[i]};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;cursor:pointer;`
        el.innerText = i + 1
        const marker = new window.maplibregl.Marker({ element: el })
          .setLngLat([stop.place.location.longitude, stop.place.location.latitude])
          .addTo(mapRef.current)
        window._markers.push(marker)
      })
      if (orderedStops[0]) {
        mapRef.current.flyTo({ center: [orderedStops[0].place.location.longitude, orderedStops[0].place.location.latitude], zoom: 14, duration: 1000 })
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const stopColors = ['#1D9E75', '#534AB7', '#D85A30']
  const vibeChips = [
    { label: '🌮 local eats', query: 'local eats' },
    { label: '🌅 sunset spots', query: 'sunset spots' },
    { label: '🏃 post-run chill', query: 'post-run chill' },
    { label: '🌙 date night', query: 'date night' }
  ]
  function changeMode(nextMode) {
    setMode(nextMode)
    setPlaces([])
    setJourney(null)
    setActiveJourney(false)
    stopJourneyWatch()
    clearRouteLine()
    if (window._markers) window._markers.forEach(m => m.remove())
    window._markers = []
  }

  function openSaveSheet(place, suggestedTags = []) {
    setSaveTarget({ place, suggestedTags })
  }

  function savePlace(details) {
    if (!saveTarget?.place) return

    const nextPlace = toSavedPlace(saveTarget.place, details)
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
      const current = Array.isArray(saved) ? saved : []
      localStorage.setItem(SAVED_KEY, JSON.stringify([nextPlace, ...current]))
    } catch (error) {
      console.error('Could not save place', error)
      localStorage.setItem(SAVED_KEY, JSON.stringify([nextPlace]))
    }
    setSaveTarget(null)
  }

  function isPlaceSaved(place) {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
      return Array.isArray(saved) && saved.some(item => (
        item.name === place.name && (item.address === place.formatted_address || item.address === place.address)
      ))
    } catch (error) {
      return false
    }
  }

  function focusMapPlace(place) {
    if (!mapRef.current || !place?.location) return
    mapRef.current.flyTo({
      center: [place.location.longitude, place.location.latitude],
      zoom: 14,
      duration: 800
    })
  }

  function advanceJourneyStop() {
    const stops = getJourneyStops(journey)
    const nextIndex = Math.min(activeStopIndex + 1, stops.length - 1)
    const nextStop = stops[nextIndex]
    setActiveStopIndex(nextIndex)
    if (nextStop?.place?.location && mapRef.current) {
      mapRef.current.flyTo({
        center: [nextStop.place.location.longitude, nextStop.place.location.latitude],
        zoom: 14,
        duration: 800
      })
    }
  }

  function finishJourney() {
    showToast('Journey complete! 🎉')
    setActiveJourney(false)
    stopJourneyWatch()
  }

  function markJourneyStopVisited() {
    saveJourneyStop(getJourneyStops(journey)[activeStopIndex], 1)
    showToast('✓ Saved!')
  }

  return (
    <div style={styles.discoverPage}>
      <style>
        {`
          @keyframes inspomapPulse {
            0% { opacity: 0.55; }
            50% { opacity: 1; }
            100% { opacity: 0.55; }
          }
          @keyframes inspomapBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
            40% { transform: translateY(-8px); opacity: 1; }
          }
          .inspomap-search-input::placeholder { color: #999; }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
        `}
      </style>
      <div style={styles.topSection}>
        <div style={styles.greetingRow}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'white', margin: 0, lineHeight: 1.2 }}>{getGreeting()} 👋</h1>
            <div style={styles.prompt}>What's the vibe tonight?</div>
          </div>
            <div style={styles.locationPill}>{locationLoading ? 'Locating...' : `${detectedNeighbourhood || 'Singapore'} 🇸🇬`}</div>
        </div>

        <div style={styles.modeSwitch}>
          {['search', 'journey'].map(m => (
            <button key={m} onClick={() => changeMode(m)} style={{
              ...styles.modeButton,
              ...(mode === m ? styles.modeButtonActive : {})
            }}>
              {m === 'search' ? '🔍 Find a spot' : '✨ Plan my evening'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.searchCard}>
        <div style={styles.searchRow}>
          <input
            className="inspomap-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (mode === 'journey' ? handleJourney() : handleSearch())}
            placeholder={mode === 'search' ? 'quiet spots for reading...' : '2hrs · solo · post-run · Tiong Bahru'}
            style={styles.searchInput}
          />
          <button onClick={() => (mode === 'journey' ? handleJourney() : handleSearch())} style={styles.goButton}>
            {loading ? '...' : 'Go'}
          </button>
        </div>

        <div className="hide-scrollbar" style={styles.vibeChipRow}>
          {vibeChips.map(chip => (
            <button key={chip.label} type="button" onClick={() => handleSearch(chip.query)} style={styles.vibeChip}>{chip.label}</button>
          ))}
        </div>
      </div>

      <div style={styles.mapWrap}>
        {!mapLoaded && <div style={styles.mapSkeleton} />}
        <div id="grab-map" style={styles.map} />
      </div>

      <div style={styles.contentArea}>
        {!loading && !journey && places.length === 0 && (
          mode === 'journey' ? (
            <div style={styles.journeyPromptCard}>
              <div style={styles.emptyTitle}>Describe your evening</div>
              <div style={styles.emptySubtitle}>Try: '2hrs solo post-run Tiong Bahru' or 'date night near Clarke Quay'</div>
            </div>
          ) : (
            <div>
              <div style={styles.emptyEyebrow}>Start with a vibe</div>
              <div className="hide-scrollbar" style={styles.inspirationRow}>
                {inspirationCards.map(card => (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => handleSearch(card.query)}
                    style={styles.inspirationCard}
                  >
                    <div style={styles.inspirationEmoji}>{card.emoji}</div>
                    <div style={styles.inspirationTitle}>{card.title}</div>
                    <div style={styles.inspirationSubtitle}>{card.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.loadingDots}>
              {[0, 1, 2].map(dot => (
                <span key={dot} style={{ ...styles.loadingDot, animationDelay: `${dot * 0.12}s` }} />
              ))}
            </div>
            <div style={styles.loadingText}>Finding your vibe...</div>
          </div>
        )}

        {journey && mode === 'journey' && (
          <div>
            <div style={styles.journeyHeader}>
              <div style={styles.journeyTitle}>
                {getJourneyTitle(journey.journeyType)}
              </div>
              <div style={styles.journeyMeta}>
                ~{Math.round((journey.totalDuration || 5400) / 60)} min · {((journey.totalDistance || 1200) / 1000).toFixed(1)}km
              </div>
            </div>

            {getJourneyStops(journey).map((stop, i, stops) => {
              return (
                <div key={stop.order || `${stop.place.name}-${i}`} style={{ ...styles.journeyStopCard, borderLeft: `6px solid ${stopColors[i] || '#1D9E75'}` }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: stopColors[i] || '#1D9E75', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700
                    }}>{i + 1}</div>
                    {i < stops.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 24, background: '#eee', margin: '4px 0' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111', flex: 1 }}>{stop.place.name}</div>
                      <button
                        type="button"
                        aria-label={`Save ${stop.place.name}`}
                        onClick={() => saveJourneyStop(stop)}
                        style={styles.bookmarkButton}
                      >
                        🔖
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{stop.place.formatted_address}</div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 4, lineHeight: 1.5 }}>{stop.vibe_desc}</div>
                    <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, background: '#F0FAF6', color: '#0F6E56', padding: '2px 8px', borderRadius: 10, border: '0.5px solid #A8DFC9' }}>
                      {stop.duration}
                    </span>
                    {i < stops.length - 1 && (
                      <div style={styles.walkIndicator}>{getLegLabel(journey.legs?.[i], journey.journeyType, i)}</div>
                    )}
                  </div>
                </div>
              )
            })}

            <button onClick={() => {
              setActiveJourney(true)
              setActiveStopIndex(0)
            }} style={styles.startJourneyButton}>➜ Start Journey</button>
          </div>
        )}

        {places.length > 0 && (
          <div style={styles.resultHeader}>Top matches for {query}</div>
        )}

        {places.map((place, i) => {
          const saved = isPlaceSaved(place)
          return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => focusMapPlace(place)}
            onKeyDown={event => event.key === 'Enter' && focusMapPlace(place)}
            style={styles.resultCard}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={styles.resultName}>{place.name}</div>
              <button
                type="button"
                aria-label={`Save ${place.name}`}
                onClick={event => {
                  event.stopPropagation()
                  openSaveSheet(place, [query, place.business_type, place._keyword].filter(Boolean))
                }}
                style={{ ...styles.bookmarkButton, ...(saved ? styles.bookmarkButtonSaved : {}) }}
              >
                🔖
              </button>
            </div>
            <div style={styles.resultAddress}>{place.formatted_address}</div>
            <div style={styles.resultMetaRow}>
              <span style={{ ...styles.resultPill, background: '#E1F5EE', color: '#085041' }}>
                {place.business_type || 'place'}
              </span>
              {place._keyword && (
                <span style={{ ...styles.resultPill, background: '#EEEDFE', color: '#3C3489' }}>
                  {place._keyword}
                </span>
              )}
              <span style={styles.walkBadge}>
                {formatWalkingBadge(place._walking)}
              </span>
            </div>
          </div>
          )
        })}
      </div>

      {saveTarget && (
        <SavePlaceSheet
          place={saveTarget.place}
          suggestedTags={saveTarget.suggestedTags}
          onCancel={() => setSaveTarget(null)}
          onSave={savePlace}
        />
      )}

      {activeJourney && journey && (
        <JourneyOverlay
          journey={journey}
          activeStopIndex={activeStopIndex}
          onNext={advanceJourneyStop}
          onEnd={() => {
            setActiveJourney(false)
            stopJourneyWatch()
          }}
          onFinish={finishJourney}
          onVisited={markJourneyStopVisited}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
      {arrivalToast && (
        <button type="button" onClick={handleArrivalCheckin} style={{ ...styles.toast, ...styles.arrivalToast }}>
          {arrivalToast.message}
        </button>
      )}
    </div>
  )
}

function JourneyOverlay({ journey, activeStopIndex, onNext, onEnd, onFinish, onVisited }) {
  const stops = getJourneyStops(journey)
  const activeStop = stops[activeStopIndex]
  const nextLeg = journey.legs?.[activeStopIndex]
  const isLast = activeStopIndex >= stops.length - 1

  if (!activeStop) return null

  return (
    <div style={styles.journeyOverlay}>
      <div style={styles.journeyOverlayTop}>
        <div style={styles.journeyOverlayKicker}>{getJourneyIcon(journey.journeyType)} Journey mode</div>
        <button type="button" onClick={onEnd} style={styles.endJourneyButton}>End Journey</button>
      </div>

      <div style={styles.journeyOverlayTitle}>Stop {activeStopIndex + 1} of {stops.length}</div>
      <div style={styles.activeStopName}>{activeStop.place.name}</div>
      <div style={styles.activeStopAddress}>{activeStop.place.formatted_address}</div>

      {!isLast && (
        <div style={styles.nextLegCard}>
          {getLegLabel(nextLeg, journey.journeyType, activeStopIndex)} to next stop
        </div>
      )}

      <div style={styles.journeyStopList}>
        {stops.map((stop, index) => (
          <div
            key={stop.order || stop.place.name}
            style={{
              ...styles.miniStop,
              ...(index < activeStopIndex ? styles.miniStopComplete : {}),
              ...(index === activeStopIndex ? styles.miniStopActive : {})
            }}
          >
            <span style={styles.miniStopName}>{stop.place.name}</span>
          </div>
        ))}
      </div>

      <div style={styles.journeyActions}>
        <button type="button" onClick={onVisited} style={styles.visitedButton}>✓ Mark as visited</button>
        {isLast ? (
          <button type="button" onClick={onFinish} style={styles.nextStopButton}>Finish 🎉</button>
        ) : (
          <button type="button" onClick={onNext} style={styles.nextStopButton}>Next stop →</button>
        )}
      </div>
    </div>
  )
}

function SavePlaceSheet({ place, suggestedTags, onCancel, onSave }) {
  const [tags, setTags] = useState(() => {
    const cleanTags = suggestedTags
      .flatMap(tag => String(tag).split(/[,+]/))
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean)
    return Array.from(new Set(cleanTags)).slice(0, 4)
  })
  const [tagInput, setTagInput] = useState('')
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState('public')

  function addTag() {
    const nextTag = tagInput.trim().toLowerCase()
    if (!nextTag || tags.includes(nextTag)) return
    setTags([...tags, nextTag])
    setTagInput('')
  }

  return (
    <div style={styles.modalBackdrop}>
      <section style={styles.saveSheet}>
        <div style={styles.saveHandle} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={styles.saveTitle}>Save this place</div>
            <div style={styles.savePlaceName}>{place.name}</div>
            <div style={styles.saveAddress}>{place.formatted_address || place.address}</div>
          </div>
          <button type="button" onClick={onCancel} style={styles.closeButton}>×</button>
        </div>

        <label style={styles.fieldLabel}>Vibe tags</label>
        <div style={styles.tagEditor}>
          <input
            value={tagInput}
            onChange={event => setTagInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addTag()
              }
            }}
            placeholder="quiet, post-run..."
            style={styles.tagInput}
          />
          <button type="button" onClick={addTag} style={styles.addTagButton}>Add</button>
        </div>
        <div style={styles.tagList}>
          {tags.map(tag => (
            <button key={tag} type="button" onClick={() => setTags(tags.filter(item => item !== tag))} style={styles.tagChip}>
              {tag} ×
            </button>
          ))}
        </div>

        <label style={styles.fieldLabel}>Note</label>
        <textarea
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="Write about your experience here..."
          style={styles.noteInput}
        />

        <label style={styles.fieldLabel}>Visibility</label>
        <div style={styles.visibilityToggle}>
          {['public', 'friends', 'private'].map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setVisibility(option)}
              style={{
                ...styles.visibilityOption,
                ...(visibility === option ? styles.visibilityOptionActive : {})
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onSave({ vibes: tags, note, visibility })}
          style={styles.saveButton}
        >
          Save this place
        </button>
      </section>
    </div>
  )
}

const styles = {
  discoverPage: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#f7f7f7',
    textAlign: 'left',
    overflowX: 'hidden',
    paddingBottom: 80
  },
  topSection: {
    position: 'relative',
    minHeight: 180,
    maxHeight: 200,
    padding: '22px 16px 12px',
    borderRadius: '0 0 32px 32px',
    background: 'linear-gradient(145deg, #085041 0%, #0F6E56 100%)',
    boxShadow: '0 18px 34px rgba(8,80,65,0.22)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  greetingRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  greeting: {
    maxWidth: 230,
    fontSize: 26,
    lineHeight: 1.08,
    fontWeight: 900,
    color: '#fff',
    letterSpacing: 0
  },
  prompt: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 700
  },
  locationPill: {
    flex: '0 0 auto',
    padding: '8px 14px',
    borderRadius: 999,
    border: 'none',
    background: '#fff',
    color: '#0F6E56',
    fontSize: 12,
    fontWeight: 900,
    boxShadow: '0 10px 24px rgba(0,0,0,0.16)'
  },
  modeSwitch: {
    display: 'flex',
    background: '#fff',
    borderRadius: 999,
    padding: 5,
    height: 44,
    marginBottom: 12,
    boxShadow: '0 12px 26px rgba(0,0,0,0.14)'
  },
  modeButton: {
    flex: 1,
    minHeight: 34,
    padding: '0 8px',
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: '#8B9590',
    fontWeight: 900,
    fontSize: 13,
    cursor: 'pointer'
  },
  modeButtonActive: {
    background: '#1D9E75',
    color: '#fff',
    boxShadow: '0 7px 16px rgba(29,158,117,0.22)'
  },
  searchCard: {
    position: 'relative',
    zIndex: 2,
    margin: '16px 16px 16px',
    padding: 16,
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 'none',
    background: 'transparent',
    color: '#101512',
    fontSize: 15,
    fontWeight: 700,
    outline: 'none'
  },
  goButton: {
    flex: '0 0 auto',
    width: 70,
    height: 44,
    border: 'none',
    borderRadius: 22,
    padding: 0,
    background: '#1D9E75',
    color: '#fff',
    fontSize: 14,
    fontWeight: 950,
    cursor: 'pointer'
  },
  vibeChipRow: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    overflowX: 'auto',
    whiteSpace: 'nowrap',
    padding: '14px 0 4px',
    scrollbarWidth: 'none'
  },
  vibeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flex: '0 0 auto',
    fontSize: 13,
    background: '#fff',
    color: '#1D9E75',
    padding: '8px 16px',
    borderRadius: 20,
    cursor: 'pointer',
    border: '1.5px solid #1D9E75',
    fontWeight: 800
  },
  mapWrap: {
    position: 'relative',
    height: 200,
    minHeight: 200,
    margin: '0 16px',
    borderRadius: 16,
    flexShrink: 0,
    overflow: 'hidden',
    background: '#EEF3EF',
    boxShadow: '0 10px 26px rgba(15,26,22,0.10)'
  },
  map: {
    height: 200,
    width: '100%',
    minHeight: 200,
    backgroundColor: 'transparent'
  },
  mapSkeleton: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    background: 'linear-gradient(110deg, #EEF3EF 8%, #F8FBF9 18%, #E4ECE7 33%)',
    backgroundSize: '200% 100%',
    animation: 'inspomapPulse 1.2s ease-in-out infinite'
  },
  contentArea: {
    flex: 1,
    minHeight: 250,
    overflowY: 'auto',
    padding: '0 0 80px'
  },
  emptyEyebrow: {
    color: '#111',
    fontSize: 18,
    fontWeight: 900,
    margin: '20px 0 12px 16px',
    letterSpacing: 0
  },
  inspirationRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    overflowX: 'auto',
    padding: '0 16px 8px',
    scrollbarWidth: 'none'
  },
  inspirationCard: {
    width: 140,
    minWidth: 140,
    height: 160,
    flexShrink: 0,
    border: 'none',
    borderLeft: 'none',
    borderRadius: 16,
    padding: 16,
    background: '#fff',
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  inspirationEmoji: {
    fontSize: 36,
    lineHeight: 1,
    marginBottom: 0
  },
  inspirationTitle: {
    color: '#111',
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 900,
    marginTop: 8
  },
  inspirationSubtitle: {
    marginTop: 4,
    color: '#888',
    fontSize: 12,
    lineHeight: 1.3,
    fontWeight: 700
  },
  journeyPromptCard: {
    margin: '20px 16px 0',
    minHeight: 132,
    borderRadius: 8,
    padding: 16,
    background: '#F0FAF6',
    border: '1px solid #DCEFE7',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  emptyTitle: {
    color: '#0F3F34',
    fontSize: 17,
    fontWeight: 900
  },
  emptySubtitle: {
    marginTop: 7,
    color: '#527368',
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 700
  },
  resultHeader: {
    color: '#111',
    fontSize: 18,
    fontWeight: 950,
    margin: '20px 16px 12px'
  },
  resultCard: {
    width: 'calc(100% - 32px)',
    position: 'relative',
    display: 'block',
    border: 'none',
    borderRadius: 16,
    padding: 16,
    margin: '0 16px 12px',
    background: '#fff',
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: '0 2px 14px rgba(0,0,0,0.08)',
    outline: 'none'
  },
  resultName: {
    flex: 1,
    color: '#111',
    fontSize: 16,
    lineHeight: 1.18,
    fontWeight: 950
  },
  resultAddress: {
    marginTop: 5,
    color: '#8A928E',
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 650
  },
  resultMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 14,
    paddingRight: 74
  },
  resultPill: {
    borderRadius: 999,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 900
  },
  walkBadge: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    borderRadius: 999,
    padding: '6px 9px',
    background: '#F6F7F6',
    color: '#66706B',
    fontSize: 11,
    fontWeight: 900
  },
  loadingState: {
    minHeight: 130,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  loadingDots: {
    display: 'flex',
    gap: 7
  },
  loadingDot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: '#1D9E75',
    animation: 'inspomapBounce 0.9s ease-in-out infinite'
  },
  loadingText: {
    color: '#8A928E',
    fontSize: 13,
    fontWeight: 800
  },
  journeyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  journeyTitle: {
    color: '#111',
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 950
  },
  journeyMeta: {
    flex: '0 0 auto',
    fontSize: 12,
    background: '#F0FAF6',
    color: '#0F6E56',
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid #A8DFC9',
    fontWeight: 900
  },
  journeyStopCard: {
    display: 'flex',
    gap: 12,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 2px 14px rgba(0,0,0,0.08)'
  },
  startJourneyButton: {
    width: '100%',
    height: 52,
    marginTop: 4,
    borderRadius: 24,
    border: 'none',
    background: '#1D9E75',
    color: 'white',
    fontSize: 15,
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(29,158,117,0.24)'
  },
  bookmarkButton: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '1px solid #E0ECE7',
    background: '#F0FAF6',
    color: '#1D9E75',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    cursor: 'pointer',
    flexShrink: 0
  },
  bookmarkButtonSaved: {
    background: '#1D9E75',
    color: '#fff',
    border: '1px solid #1D9E75',
    boxShadow: '0 8px 18px rgba(29,158,117,0.20)'
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    background: 'rgba(16, 24, 20, 0.28)'
  },
  saveSheet: {
    width: '100%',
    maxWidth: 390,
    padding: '10px 16px 18px',
    borderRadius: '22px 22px 0 0',
    background: '#fff',
    boxShadow: '0 -18px 42px rgba(16, 24, 20, 0.22)'
  },
  saveHandle: {
    width: 44,
    height: 5,
    margin: '0 auto 12px',
    borderRadius: 20,
    background: '#DDE5E1'
  },
  saveTitle: {
    color: '#111',
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.1
  },
  savePlaceName: {
    marginTop: 4,
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: 800
  },
  saveAddress: {
    marginTop: 2,
    color: '#777',
    fontSize: 11,
    lineHeight: 1.35
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '1px solid #eee',
    background: '#fff',
    color: '#777',
    fontSize: 22,
    cursor: 'pointer'
  },
  fieldLabel: {
    display: 'block',
    margin: '12px 0 6px',
    color: '#333',
    fontSize: 12,
    fontWeight: 800
  },
  tagEditor: {
    display: 'flex',
    gap: 8
  },
  tagInput: {
    flex: 1,
    minWidth: 0,
    border: '1px solid #E4EAE7',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#111',
    background: '#F8FAF9',
    fontSize: 13,
    outline: 'none'
  },
  addTagButton: {
    border: 'none',
    borderRadius: 8,
    padding: '0 12px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  tagList: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    minHeight: 28,
    marginTop: 8
  },
  tagChip: {
    border: 'none',
    borderRadius: 999,
    padding: '5px 9px',
    background: '#E1F5EE',
    color: '#085041',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer'
  },
  noteInput: {
    width: '100%',
    minHeight: 82,
    resize: 'vertical',
    border: '1px solid #E4EAE7',
    borderRadius: 8,
    padding: 12,
    color: '#111',
    background: '#F8FAF9',
    fontSize: 13,
    lineHeight: 1.4,
    outline: 'none',
    fontFamily: 'inherit'
  },
  visibilityToggle: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    padding: 4,
    borderRadius: 10,
    background: '#F1F4F2'
  },
  visibilityOption: {
    border: 'none',
    borderRadius: 8,
    padding: '8px 0',
    background: 'transparent',
    color: '#68736E',
    textTransform: 'capitalize',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  visibilityOptionActive: {
    background: '#fff',
    color: '#1D9E75',
    boxShadow: '0 1px 6px rgba(16, 24, 20, 0.08)'
  },
  saveButton: {
    width: '100%',
    marginTop: 16,
    border: 'none',
    borderRadius: 999,
    padding: '13px 16px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer'
  },
  walkIndicator: {
    marginTop: 8,
    color: '#0F6E56',
    background: '#F0FAF6',
    border: '1px solid #DCEFE7',
    borderRadius: 999,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 900
  },
  journeyOverlay: {
    position: 'fixed',
    left: '50%',
    right: 'auto',
    bottom: 60,
    zIndex: 100,
    width: '100%',
    maxWidth: 480,
    maxHeight: '50vh',
    transform: 'translateX(-50%)',
    overflowY: 'auto',
    padding: 20,
    borderRadius: '20px 20px 0 0',
    background: '#fff',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
    pointerEvents: 'auto',
    textAlign: 'left'
  },
  journeyOverlayTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  journeyOverlayKicker: {
    color: '#1D9E75',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  journeyOverlayTitle: {
    color: '#111',
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 900,
    marginBottom: 8
  },
  endJourneyButton: {
    border: '1px solid #ddd',
    borderRadius: 20,
    padding: '6px 14px',
    background: '#fff',
    color: '#777',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer'
  },
  activeStopCard: {
    display: 'flex',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    border: '1px solid #DCEFE7',
    background: '#fff',
    boxShadow: '0 18px 40px rgba(15,26,22,0.16)'
  },
  activeStopNumber: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    flex: '0 0 36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 15,
    fontWeight: 900
  },
  activeStopName: {
    color: '#1D9E75',
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 900
  },
  activeStopAddress: {
    marginTop: 4,
    color: '#888',
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 700
  },
  activeStopDesc: {
    marginTop: 8,
    color: '#3D4642',
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 700
  },
  activeStopDuration: {
    display: 'inline-flex',
    marginTop: 9,
    borderRadius: 999,
    padding: '4px 9px',
    background: '#F0FAF6',
    color: '#0F6E56',
    fontSize: 11,
    fontWeight: 900
  },
  nextLegCard: {
    marginTop: 10,
    padding: 0,
    borderRadius: 0,
    background: 'transparent',
    color: '#0F6E56',
    border: 'none',
    fontSize: 13,
    fontWeight: 900
  },
  journeyStopList: {
    display: 'flex',
    gap: 8,
    marginTop: 16
  },
  miniStop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    padding: '6px 12px',
    borderRadius: 20,
    background: '#f5f5f5',
    border: 'none',
    color: '#888',
    fontSize: 12,
    fontWeight: 800,
    textAlign: 'center'
  },
  miniStopActive: {
    background: '#1D9E75',
    color: '#fff',
    fontWeight: 900
  },
  miniStopComplete: {
    background: '#E1F5EE',
    color: '#1D9E75'
  },
  miniStopNumber: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    color: '#1D9E75',
    fontSize: 10,
    fontWeight: 900
  },
  miniStopName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  journeyActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginTop: 18
  },
  visitedButton: {
    height: 48,
    border: '1px solid #1D9E75',
    borderRadius: 24,
    padding: '0 10px',
    background: '#fff',
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  },
  nextStopButton: {
    height: 48,
    border: 'none',
    borderRadius: 24,
    padding: '0 10px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: 86,
    zIndex: 260,
    transform: 'translateX(-50%)',
    padding: '10px 14px',
    borderRadius: 999,
    background: '#111',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    boxShadow: '0 12px 28px rgba(0,0,0,0.18)'
  },
  arrivalToast: {
    width: 'calc(100% - 32px)',
    maxWidth: 358,
    border: 'none',
    borderRadius: 12,
    background: '#1D9E75',
    cursor: 'pointer',
    textAlign: 'center'
  }
}
