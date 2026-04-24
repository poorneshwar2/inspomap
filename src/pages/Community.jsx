import { useMemo, useState } from 'react'
import communitySpots from '../data/community.json'

const SAVED_KEY = 'inspomap_saved'
const LIKES_KEY = 'inspomap_likes'

const neighbourhoods = ['All', 'Tiong Bahru', 'Clarke Quay', 'Chinatown', 'Orchard', 'Bugis', 'Geylang']

const summaries = {
  All: 'Locals are gravitating towards quiet neighbourhood cafes this week — Tiong Bahru and Joo Chiat are the most saved areas. Evening photography spots near the Southern Ridges are trending, with Henderson Waves appearing in 12 saves this week.',
  'Tiong Bahru': 'Tiong Bahru is all slow mornings and soft corners right now. Community saves cluster around bakeries, indie bookstores, and early hawker breakfasts before the neighbourhood gets busy.',
  'Clarke Quay': 'Clarke Quay saves are leaning towards easy date-night routes: dinner first, then a river walk. The strongest community signal is for low-pressure evening plans with good lighting and close-by drinks.',
  Chinatown: 'Chinatown is leading the food conversation this week. Maxwell and nearby coffee stops are being saved for early lunches, cheap eats, and quick heritage walks between meals.',
  Orchard: 'Orchard saves are more practical than flashy: people are bookmarking quiet libraries, hidden cafes, and weather-proof hangouts for solo resets between errands.',
  Bugis: 'Bugis is trending for colour and movement. Haji Lane is the strongest signal, especially for street photography, indie shopping, and late-afternoon wandering.',
  Geylang: 'Geylang interest is food-first this week. Community saves point to supper energy, heritage streets, and no-frills local flavours best explored with friends.'
}

const trending = [
  communitySpots.find(spot => spot.id === 'c5'),
  communitySpots.find(spot => spot.id === 'c1'),
  communitySpots.find(spot => spot.id === 'c7'),
  communitySpots.find(spot => spot.id === 'c2'),
  communitySpots.find(spot => spot.id === 'c8')
].filter(Boolean)

function loadLikes() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIKES_KEY) || '{}')
    return saved && typeof saved === 'object' ? saved : {}
  } catch (error) {
    console.error('Could not load likes', error)
    return {}
  }
}

function getTagStyle(vibe) {
  const value = vibe.toLowerCase()
  if (value.includes('food') || value.includes('hawker') || value.includes('cheap') || value.includes('breakfast') || value.includes('coffee')) {
    return { background: '#FAEEDA', color: '#633806' }
  }
  if (value.includes('photo') || value.includes('sunset') || value.includes('outdoor') || value.includes('nature')) {
    return { background: '#EEEDFE', color: '#3C3489' }
  }
  if (value.includes('social') || value.includes('brunch') || value.includes('shopping') || value.includes('aesthetic')) {
    return { background: '#FAECE7', color: '#712B13' }
  }
  return { background: '#E1F5EE', color: '#085041' }
}

function toSavedPlace(spot) {
  return {
    id: `${spot.id}-${Date.now()}`,
    name: spot.name,
    address: spot.address,
    lat: 1.3521,
    lng: 103.8198,
    vibes: spot.vibes,
    note: spot.quote,
    visibility: 'public',
    visits: 1,
    savedAt: new Date().toISOString(),
    friends: [],
    photos: []
  }
}

