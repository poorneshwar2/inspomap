import { useMemo, useState } from 'react'

const PROFILE_KEY = 'inspomap_profile'
const SAVED_KEY = 'inspomap_saved'
const LIKES_KEY = 'inspomap_likes'
const STATS_KEY = 'inspomap_stats'

const avatarColors = ['#1D9E75', '#534AB7', '#D85A30', '#BA7517', '#0F6E56']
const neighbourhoods = ['Tiong Bahru', 'Orchard', 'Bugis', 'Chinatown', 'Clementi', 'Tampines', 'Jurong', 'Bishan', 'Woodlands', 'Other']
const interests = [
  '📚 Reading',
  '☕ Coffee',
  '🏃 Running',
  '📸 Photography',
  '🍜 Local food',
  '🌿 Nature',
  '🎨 Arts & culture',
  '🍸 Nightlife',
  '🌅 Sunsets',
  '🏙️ City walks',
  '🥐 Brunch',
  '🎵 Music'
]

const defaultProfile = {
  name: '',
  age: '',
  neighbourhood: 'Tiong Bahru',
  bio: '',
  interests: ['📚 Reading'],
  sharePublicly: false,
  personaliseResults: true
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
    return value ?? fallback
  } catch (error) {
    console.error(`Could not read ${key}`, error)
    return fallback
  }
}

function loadProfile() {
  const stored = readJson(PROFILE_KEY, null)
  if (!stored) return null

  return {
    ...defaultProfile,
    ...stored,
    interests: Array.isArray(stored.interests) && stored.interests.length ? stored.interests : defaultProfile.interests
  }
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'IM'
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join('')
}

function getAvatarColor(name) {
  const first = (name.trim()[0] || 'I').toUpperCase()
  const index = Math.max(0, first.charCodeAt(0) - 65) % avatarColors.length
  return avatarColors[index]
}

function getPersona(profile) {
  const joined = profile.interests.join(' ').toLowerCase()
  if (joined.includes('reading') || joined.includes('coffee')) return 'Solo Explorer'
  if (joined.includes('local food')) return 'Local Food Hunter'
  if (joined.includes('photography') || joined.includes('sunsets')) return 'Golden Hour Chaser'
  if (joined.includes('nightlife') || joined.includes('brunch') || joined.includes('music')) return 'City Connector'
  return 'Vibe Seeker'
}

function savedPlaces() {
  const saved = readJson(SAVED_KEY, [])
  return Array.isArray(saved) ? saved : []
}

function likesCount() {
  const likes = readJson(LIKES_KEY, {})
  return Object.values(likes).reduce((sum, value) => sum + Number(value || 0), 0)
}

function statsCount() {
  const stats = readJson(STATS_KEY, {})
  return Number(stats.vibesSearched || 0)
}

function hasSavedVibe(places, words) {
  return places.some(place => (place.vibes || []).some(vibe => {
    const lower = vibe.toLowerCase()
    return words.some(word => lower.includes(word))
  }))
}

function hasSearchedPostRun() {
  const stats = readJson(STATS_KEY, {})
  return Boolean(stats.postRunSearched)
}

