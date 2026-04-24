import { useEffect, useMemo, useRef, useState } from 'react'
import useLocation from '../hooks/useLocation'

const STORAGE_KEY = 'inspomap_saved'
const SINGAPORE_CENTER = [103.8198, 1.3521]
const VISIBILITY_ORDER = ['public', 'friends', 'private']
const SAVE_VIBE_OPTIONS = ['quiet', 'post-run', 'date night', 'food', 'photography', 'social', 'hidden gem']
const SG_NEIGHBOURHOODS = [
  'Marina Bay', 'Chinatown', 'Clarke Quay', 'Orchard', 'Bugis',
  'Kallang', 'Serangoon', 'Toa Payoh', 'Bishan', 'Ang Mo Kio',
  'Woodlands', 'Jurong', 'Clementi', 'Bedok', 'Tampines'
]
const SG_MAP_ZONES = [
  { name: 'Woodlands', cx: 175, cy: 72, r: 22 },
  { name: 'Ang Mo Kio', cx: 218, cy: 100, r: 20 },
  { name: 'Serangoon', cx: 258, cy: 108, r: 19 },
  { name: 'Tampines', cx: 295, cy: 112, r: 20 },
  { name: 'Bishan', cx: 195, cy: 118, r: 18 },
  { name: 'Toa Payoh', cx: 200, cy: 140, r: 17 },
  { name: 'Kallang', cx: 238, cy: 138, r: 18 },
  { name: 'Bedok', cx: 278, cy: 142, r: 19 },
  { name: 'Orchard', cx: 162, cy: 148, r: 18 },
  { name: 'Bugis', cx: 218, cy: 158, r: 17 },
  { name: 'Clarke Quay', cx: 178, cy: 165, r: 17 },
  { name: 'Marina Bay', cx: 215, cy: 182, r: 18 },
  { name: 'Chinatown', cx: 185, cy: 192, r: 16 },
  { name: 'Clementi', cx: 125, cy: 168, r: 19 },
  { name: 'Jurong', cx: 78, cy: 168, r: 21 }
]

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

function normalizePlace(place, index) {
  const coords = place.coords || place.location || {}
  const lat = Number(place.lat ?? coords.latitude ?? coords.lat)
  const lng = Number(place.lng ?? coords.longitude ?? coords.lng ?? coords.lon)

  const address = place.address || place.formatted_address || 'Singapore'

  return {
    id: place.id || `${place.name || 'place'}-${index}-${Date.now()}`,
    name: place.name || 'Saved place',
    address,
    lat: Number.isFinite(lat) ? lat : SINGAPORE_CENTER[1],
    lng: Number.isFinite(lng) ? lng : SINGAPORE_CENTER[0],
    vibes: Array.isArray(place.vibes) ? place.vibes : [],
    note: place.note || '',
    visibility: VISIBILITY_ORDER.includes(place.visibility) ? place.visibility : 'private',
    visits: Number(place.visits ?? place.visitCount ?? 1),
    savedAt: place.savedAt || new Date().toISOString(),
    friends: Array.isArray(place.friends) ? place.friends : [],
    photos: Array.isArray(place.photos) ? place.photos : [],
    neighbourhood: SG_NEIGHBOURHOODS.includes(place.neighbourhood) ? place.neighbourhood : detectNeighbourhood(address),
    savedHour: Number.isFinite(Number(place.savedHour)) ? Number(place.savedHour) : new Date(place.savedAt || Date.now()).getHours()
  }
}

function detectNeighbourhood(address = '') {
  const lowerAddress = String(address).toLowerCase()
  return SG_NEIGHBOURHOODS.find(area => lowerAddress.includes(area.toLowerCase())) || 'Other'
}

function getWeekStart(date) {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  const day = nextDate.getDay() || 7
  nextDate.setDate(nextDate.getDate() - day + 1)
  return nextDate
}

function getWeekStreak(places) {
  const weekKeys = new Set(places.map(place => {
    const date = new Date(place.savedAt)
    if (Number.isNaN(date.getTime())) return null
    return getWeekStart(date).toISOString().slice(0, 10)
  }).filter(Boolean))

  let streak = 0
  const cursor = getWeekStart(new Date())
  while (weekKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 7)
  }
  return streak
}

