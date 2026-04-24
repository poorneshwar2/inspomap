import { useEffect, useState } from 'react'

export default function useLocation() {
  const [location, setLocation] = useState(null)
  const [neighbourhood, setNeighbourhood] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 1.3521, lng: 103.8198 })
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      () => {
        setLocation({ lat: 1.3521, lng: 103.8198 })
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  return { location, neighbourhood, loading }
}