export default function Profile() {
  const storedProfile = loadProfile()
  const [profile, setProfile] = useState(() => storedProfile || defaultProfile)
  const [draft, setDraft] = useState(() => storedProfile || defaultProfile)
  const [editing, setEditing] = useState(() => !storedProfile)
  const [toast, setToast] = useState('')
  const [savedVersion, setSavedVersion] = useState(0)

  const places = useMemo(() => savedPlaces(), [savedVersion])
  const persona = getPersona(profile)
  const placeCount = places.length
  const likedCount = likesCount()
  const searchedCount = statsCount()

  const badges = [
    { emoji: '📚', earned: hasSavedVibe(places, ['reading', 'quiet']) },
    { emoji: '🍜', earned: hasSavedVibe(places, ['food', 'hawker', 'local eats', 'kopitiam']) },
    { emoji: '📸', earned: hasSavedVibe(places, ['photo', 'sunset', 'photography']) },
    { emoji: '🏃', earned: hasSearchedPostRun() },
    { emoji: '🌟', earned: placeCount >= 5 }
  ]

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(''), 2000)
  }

  function updateDraft(field, value) {
    setDraft(current => ({ ...current, [field]: value }))
  }

  function toggleInterest(interest) {
    setDraft(current => {
      const selected = current.interests.includes(interest)
      if (selected && current.interests.length === 1) return current
      return {
        ...current,
        interests: selected
          ? current.interests.filter(item => item !== interest)
          : [...current.interests, interest]
      }
    })
  }

  function saveProfile() {
    const nextProfile = {
      ...draft,
      name: draft.name.trim(),
      bio: draft.bio.slice(0, 80),
      age: draft.age ? Number(draft.age) : ''
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
    setProfile(nextProfile)
    setDraft(nextProfile)
    setEditing(false)
    showToast('Profile saved! ✓')
  }

  function startEdit() {
    setDraft(profile)
    setEditing(true)
  }

  function updateSetting(field, value) {
    const nextProfile = { ...profile, [field]: value }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile))
    setProfile(nextProfile)
    setDraft(nextProfile)
  }

  function clearSavedPlaces() {
    const shouldClear = window.confirm('Clear all saved places? This cannot be undone.')
    if (!shouldClear) return
    localStorage.setItem(SAVED_KEY, JSON.stringify([]))
    setSavedVersion(version => version + 1)
    showToast('Saved places cleared')
  }

  const viewProfile = editing ? draft : profile

  return (
    <div style={styles.page}>
      {editing && !storedProfile && (
        <section style={styles.onboarding}>
          <div style={styles.onboardingTitle}>Tell us your vibe</div>
          <div style={styles.onboardingSubtitle}>Personalise your InspoMap experience</div>
        </section>
      )}

      <section style={styles.header}>
        <div style={{ ...styles.avatar, background: getAvatarColor(viewProfile.name) }}>
          {getInitials(viewProfile.name)}
        </div>
        <div style={styles.name}>{viewProfile.name || 'InspoMap Explorer'}</div>
        <div style={styles.persona}>{persona}</div>
        {!editing && (
          <button type="button" onClick={startEdit} style={styles.editButton}>Edit profile</button>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Personal info</h2>
        <Field label="Name" editing={editing}>
          {editing ? (
            <input value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="Your name" style={styles.input} />
          ) : (
            <span>{profile.name || 'Not set'}</span>
          )}
        </Field>
        <Field label="Age" editing={editing}>
          {editing ? (
            <input value={draft.age} onChange={event => updateDraft('age', event.target.value)} type="number" min="1" placeholder="Age" style={styles.input} />
          ) : (
            <span>{profile.age || 'Not set'}</span>
          )}
        </Field>
        <Field label="Neighbourhood" editing={editing}>
          {editing ? (
            <select value={draft.neighbourhood} onChange={event => updateDraft('neighbourhood', event.target.value)} style={styles.input}>
              {neighbourhoods.map(neighbourhood => (
                <option key={neighbourhood} value={neighbourhood}>{neighbourhood}</option>
              ))}
            </select>
          ) : (
            <span>{profile.neighbourhood}</span>
          )}
        </Field>
        <Field label="Bio" editing={editing}>
          {editing ? (
            <input value={draft.bio} onChange={event => updateDraft('bio', event.target.value.slice(0, 80))} placeholder="Runner, reader, coffee addict" style={styles.input} />
          ) : (
            <span>{profile.bio || 'No bio yet'}</span>
          )}
        </Field>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Your vibes</h2>
        <div style={styles.interestGrid}>
          {interests.map(interest => {
            const active = viewProfile.interests.includes(interest)
            return (
              <button
                key={interest}
                type="button"
                onClick={() => editing && toggleInterest(interest)}
                style={{
                  ...styles.interestChip,
                  ...(active ? styles.activeInterestChip : {}),
                  cursor: editing ? 'pointer' : 'default'
                }}
              >
                {interest}
              </button>
            )
          })}
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Your InspoMap</h2>
        <div style={styles.statsGrid}>
          <Stat emoji="🗺️" value={placeCount} label="Places saved" />
          <Stat emoji="❤️" value={likedCount} label="Places liked" />
          <Stat emoji="🔥" value={searchedCount} label="Vibes searched" />
        </div>
        <div style={styles.passport}>
          <div style={styles.passportTitle}>Vibe passport</div>
          <div style={styles.badgeRow}>
            {badges.map(badge => (
              <span key={badge.emoji} style={{ ...styles.badge, ...(badge.earned ? {} : styles.unearnedBadge) }}>{badge.emoji}</span>
            ))}
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>Settings</h2>
        <Toggle
          label="Share my saves publicly"
          checked={Boolean(profile.sharePublicly)}
          onChange={() => updateSetting('sharePublicly', !profile.sharePublicly)}
        />
        <Toggle
          label="Personalise results with my profile"
          checked={Boolean(profile.personaliseResults)}
          onChange={() => updateSetting('personaliseResults', !profile.personaliseResults)}
        />
        <button type="button" onClick={clearSavedPlaces} style={styles.clearButton}>Clear all saved places</button>
        <div style={styles.version}>InspoMap v1.0 · Built for GrabMaps Hackathon 2026</div>
      </section>

      {editing && (
        <div style={styles.saveBar}>
          <button type="button" onClick={saveProfile} style={styles.saveButton}>Save</button>
        </div>
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  )
}

function Field({ label, editing, children }) {
  return (
    <div style={styles.field}>
      <div>
        <div style={styles.fieldLabel}>{label}</div>
        {!editing && <div style={styles.fieldValue}>{children}</div>}
      </div>
      {editing && <div style={styles.fieldEdit}>{children}</div>}
    </div>
  )
}

function Stat({ emoji, value, label }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statEmoji}>{emoji}</div>
      <strong style={styles.statValue}>{value}</strong>
      <span style={styles.statLabel}>{label}</span>
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" onClick={onChange} style={styles.toggleRow}>
      <span>{label}</span>
      <span style={{ ...styles.toggleTrack, ...(checked ? styles.toggleTrackOn : {}) }}>
        <span style={{ ...styles.toggleKnob, ...(checked ? styles.toggleKnobOn : {}) }} />
      </span>
    </button>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: '18px 16px 96px',
    background: '#fff',
    color: '#111',
    textAlign: 'left'
  },
  onboarding: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 8,
    background: '#E1F5EE',
    border: '1px solid #A8DFC9'
  },
  onboardingTitle: {
    color: '#0F6E56',
    fontSize: 17,
    fontWeight: 900
  },
  onboardingSubtitle: {
    marginTop: 4,
    color: '#456A5E',
    fontSize: 12,
    fontWeight: 700
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0 18px'
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 28,
    fontWeight: 900,
    boxShadow: '0 14px 30px rgba(15,26,22,0.18)'
  },
  name: {
    marginTop: 12,
    color: '#111',
    fontSize: 24,
    lineHeight: 1.1,
    fontWeight: 900
  },
  persona: {
    marginTop: 5,
    borderRadius: 999,
    padding: '5px 10px',
    background: '#F0FAF6',
    color: '#0F6E56',
    fontSize: 11,
    fontWeight: 900
  },
  editButton: {
    marginTop: 12,
    border: '1px solid #DCEBE5',
    borderRadius: 999,
    padding: '8px 13px',
    background: '#fff',
    color: '#1D9E75',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer'
  },
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 8,
    border: '1px solid #EEF0EF',
    background: '#fff',
    boxShadow: '0 10px 24px rgba(15,26,22,0.06)',
    transition: 'all 180ms ease'
  },
  sectionTitle: {
    margin: '0 0 12px',
    color: '#111',
    fontSize: 17,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: 0
  },
  field: {
    display: 'grid',
    gap: 7,
    padding: '10px 0',
    borderTop: '1px solid #F1F3F2'
  },
  fieldLabel: {
    color: '#7C8580',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase'
  },
  fieldValue: {
    marginTop: 3,
    color: '#222',
    fontSize: 14,
    fontWeight: 800
  },
  fieldEdit: {
    width: '100%'
  },
  input: {
    width: '100%',
    border: '1px solid #E4EAE7',
    borderRadius: 8,
    padding: '10px 11px',
    background: '#F8FAF9',
    color: '#111',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none'
  },
  interestGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8
  },
  interestChip: {
    minHeight: 38,
    border: '1px solid #E1E5E3',
    borderRadius: 8,
    padding: '8px 9px',
    background: '#fff',
    color: '#59645F',
    fontSize: 12,
    fontWeight: 900,
    textAlign: 'left'
  },
  activeInterestChip: {
    border: '1px solid #1D9E75',
    background: '#1D9E75',
    color: '#fff'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8
  },
  statBox: {
    minHeight: 86,
    borderRadius: 8,
    border: '1px solid #EDF0EE',
    background: '#F8FAF9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    textAlign: 'center'
  },
  statEmoji: {
    fontSize: 18
  },
  statValue: {
    color: '#111',
    fontSize: 20,
    lineHeight: 1
  },
  statLabel: {
    color: '#7C8580',
    fontSize: 9,
    lineHeight: 1.2,
    fontWeight: 900
  },
  passport: {
    marginTop: 13,
    padding: 12,
    borderRadius: 8,
    background: '#F7FAF8'
  },
  passportTitle: {
    color: '#333',
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 9
  },
  badgeRow: {
    display: 'flex',
    gap: 8
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    border: '1px solid #E5ECE8',
    fontSize: 19
  },
  unearnedBadge: {
    filter: 'grayscale(1)',
    opacity: 0.32
  },
  toggleRow: {
    width: '100%',
    minHeight: 44,
    border: 'none',
    borderTop: '1px solid #F1F3F2',
    background: '#fff',
    color: '#222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 999,
    background: '#D7DDDA',
    padding: 3,
    transition: 'background 180ms ease'
  },
  toggleTrackOn: {
    background: '#1D9E75'
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'block',
    background: '#fff',
    transition: 'transform 180ms ease'
  },
  toggleKnobOn: {
    transform: 'translateX(18px)'
  },
  clearButton: {
    width: '100%',
    marginTop: 12,
    border: 'none',
    borderRadius: 8,
    padding: '12px 14px',
    background: '#FFF1EF',
    color: '#B42318',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer'
  },
  version: {
    marginTop: 12,
    color: '#8B928E',
    fontSize: 10,
    lineHeight: 1.35,
    fontWeight: 800,
    textAlign: 'center'
  },
  saveBar: {
    position: 'fixed',
    left: '50%',
    bottom: 74,
    zIndex: 20,
    width: '100%',
    maxWidth: 390,
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.92)',
    transform: 'translateX(-50%)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid #EEF0EF'
  },
  saveButton: {
    width: '100%',
    border: 'none',
    borderRadius: 999,
    padding: '13px 16px',
    background: '#1D9E75',
    color: '#fff',
    fontSize: 14,
    fontWeight: 900,
    cursor: 'pointer'
  },
  toast: {
    position: 'fixed',
    left: '50%',
    bottom: 134,
    zIndex: 30,
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