function getExplorerStats(places) {
  const unlocked = Array.from(new Set(places.map(place => (
    SG_NEIGHBOURHOODS.includes(place.neighbourhood) ? place.neighbourhood : detectNeighbourhood(place.address)
  )).filter(area => SG_NEIGHBOURHOODS.includes(area))))
  const totalSaved = places.length
  const newestSaveMs = places.reduce((latest, place) => Math.max(latest, new Date(place.savedAt).getTime() || 0), 0)
  const recentlyEarned = Date.now() - newestSaveMs <= 60000
  const hasRecent = recentlyEarned && newestSaveMs > 0
  const hasVibe = vibe => places.some(place => place.vibes.some(item => item.toLowerCase() === vibe))
  const badges = [
    { emoji: '📍', label: 'First Pin', desc: 'Saved your first place', earned: totalSaved >= 1 },
    { emoji: '🗺️', label: 'Explorer', desc: '3+ neighbourhoods', earned: unlocked.length >= 3 },
    { emoji: '🌙', label: 'Night Owl', desc: 'Saved after 10pm', earned: places.some(place => place.savedHour >= 22 || place.savedHour <= 4) },
    { emoji: '🏃', label: 'Post-Run', desc: 'Saved with post-run vibe', earned: hasVibe('post-run') },
    { emoji: '🤫', label: 'Off the Map', desc: 'Found a hidden gem', earned: hasVibe('hidden gem') },
    { emoji: '🏙️', label: 'City Mapper', desc: '7+ neighbourhoods', earned: unlocked.length >= 7 },
    { emoji: '📸', label: 'Memory Maker', desc: 'Added a photo', earned: places.some(place => place.photos.length > 0) },
    { emoji: '🔥', label: 'On a Roll', desc: '5+ places saved', earned: totalSaved >= 5 }
  ].map(badge => ({ ...badge, isNew: badge.earned && hasRecent }))

  return {
    unlocked,
    locked: SG_NEIGHBOURHOODS.filter(area => !unlocked.includes(area)),
    badges,
    totalSaved,
    streak: getWeekStreak(places)
  }
}

function loadSavedPlaces() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.map(normalizePlace) : []
  } catch (error) {
    console.error('Could not load saved places', error)
    return []
  }
}

function getPinColor(place) {
  const firstVibe = (place.vibes[0] || '').toLowerCase()
  if (firstVibe.includes('photo') || firstVibe.includes('view') || firstVibe.includes('sunset')) return '#534AB7'
  if (firstVibe.includes('food') || firstVibe.includes('eat') || firstVibe.includes('hawker') || firstVibe.includes('brunch') || firstVibe.includes('cafe')) return '#D99A28'
  if (firstVibe.includes('social') || firstVibe.includes('friend') || firstVibe.includes('date') || firstVibe.includes('music')) return '#D85A50'
  return '#1D9E75'
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?'
}

