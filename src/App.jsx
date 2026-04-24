import { Routes, Route, NavLink } from 'react-router-dom'
import Discover from './pages/Discover'
import Community from './pages/Community'
import Saved from './pages/Saved'
import Profile from './pages/Profile'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <div className="screen">
        <Routes>
          <Route path="/" element={<Discover />} />
          <Route path="/community" element={<Community />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>

      <nav className="bottom-nav">
        <NavLink to="/" end>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M13 7l-2.5 5.5L5 10l5.5-2.5L13 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span>Discover</span>
        </NavLink>
        <NavLink to="/community">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="13" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M2 16c0-2.5 2-4 5-4m6 0c3 0 5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Community</span>
        </NavLink>
        <NavLink to="/saved">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 3h10a1 1 0 011 1v13l-6-3-6 3V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <span>Saved</span>
        </NavLink>
        <NavLink to="/profile">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 17c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}