export default function Community() {
  const [activeNeighbourhood, setActiveNeighbourhood] = useState('All')
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [likes, setLikes] = useState(() => loadLikes())
  const [toast, setToast] = useState('')

  const filteredSpots = useMemo(() => {
    if (activeNeighbourhood === 'All') return communitySpots
    return communitySpots.filter(spot => spot.neighbourhood === activeNeighbourhood)
  }, [activeNeighbourhood])

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(''), 2000)
  }

  function likeSpot(spot, event) {
    event.stopPropagation()
    const nextLikes = { ...likes, [spot.id]: (likes[spot.id] || 0) + 1 }
    setLikes(nextLikes)
    localStorage.setItem(LIKES_KEY, JSON.stringify(nextLikes))
  }

  function saveToMyPlaces(spot) {
    const nextPlace = toSavedPlace(spot)
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
      const current = Array.isArray(saved) ? saved : []
      localStorage.setItem(SAVED_KEY, JSON.stringify([nextPlace, ...current]))
    } catch (error) {
      console.error('Could not save community spot', error)
      localStorage.setItem(SAVED_KEY, JSON.stringify([nextPlace]))
    }
    showToast('Saved!')
  }

  function shareSpot() {
    showToast('Link copied!')
  }

  return (
    <div style={styles.page}>
      <style>
        {`
          .community-scroll::-webkit-scrollbar { display: none; }
        `}
      </style>

      <header style={styles.header}>
        <h1 style={styles.title}>Community</h1>
        <p style={styles.subtitle}>What Singapore is vibing with</p>
      </header>

      <div className="community-scroll" style={styles.filterRow}>
        {neighbourhoods.map(neighbourhood => (
          <button
            key={neighbourhood}
            type="button"
            onClick={() => setActiveNeighbourhood(neighbourhood)}
            style={{
              ...styles.filterPill,
              ...(activeNeighbourhood === neighbourhood ? styles.activeFilterPill : {})
            }}
          >
            {neighbourhood}
          </button>
        ))}
      </div>

      <section style={styles.summaryCard}>
        <div style={styles.summaryLabel}>✦ AI · based on community saves</div>
        <p style={styles.summaryText}>{summaries[activeNeighbourhood]}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Trending this week 🔥</h2>
        <div style={styles.trendingList}>
          {trending.map((spot, index) => (
            <button key={spot.id} type="button" style={styles.trendingRow} onClick={() => setSelectedSpot(spot)}>
              <span style={styles.rank}>{index + 1}</span>
              <span style={styles.trendingBody}>
                <span style={styles.trendingName}>{spot.name}</span>
                <span style={styles.trendingTags}>
                  {spot.vibes.slice(0, 2).map(vibe => (
                    <span key={vibe} style={{ ...styles.tag, ...getTagStyle(vibe) }}>{vibe}</span>
                  ))}
                </span>
              </span>
              <span style={styles.saveBadge}>{spot.saves}</span>
            </button>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Community spots</h2>
        <div style={styles.feed}>
          {filteredSpots.map(spot => (
            <button key={spot.id} type="button" style={styles.feedCard} onClick={() => setSelectedSpot(spot)}>
              <div style={styles.cardTop}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.placeName}>{spot.name}</div>
                  <div style={styles.address}>{spot.address}</div>
                </div>
                <span style={styles.neighbourhoodBadge}>{spot.neighbourhood}</span>
              </div>

              <div style={styles.tags}>
                {spot.vibes.map(vibe => (
                  <span key={vibe} style={{ ...styles.tag, ...getTagStyle(vibe) }}>{vibe}</span>
                ))}
              </div>

              <p style={styles.quote}>“{spot.quote}”</p>

              <div style={styles.cardBottom}>
                <div style={styles.avatarStack}>
                  {spot.avatars.map(initials => (
                    <span key={initials} style={styles.avatar}>{initials}</span>
                  ))}
                  <span style={styles.savedBy}>saved this</span>
                </div>
                <div style={styles.actionRow}>
                  <span style={styles.countText}>{spot.saves + (likes[spot.id] || 0)} saves</span>
                  <button type="button" onClick={event => likeSpot(spot, event)} style={styles.likeButton}>❤️</button>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedSpot && (
        <PlaceDetailSheet
          spot={selectedSpot}
          likes={likes[selectedSpot.id] || 0}
          onClose={() => setSelectedSpot(null)}
          onSave={() => saveToMyPlaces(selectedSpot)}
          onShare={shareSpot}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  )
}

function PlaceDetailSheet({ spot, likes, onClose, onSave, onShare }) {
  return (
    <div style={styles.sheetBackdrop}>
      <section style={styles.sheet}>
        <div style={styles.sheetHandle} />
        <div style={styles.sheetTop}>
          <div>
            <h2 style={styles.sheetTitle}>{spot.name}</h2>
            <div style={styles.sheetAddress}>{spot.address}</div>
          </div>
          <button type="button" onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        <div style={styles.tags}>
          {spot.vibes.map(vibe => (
            <span key={vibe} style={{ ...styles.tag, ...getTagStyle(vibe) }}>{vibe}</span>
          ))}
        </div>

        <div style={styles.consensusBox}>
          <div style={styles.consensusLabel}>AI vibe consensus</div>
          <p style={styles.consensusText}>{spot.ai_consensus}</p>
        </div>

        <div style={styles.sheetStats}>
          <div style={styles.statBox}>
            <strong>{spot.saves}</strong>
            <span>saves</span>
          </div>
          <div style={styles.statBox}>
            <strong>{likes}</strong>
            <span>likes</span>
          </div>
        </div>

        <div style={styles.sheetActions}>
          <button type="button" onClick={onSave} style={styles.primaryButton}>Save to my places</button>
          <button type="button" onClick={onShare} style={styles.secondaryButton}>Share</button>
        </div>
      </section>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '18px 16px 88px',
    background: '#fff',
    textAlign: 'left'
  },
  header: {
    marginBottom: 14
  },
  title: {
    margin: 0,
    color: '#111',
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: 0
  },
  subtitle: {
    margin: '7px 0 0',
    color: '#707A75',
    fontSize: 13,
    fontWeight: 700
  },
  filterRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '0 0 14px',
    scrollbarWidth: 'none'
  },
  filterPill: {
    flex: '0 0 auto',
    border: '1px solid #E4EAE7',
    borderRadius: 999,
    padding: '8px 12px',
    background: '#fff',
    color: '#59645F',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer'
  },
  activeFilterPill: {
    border: '1px solid #1D9E75',
    background: '#1D9E75',
    color: '#fff'
  },
  summaryCard: {
    padding: 14,
    borderRadius: 8,
    border: '1px solid #A8DFC9',
    background: '#E1F5EE',
    marginBottom: 18
  },
  summaryLabel: {
    color: '#0F6E56',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0
  },
  summaryText: {
    margin: '9px 0 0',
    color: '#173C33',
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 700
  },
  section: {
    marginTop: 18
  },
  sectionTitle: {
    margin: '0 0 10px',
    color: '#111',
    fontSize: 17,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: 0
  },
  trendingList: {
    display: 'grid',
    gap: 8
  },
  trendingRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    border: '1px solid #EDF0EE',
    borderRadius: 8,
    background: '#fff',
    textAlign: 'left',
    boxShadow: '0 8px 20px rgba(15,26,22,0.05)',
    cursor: 'pointer'
  },
  rank: {
    width: 28,
    height: 28,
    flex: '0 0 28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900
  },
  trendingBody: {
    flex: 1,
    minWidth: 0
  },
  trendingName: {
    display: 'block',
    color: '#111',
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.2
  },
  trendingTags: {
    display: 'flex',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: 5
  },
  saveBadge: {
    flex: '0 0 auto',
    borderRadius: 999,
    padding: '5px 8px',
    background: '#F0FAF6',
    color: '#0F6E56',
    fontSize: 11,
    fontWeight: 900
  },
  feed: {
    display: 'grid',
    gap: 12
  },
  feedCard: {
    width: '100%',
    padding: 13,
    border: '1px solid #EEF0EF',
    borderRadius: 8,
    background: '#fff',
    textAlign: 'left',
    boxShadow: '0 10px 24px rgba(15,26,22,0.06)',
    cursor: 'pointer'
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10
  },
  placeName: {
    color: '#111',
    fontSize: 15,
    lineHeight: 1.15,
    fontWeight: 900
  },
  address: {
    marginTop: 4,
    color: '#7B8580',
    fontSize: 11,
    lineHeight: 1.35,
    fontWeight: 700
  },
  neighbourhoodBadge: {
    flex: '0 0 auto',
    maxWidth: 112,
    borderRadius: 999,
    padding: '4px 8px',
    background: '#F6F7F6',
    color: '#59645F',
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tags: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 10
  },
  tag: {
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 10,
    lineHeight: 1.2,
    fontWeight: 900
  },
  quote: {
    margin: '11px 0 0',
    color: '#3D4642',
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 700
  },
  cardBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12
  },
  avatarStack: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    border: '2px solid #fff',
    marginLeft: -6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#E1F5EE',
    color: '#085041',
    fontSize: 9,
    fontWeight: 900
  },
  savedBy: {
    marginLeft: 7,
    color: '#8B928E',
    fontSize: 10,
    fontWeight: 800
  },
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    flex: '0 0 auto'
  },
  countText: {
    color: '#777',
    fontSize: 11,
    fontWeight: 900
  },
  likeButton: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid #F1D5D5',
    background: '#FFF7F7',
    fontSize: 14,
    cursor: 'pointer'
  },
  sheetBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    background: 'rgba(14, 20, 17, 0.34)'
  },
  sheet: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '74vh',
    overflowY: 'auto',
    padding: '10px 16px 18px',
    borderRadius: '24px 24px 0 0',
    background: '#fff',
    boxShadow: '0 -18px 42px rgba(16, 24, 20, 0.22)'
  },
  sheetHandle: {
    width: 44,
    height: 5,
    margin: '0 auto 13px',
    borderRadius: 20,
    background: '#DDE5E1'
  },
  sheetTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  sheetTitle: {
    margin: 0,
    color: '#111',
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: 0
  },
  sheetAddress: {
    marginTop: 5,
    color: '#7B8580',
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 700
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '1px solid #EDF0EE',
    background: '#fff',
    color: '#777',
    fontSize: 22,
    cursor: 'pointer'
  },
  consensusBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    background: '#F7FAF8',
    border: '1px solid #EDF0EE'
  },
  consensusLabel: {
    color: '#1D9E75',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase'
  },
  consensusText: {
    margin: '6px 0 0',
    color: '#33413B',
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 700
  },
  sheetStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
    marginTop: 12
  },
  statBox: {
    padding: 12,
    borderRadius: 8,
    border: '1px solid #EDF0EE',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    color: '#777',
    fontSize: 11,
    fontWeight: 800
  },
  sheetActions: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: 8,
    marginTop: 14
  },
  primaryButton: {
    border: 'none',
    borderRadius: 999,
    padding: '12px 14px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  },
  secondaryButton: {
    border: '1px solid #DCEBE5',
    borderRadius: 999,
    padding: '12px 14px',
    background: '#F8FBF9',
    color: '#0F6E56',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: 86,
    zIndex: 300,
    transform: 'translateX(-50%)',
    padding: '10px 14px',
    borderRadius: 999,
    background: '#111',
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    boxShadow: '0 12px 28px rgba(0,0,0,0.18)'
  }
}