export default function Saved() {
  const { location } = useLocation()
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const [places, setPlaces] = useState(() => loadSavedPlaces())
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [friendName, setFriendName] = useState('')
  const [memorySheet, setMemorySheet] = useState(null)
  const [memoryError, setMemoryError] = useState('')
  const [expandedPhoto, setExpandedPhoto] = useState(null)
  const [savedSection, setSavedSection] = useState('places')

  const selectedPlace = places.find(place => place.id === selectedId) || null
  const explorerStats = useMemo(() => getExplorerStats(places), [places])

  const filters = useMemo(() => {
    const vibeSet = new Set()
    places.forEach(place => place.vibes.forEach(vibe => vibeSet.add(vibe)))
    return ['all', ...Array.from(vibeSet).slice(0, 8)]
  }, [places])

  const filteredPlaces = useMemo(() => {
    if (activeFilter === 'all') return places
    return places.filter(place => place.vibes.includes(activeFilter))
  }, [activeFilter, places])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places))
  }, [places])

  useEffect(() => {
    if (mapRef.current) return

    const initMap = () => {
      if (!window.maplibregl || !mapContainerRef.current) {
        setTimeout(initMap, 200)
        return
      }
      if (mapRef.current) return

      mapRef.current = new window.maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://maptiles.stg-myteksi.com/v1/styles/mono.json',
        center: SINGAPORE_CENTER,
        zoom: 12,
        attributionControl: false
      })
      mapRef.current.addControl(new window.maplibregl.NavigationControl(), 'bottom-right')
    }

    initMap()

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !window.maplibregl) return

    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    filteredPlaces.forEach(place => {
      const color = selectedId === place.id ? '#111' : getPinColor(place)
      const el = document.createElement('button')
      el.type = 'button'
      el.setAttribute('aria-label', place.name)
      el.style.cssText = [
        'width:38px',
        'height:38px',
        'border-radius:50%',
        'border:3px solid #fff',
        `background:${color}`,
        'box-shadow:0 10px 24px rgba(0,0,0,0.24)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'color:#fff',
        'font-size:16px',
        'font-weight:800',
        'cursor:pointer'
      ].join(';')
      el.innerText = place.name.charAt(0).toUpperCase()
      el.onclick = () => focusPlace(place)

      const marker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([place.lng, place.lat])
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    })
  }, [filteredPlaces, selectedId])

  useEffect(() => {
    if (!location || !mapRef.current) return
    mapRef.current.flyTo({
      center: [location.lng, location.lat],
      zoom: 13.8,
      duration: 700
    })
  }, [location])

  function focusPlace(place) {
    setSelectedId(place.id)
    setFriendName('')
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 14.6,
        duration: 800
      })
    }
  }

  function updatePlace(id, updates) {
    setPlaces(currentPlaces => currentPlaces.map(place => (
      place.id === id ? { ...place, ...updates } : place
    )))
  }

  function incrementVisit(id) {
    setPlaces(currentPlaces => currentPlaces.map(place => (
      place.id === id ? { ...place, visits: place.visits + 1 } : place
    )))
  }

  function cycleVisibility(place) {
    const currentIndex = VISIBILITY_ORDER.indexOf(place.visibility)
    const nextVisibility = VISIBILITY_ORDER[(currentIndex + 1) % VISIBILITY_ORDER.length]
    updatePlace(place.id, { visibility: nextVisibility })
  }

  function addFriend(place) {
    const name = friendName.trim()
    if (!name) return
    updatePlace(place.id, { friends: [...place.friends, name] })
    setFriendName('')
  }

  function deletePlace(place) {
    const shouldDelete = window.confirm(`Delete ${place.name} from saved places?`)
    if (!shouldDelete) return
    setPlaces(currentPlaces => currentPlaces.filter(item => item.id !== place.id))
    setSelectedId(null)
  }

  async function openCurrentLocationSheet() {
    setMemoryError('')
    if (!navigator.geolocation) {
      setMemoryError('Enable location access to save your current spot')
      return
    }

    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      let nextPlace = {
        name: 'Current Location',
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng
      }

      try {
        const reverseData = import.meta.env.VITE_GRABMAPS_KEY
          ? await grabFetch(
            `https://maps-api.grab.com/maps/v1/maps/poi/v1/reverse-geo?location=${lat},${lng}`,
            import.meta.env.VITE_GRABMAPS_KEY
          )
          : {}
        const place = reverseData.places?.[0] || reverseData.results?.[0] || {}
        nextPlace = {
          ...nextPlace,
          name: place.name || nextPlace.name,
          address: place.formatted_address || place.address || nextPlace.address
        }
      } catch (error) {
        console.log('Reverse geocode failed:', error.message)
      }

      setMemorySheet(nextPlace)
    }, () => {
      setMemoryError('Enable location access to save your current spot')
    }, {
      enableHighAccuracy: true,
      timeout: 10000
    })
  }

  function saveCurrentMemory(details) {
    const savedAt = new Date()
    const nextPlace = {
      id: Date.now().toString(),
      name: details.name || memorySheet.name,
      address: memorySheet.address,
      lat: memorySheet.lat,
      lng: memorySheet.lng,
      vibes: details.vibes,
      note: details.note,
      visibility: details.visibility,
      visits: 1,
      savedAt: savedAt.toISOString(),
      friends: [],
      photos: details.photos,
      neighbourhood: detectNeighbourhood(memorySheet.address),
      savedHour: savedAt.getHours()
    }
    setPlaces(currentPlaces => [nextPlace, ...currentPlaces])
    setSelectedId(nextPlace.id)
    setMemorySheet(null)
  }

  return (
    <div style={styles.page}>
      <style>
        {`
          @keyframes savedSheetUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .saved-scrollbar::-webkit-scrollbar { display: none; }
        `}
      </style>
      <div style={styles.sectionToggle}>
        {[
          { id: 'places', label: 'My Places' },
          { id: 'explorer', label: 'Explorer' }
        ].map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSavedSection(option.id)}
            style={{
              ...styles.sectionToggleButton,
              ...(savedSection === option.id ? styles.sectionToggleButtonActive : {})
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div style={{ ...styles.mapStage, display: savedSection === 'places' ? 'block' : 'none' }}>
          <div ref={mapContainerRef} style={styles.map} />
          <button
            type="button"
            style={styles.locateButton}
            onClick={() => mapRef.current?.flyTo({
              center: location ? [location.lng, location.lat] : SINGAPORE_CENTER,
              zoom: location ? 13.8 : 11.6
            })}
          >
            ⌖
          </button>

          {selectedPlace ? (
            <section style={{ ...styles.sheet, ...styles.detailSheet }}>
              <div style={styles.handle} />
              <PlaceDetail
                place={selectedPlace}
                friendName={friendName}
                setFriendName={setFriendName}
                onBack={() => setSelectedId(null)}
                onNoteChange={note => updatePlace(selectedPlace.id, { note })}
                onVisit={() => incrementVisit(selectedPlace.id)}
                onAddFriend={() => addFriend(selectedPlace)}
                onCycleVisibility={() => cycleVisibility(selectedPlace)}
                onDelete={() => deletePlace(selectedPlace)}
                onPhotoOpen={setExpandedPhoto}
              />
            </section>
          ) : (
            <section style={styles.sheet}>
              <div style={styles.handle} />
              <div style={styles.sheetTopline}>
                <div>
                  <div style={styles.sheetTitle}>Saved places</div>
                  <div style={styles.sheetSubtitle}>Tap a card or pin to open the memory.</div>
                </div>
                <div style={styles.countBadge}>{filteredPlaces.length}</div>
              </div>

              {places.length === 0 ? (
                <div style={styles.emptyState}>
                  No saved places yet — discover a vibe and bookmark a spot ✨
                </div>
              ) : (
                <>
                  <div style={styles.filters} aria-label="Saved place filters">
                    {filters.map(filter => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveFilter(filter)}
                        style={{
                          ...styles.filterPill,
                          ...(activeFilter === filter ? styles.activeFilterPill : {})
                        }}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  <div style={styles.placeList}>
                    {filteredPlaces.map(place => (
                      <button key={place.id} type="button" style={styles.placeCard} onClick={() => focusPlace(place)}>
                        <div style={{ ...styles.cardPhoto, background: getPinColor(place) }}>
                          {place.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={styles.cardBody}>
                          <div style={styles.cardRow}>
                            <div style={styles.cardTitle}>{place.name}</div>
                            <span style={styles.visibility}>{place.visibility}</span>
                          </div>
                          <div style={styles.cardAddress}>{place.address}</div>
                          <div style={styles.vibeRow}>
                            {place.vibes.slice(0, 3).map(vibe => (
                              <span key={vibe} style={styles.vibeTag}>{vibe}</span>
                            ))}
                          </div>
                          <div style={styles.metaRow}>
                            <span>{place.visits} visits</span>
                            <span>{place.friends.length ? `with ${place.friends.join(', ')}` : 'solo save'}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <button type="button" onClick={openCurrentLocationSheet} style={styles.fab}>+</button>
      </div>
      {savedSection === 'explorer' && <ExplorerView stats={explorerStats} />}
      {memoryError && <div style={styles.locationError}>{memoryError}</div>}
      {memorySheet && (
        <SaveCurrentLocationSheet
          place={memorySheet}
          onCancel={() => setMemorySheet(null)}
          onSave={saveCurrentMemory}
        />
      )}
      {expandedPhoto && (
        <button type="button" onClick={() => setExpandedPhoto(null)} style={styles.photoOverlay}>
          <img src={expandedPhoto} alt="" style={styles.expandedPhoto} />
        </button>
      )}
    </div>
  )
}

function ExplorerView({ stats }) {
  return (
    <div style={styles.explorerView}>
      <div style={styles.explorerSectionLabel}>Zones unlocked</div>
      <div style={styles.zoneScroller}>
        {stats.unlocked.map(area => (
          <span key={area} style={styles.zonePillUnlocked}>✓ {area}</span>
        ))}
        {stats.locked.map(area => (
          <span key={area} style={styles.zonePillLocked}>🔒 {area}</span>
        ))}
      </div>

      <div style={styles.badgesSectionLabel}>Achievements</div>
      <div style={styles.badgeGrid}>
        {stats.badges.map(badge => (
          <div key={badge.label} style={{ ...styles.badgeCard, ...(badge.earned ? styles.badgeEarned : styles.badgeUnearned) }}>
            {badge.isNew && <span style={styles.newBadge}>NEW!</span>}
            <div style={styles.badgeEmoji}>{badge.emoji}</div>
            <div style={styles.badgeLabel}>{badge.label}</div>
            <div style={styles.badgeDesc}>{badge.desc}</div>
          </div>
        ))}
      </div>
      <div style={styles.statsRow}>
        <div style={styles.statCard}><div style={styles.statEmoji}>📍</div><div style={styles.statNumber}>{stats.totalSaved}</div><div style={styles.statLabel}>saved</div></div>
        <div style={styles.statCard}><div style={styles.statEmoji}>🏙️</div><div style={styles.statNumber}>{stats.unlocked.length}</div><div style={styles.statLabel}>zones</div></div>
        <div style={styles.statCard}><div style={styles.statEmoji}>🔥</div><div style={styles.statNumber}>{stats.streak}</div><div style={styles.statLabel}>week streak</div></div>
      </div>
    </div>
  )
}

function SaveCurrentLocationSheet({ place, onCancel, onSave }) {
  const fileInputRef = useRef(null)
  const [name, setName] = useState(place.name)
  const [tags, setTags] = useState([])
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [photos, setPhotos] = useState([])

  function toggleTag(tag) {
    setTags(currentTags => (
      currentTags.includes(tag)
        ? currentTags.filter(item => item !== tag)
        : [...currentTags, tag]
    ))
  }

  function handlePhotoFiles(event) {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 5 - photos.length))
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        setPhotos(currentPhotos => (
          currentPhotos.length >= 5 ? currentPhotos : [...currentPhotos, reader.result]
        ))
      }
      reader.readAsDataURL(file)
    })
    event.target.value = ''
  }

  return (
    <div style={styles.modalBackdrop} onClick={onCancel}>
      <section style={styles.memorySheet} onClick={event => event.stopPropagation()}>
        <div style={styles.handle} />
        <div>
          <div style={styles.sheetTitle}>Save this place</div>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            style={styles.memoryNameInput}
          />
          <div style={styles.memoryAddress}>{place.address}</div>

          <label style={styles.sectionLabel}>Vibe tags</label>
          <div style={styles.saveTagScroller}>
            {SAVE_VIBE_OPTIONS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  ...styles.saveTagPill,
                  ...(tags.includes(tag) ? styles.saveTagPillActive : {})
                }}
              >
                {tag}
              </button>
            ))}
          </div>

          <label style={styles.sectionLabel}>Note</label>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="How was this place?"
            style={styles.noteInput}
          />

          <div style={styles.photoSectionTop}>
            <label style={styles.photoLabel}>Add photos</label>
            {photos.length >= 5 && <span style={styles.photoCounter}>5/5</span>}
          </div>
          <div style={styles.photoRow}>
            {photos.map((photo, index) => (
              <div key={photo.slice(0, 40)} style={styles.photoThumbWrap}>
                <img src={photo} alt="" style={styles.photoThumb} />
                <button
                  type="button"
                  onClick={() => setPhotos(currentPhotos => currentPhotos.filter((_, photoIndex) => photoIndex !== index))}
                  style={styles.removePhotoButton}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} style={styles.addPhotoButton}>+</button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoFiles}
            style={{ display: 'none' }}
          />

          <label style={styles.sectionLabel}>Visibility</label>
          <div style={styles.visibilityToggle}>
            {['public', 'private'].map(option => (
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

          <button type="button" onClick={onCancel} style={styles.cancelMemoryButton}>Cancel</button>
          <button
            type="button"
            onClick={() => onSave({ name: name.trim() || 'Current Location', vibes: tags, note, visibility, photos })}
            style={styles.saveMemoryButton}
          >
            Save memory 📍
          </button>
        </div>
      </section>
    </div>
  )
}

function PhotoStrip({ photos, onPhotoOpen }) {
  if (!photos.length) return null
  return (
    <div style={styles.detailPhotoRow}>
      {photos.map((photo, index) => (
        <button key={`${photo.slice(0, 30)}-${index}`} type="button" onClick={() => onPhotoOpen(photo)} style={styles.detailPhotoButton}>
          <img src={photo} alt="" style={styles.photoThumb} />
        </button>
      ))}
    </div>
  )
}

function PlaceDetail({
  place,
  friendName,
  setFriendName,
  onBack,
  onNoteChange,
  onVisit,
  onAddFriend,
  onCycleVisibility,
  onDelete,
  onPhotoOpen
}) {
  return (
    <div>
      <button type="button" style={styles.backButton} onClick={onBack}>‹ Saved map</button>

      <PhotoStrip photos={place.photos || []} onPhotoOpen={onPhotoOpen} />

      <div style={styles.detailHero}>
        <div style={{ ...styles.detailInitial, background: getPinColor(place) }}>
          {place.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.detailTitleRow}>
            <h2 style={styles.detailTitle}>{place.name}</h2>
            <button type="button" onClick={onCycleVisibility} style={styles.visibilityBadge}>
              {place.visibility}
            </button>
          </div>
          <div style={styles.cardAddress}>{place.address}</div>
        </div>
      </div>

      <div style={styles.vibeRow}>
        {place.vibes.length ? place.vibes.map(vibe => (
          <span key={vibe} style={styles.vibeTag}>{vibe}</span>
        )) : (
          <span style={styles.vibeTag}>saved</span>
        )}
      </div>

      <label style={styles.sectionLabel}>Personal note</label>
      <textarea
        value={place.note}
        onChange={event => onNoteChange(event.target.value)}
        placeholder="Write about your experience here..."
        style={styles.noteInput}
      />

      <div style={styles.visitRow}>
        <div>
          <div style={styles.visitCount}>{place.visits}</div>
          <div style={styles.visitLabel}>visits</div>
        </div>
        <button type="button" onClick={onVisit} style={styles.primarySmallButton}>+ Visit</button>
      </div>

      <label style={styles.sectionLabel}>Friends</label>
      <div style={styles.friendAvatars}>
        {place.friends.map(friend => (
          <div key={friend} title={friend} style={styles.friendAvatar}>{getInitials(friend)}</div>
        ))}
        {place.friends.length === 0 && <span style={styles.noFriends}>No friends added yet</span>}
      </div>
      <div style={styles.friendEditor}>
        <input
          value={friendName}
          onChange={event => setFriendName(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onAddFriend()
            }
          }}
          placeholder="Friend name"
          style={styles.friendInput}
        />
        <button type="button" onClick={onAddFriend} style={styles.addFriendButton}>Add friend</button>
      </div>

      <button type="button" onClick={onDelete} style={styles.deleteButton}>Delete place</button>
    </div>
  )
}

const styles = {
  page: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: '#ffffff',
    textAlign: 'left'
  },
  sectionToggle: {
    position: 'relative',
    zIndex: 10,
    height: 44,
    display: 'flex',
    gap: 6,
    margin: 16,
    padding: 4,
    borderRadius: 50,
    background: '#f0f0f0'
  },
  sectionToggleButton: {
    flex: 1,
    border: 'none',
    borderRadius: 20,
    background: 'transparent',
    color: '#666',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer'
  },
  sectionToggleButtonActive: {
    background: '#1D9E75',
    color: '#fff'
  },
  mapStage: {
    position: 'relative',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
    background: '#dfe8df'
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    borderRadius: 0,
    background: '#dfe8df'
  },
  header: {
    position: 'absolute',
    top: 224,
    left: 14,
    right: 14,
    zIndex: 2,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 12px 12px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.92)',
    boxShadow: '0 12px 30px rgba(20,35,30,0.12)',
    backdropFilter: 'blur(14px)'
  },
  kicker: {
    color: '#1D9E75',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0
  },
  title: {
    margin: '2px 0 0',
    color: '#101512',
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: 0
  },
  locateButton: {
    position: 'absolute',
    top: 16,
    right: 14,
    zIndex: 5,
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: '1px solid #dfe8e4',
    background: '#fff',
    color: '#1D9E75',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer'
  },
  explorerCard: {
    margin: '0 16px 16px',
    overflow: 'hidden',
    padding: 0,
    borderRadius: 20,
    background: '#fff',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  explorerView: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 90,
    background: '#f7f7f7'
  },
  explorerTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  explorerTitle: {
    color: '#111',
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 900
  },
  explorerSubtitle: {
    marginTop: 7,
    color: '#858c88',
    fontSize: 13,
    fontWeight: 700
  },
  zoneCount: {
    flex: '0 0 auto',
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: 900
  },
  mapCardTitle: {
    padding: '14px 16px 4px',
    color: '#111',
    fontSize: 15,
    fontWeight: 850
  },
  singaporeSvg: {
    display: 'block',
    width: '100%',
    height: 'auto',
    padding: 8,
    background: '#f8fffe'
  },
  mapUnlockCount: {
    padding: '0 16px 12px',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 900
  },
  progressTrack: {
    width: '100%',
    height: 10,
    marginTop: 18,
    borderRadius: 5,
    overflow: 'hidden',
    background: '#E1F5EE'
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    background: '#1D9E75',
    transition: 'width 0.6s ease'
  },
  explorerSummary: {
    marginTop: 10,
    color: '#8a8f8c',
    fontSize: 12,
    fontWeight: 800,
    textAlign: 'center'
  },
  explorerSectionLabel: {
    margin: '20px 16px 10px',
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 900
  },
  zoneScroller: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    padding: '0 16px 4px'
  },
  zonePillUnlocked: {
    flex: '0 0 auto',
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 16,
    padding: '0 14px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800
  },
  zonePillLocked: {
    flex: '0 0 auto',
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 16,
    padding: '0 14px',
    background: '#f5f5f5',
    color: '#aaa',
    fontSize: 14,
    fontWeight: 800
  },
  badgesSectionLabel: {
    margin: '20px 16px 10px',
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 900
  },
  badgeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
    padding: '0 20px'
  },
  badgeCard: {
    position: 'relative',
    minHeight: 132,
    padding: 16,
    borderRadius: 16,
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  badgeEarned: {
    border: '2px solid #1D9E75',
    opacity: 1
  },
  badgeUnearned: {
    border: '2px solid #eee',
    opacity: 0.35
  },
  badgeEmoji: {
    fontSize: 36,
    lineHeight: 1
  },
  badgeLabel: {
    marginTop: 10,
    color: '#111',
    fontSize: 13,
    lineHeight: 1.15,
    fontWeight: 900
  },
  badgeDesc: {
    marginTop: 5,
    color: '#888',
    fontSize: 11,
    lineHeight: 1.25,
    fontWeight: 700
  },
  newBadge: {
    position: 'absolute',
    top: -7,
    right: -5,
    borderRadius: 999,
    padding: '2px 5px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 7,
    fontWeight: 900
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    margin: '20px 20px 0'
  },
  statCard: {
    minWidth: 0,
    borderRadius: 16,
    padding: 14,
    background: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    textAlign: 'center'
  },
  statEmoji: {
    fontSize: 24,
    lineHeight: 1
  },
  statNumber: {
    marginTop: 7,
    color: '#111',
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 900
  },
  statLabel: {
    marginTop: 4,
    color: '#888',
    fontSize: 12,
    fontWeight: 800
  },
  fab: {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: '#1D9E75',
    color: 'white',
    fontSize: '24px',
    border: 'none',
    cursor: 'pointer',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(29,158,117,0.4)'
  },
  locationError: {
    position: 'fixed',
    left: '50%',
    bottom: 142,
    zIndex: 101,
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: 358,
    padding: '10px 12px',
    borderRadius: 12,
    background: '#111',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'center'
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 220,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.4)'
  },
  memorySheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88svh',
    overflowY: 'auto',
    padding: '10px 16px 22px',
    borderRadius: '24px 24px 0 0',
    background: '#fff',
    boxShadow: '0 -18px 42px rgba(16, 24, 20, 0.22)',
    animation: 'savedSheetUp 0.26s ease-out'
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '1px solid #E4EAE7',
    background: '#fff',
    color: '#777',
    fontSize: 22,
    cursor: 'pointer'
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    height: '40%',
    minHeight: 315,
    maxHeight: 430,
    padding: '10px 14px 18px',
    borderRadius: '24px 24px 0 0',
    background: 'rgba(255,255,255,0.97)',
    boxShadow: '0 -18px 40px rgba(18,28,23,0.18)',
    backdropFilter: 'blur(18px)',
    overflowY: 'auto'
  },
  detailSheet: {
    height: '68%',
    maxHeight: 560
  },
  handle: {
    width: 44,
    height: 5,
    margin: '0 auto 12px',
    borderRadius: 20,
    background: '#d9dedb'
  },
  sheetTopline: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  sheetTitle: {
    color: '#111',
    fontSize: 17,
    fontWeight: 800
  },
  memoryNameInput: {
    width: '100%',
    marginTop: 12,
    border: '1px solid #E4EAE7',
    borderRadius: 12,
    padding: '12px 13px',
    color: '#111',
    background: '#F8FAF9',
    fontSize: 16,
    fontWeight: 900,
    outline: 'none'
  },
  memoryAddress: {
    marginTop: 8,
    color: '#8a8f8c',
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 700
  },
  sheetSubtitle: {
    marginTop: 2,
    color: '#777',
    fontSize: 12
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0F6E56',
    background: '#E1F5EE',
    fontSize: 13,
    fontWeight: 800
  },
  emptyState: {
    marginTop: 36,
    padding: '18px 20px',
    borderRadius: 8,
    background: '#F7FAF8',
    color: '#7A837F',
    fontSize: 13,
    lineHeight: 1.45,
    textAlign: 'center'
  },
  filters: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '14px 0 12px'
  },
  filterPill: {
    flex: '0 0 auto',
    padding: '7px 12px',
    borderRadius: 999,
    border: '1px solid #e5ebe8',
    background: '#fff',
    color: '#59645f',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer'
  },
  activeFilterPill: {
    border: '1px solid #1D9E75',
    background: '#1D9E75',
    color: '#fff'
  },
  placeList: {
    display: 'grid',
    gap: 10,
    paddingBottom: 8
  },
  placeCard: {
    width: '100%',
    display: 'flex',
    gap: 10,
    padding: 16,
    border: 'none',
    borderRadius: 16,
    background: '#fff',
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    cursor: 'pointer'
  },
  cardPhoto: {
    width: 54,
    height: 68,
    flex: '0 0 54px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 24,
    fontWeight: 900
  },
  cardBody: {
    minWidth: 0,
    flex: 1
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    color: '#111',
    fontSize: 14,
    lineHeight: 1.2,
    fontWeight: 800
  },
  visibility: {
    flex: '0 0 auto',
    color: '#777',
    background: '#f3f5f4',
    borderRadius: 999,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'capitalize'
  },
  cardAddress: {
    marginTop: 3,
    color: '#777',
    fontSize: 11,
    lineHeight: 1.35
  },
  vibeRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8
  },
  vibeTag: {
    color: '#085041',
    background: '#E1F5EE',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 800
  },
  metaRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
    color: '#8a8f8c',
    fontSize: 10,
    fontWeight: 700
  },
  backButton: {
    border: 'none',
    background: 'transparent',
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: 800,
    padding: '0 0 12px',
    cursor: 'pointer'
  },
  detailHero: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  detailInitial: {
    width: 58,
    height: 58,
    flex: '0 0 58px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 24,
    fontWeight: 900
  },
  detailTitleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8
  },
  detailTitle: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    color: '#111',
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: 0
  },
  visibilityBadge: {
    border: '1px solid #DCEBE5',
    borderRadius: 999,
    padding: '4px 8px',
    background: '#F0FAF6',
    color: '#0F6E56',
    textTransform: 'capitalize',
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer'
  },
  sectionLabel: {
    display: 'block',
    margin: '16px 0 7px',
    color: '#333',
    fontSize: 14,
    fontWeight: 800
  },
  noteInput: {
    width: '100%',
    minHeight: 92,
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
  visitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    border: '1px solid #EDF0EE',
    borderRadius: 8,
    background: '#fff'
  },
  visitCount: {
    color: '#111',
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 900
  },
  visitLabel: {
    marginTop: 3,
    color: '#777',
    fontSize: 11,
    fontWeight: 800
  },
  primarySmallButton: {
    border: 'none',
    borderRadius: 999,
    padding: '9px 14px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer'
  },
  friendAvatars: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    minHeight: 34
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#EEEDFE',
    color: '#3C3489',
    fontSize: 11,
    fontWeight: 900
  },
  noFriends: {
    color: '#8a8f8c',
    fontSize: 12,
    fontWeight: 700
  },
  friendEditor: {
    display: 'flex',
    gap: 8,
    marginTop: 8
  },
  friendInput: {
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
  addFriendButton: {
    border: 'none',
    borderRadius: 8,
    padding: '0 12px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer'
  },
  saveTagScroller: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    paddingBottom: 2
  },
  saveTagPill: {
    flex: '0 0 auto',
    height: 34,
    borderRadius: 999,
    border: '1px solid #1D9E75',
    padding: '0 12px',
    background: '#fff',
    color: '#1D9E75',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer'
  },
  saveTagPillActive: {
    background: '#1D9E75',
    color: '#fff'
  },
  photoSectionTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8
  },
  photoLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: 800
  },
  photoCounter: {
    color: '#1D9E75',
    fontSize: 12,
    fontWeight: 900
  },
  photoRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 2
  },
  photoThumbWrap: {
    position: 'relative',
    flex: '0 0 72px',
    width: 72,
    height: 72
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    objectFit: 'cover',
    display: 'block'
  },
  addPhotoButton: {
    flex: '0 0 72px',
    width: 72,
    height: 72,
    borderRadius: 12,
    border: '1.5px dashed #ccc',
    background: '#fff',
    color: '#999',
    fontSize: 26,
    fontWeight: 500,
    cursor: 'pointer'
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: 'none',
    background: '#111',
    color: '#fff',
    fontSize: 15,
    lineHeight: '20px',
    cursor: 'pointer'
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
  saveMemoryButton: {
    width: '100%',
    height: 52,
    marginTop: 8,
    border: 'none',
    borderRadius: 24,
    padding: '0 16px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer'
  },
  cancelMemoryButton: {
    display: 'block',
    margin: '16px auto 8px',
    border: 'none',
    background: 'transparent',
    color: '#8a8f8c',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer'
  },
  detailPhotoRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '0 0 14px',
    scrollbarWidth: 'none'
  },
  detailPhotoButton: {
    flex: '0 0 72px',
    width: 72,
    height: 72,
    padding: 0,
    border: 'none',
    borderRadius: 12,
    overflow: 'hidden',
    background: 'transparent',
    cursor: 'pointer'
  },
  photoOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 260,
    border: 'none',
    background: 'rgba(0,0,0,0.86)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    cursor: 'pointer'
  },
  expandedPhoto: {
    maxWidth: '100%',
    maxHeight: '88svh',
    borderRadius: 16,
    objectFit: 'contain'
  },
  deleteButton: {
    width: '100%',
    marginTop: 18,
    border: 'none',
    borderRadius: 8,
    padding: '12px 14px',
    background: '#FFF1EF',
    color: '#B42318',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  }
}
