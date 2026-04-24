# InspoMap 🗺️

> Discover Singapore by vibe, not category.

InspoMap is a vibe-based city discovery web app built for the GrabMaps Hackathon 2026. Instead of searching for "cafe" or "park", you describe a feeling — and InspoMap uses AI to find the right place for that mood, powered by GrabMaps hyperlocal data.

**Live demo:** https://project-70zb3.vercel.app

---

## What it does

Most map apps ask *where* you want to go. InspoMap asks *how you want to feel*.

Type "quiet spot after a run near Serangoon" or "romantic evening near Clarke Quay" — and InspoMap interprets your mood, searches GrabMaps for real matching places, and pins them on a live map.

---

## Features

### 🔍 Vibe Search
Natural language mood input → Groq AI interprets the vibe → GrabMaps POI Search returns real Singapore places → numbered pins appear on a live MapLibre map with place cards showing name, address, vibe tag, and walking distance.

### ✨ Plan My Evening
Describe your ideal evening and get a personalised 3-stop route. AI plans the stops, GrabMaps Routing API draws the live walking path between them with total distance and time. Start Journey mode lets you navigate stop by stop.

### 📍 Saved Places
A personal city memory journal. Every saved place goes on a Zenly-inspired full-screen GrabMaps map with colored pins. Add photos, write notes, tag vibes, and set public or private visibility.

### 🗺️ Explorer Tracker
Gamified neighbourhood discovery that tracks which Singapore zones you've explored. Unlock 15 neighbourhoods, earn milestone badges (First Pin, Night Owl, Post-Run, City Mapper and more), and track your weekly exploration streak.

### 👥 Community
Trending spots, AI-generated neighbourhood summaries, and curated local Singapore places with vibe tags and community quotes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), plain JSX, mobile-first |
| Maps | MapLibre GL JS + GrabMaps mono tile style |
| Backend | Vercel Edge Functions |
| AI | Groq API (llama-3.3-70b-versatile) |
| Storage | localStorage |
| Deployment | Vercel |

---

## GrabMaps APIs Used

- **POI Keyword Search** — finds real places matching AI-extracted keywords
- **Nearby Places** — surfaces popular spots around user's location
- **Reverse Geocoding** — converts GPS coordinates to place names
- **Routing API** — generates walking directions between journey stops

All GrabMaps API calls are proxied through Vercel Edge Functions following GrabMaps best practices — no keys exposed to the frontend.

---

## Setup

```bash
# Install dependencies
npm install

# Add environment variables
cp .env.example .env.local
# Fill in VITE_GRABMAPS_KEY, GROQ_KEY

# Run locally
npm run dev

# Deploy
vercel --prod
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GRABMAPS_KEY` | GrabMaps API key (backend) |
| `VITE_GRABMAPS_KEY` | GrabMaps API key (frontend) |
| `GROQ_KEY` | Groq API key |

---

## Project Structure

- **api/**
  - `vibe-search.js` → Vibe search endpoint
  - `vibe-journey.js` → Journey planning endpoint
- **src/pages/**
  - `Discover.jsx` → Main discovery + map
  - `Saved.jsx` → Memory journal + Explorer
  - `Community.jsx` → Trending + community spots
  - `Profile.jsx` → User profile + vibe passport
- `index.html`
- `vercel.json`

## Built at

GrabMaps Hackathon — April 24, 2026, Singapore 🇸🇬
