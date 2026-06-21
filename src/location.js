export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }

    // Geolocation only works in secure contexts (HTTPS or localhost).
    // Provide a clear error so callers can fallback to an IP-based lookup if desired.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      reject(new Error('Geolocation requires a secure context (HTTPS).'))
      return
    }

    // If permissions API reports 'denied', fail fast with a helpful message.
    if (navigator.permissions && navigator.permissions.query) {
      try {
        navigator.permissions.query({ name: 'geolocation' }).then((p) => {
          if (p.state === 'denied') {
            reject(new Error('Location access was denied. Allow location in your browser settings.'))
            return
          }
          // If not denied, continue to request location below.
        })
      } catch (e) {
        // swallow and continue to request geolocation — older browsers may throw
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          source: 'gps',
        })
      },
      (error) => {
        const messages = {
          1: 'Location access was denied. Allow location in your browser settings.',
          2: 'Your location could not be determined.',
          3: 'Location request timed out. Try again.',
        }
        reject(new Error(messages[error.code] ?? 'Could not get your location.'))
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    )
  })
}

// Fallback: fetch an approximate location based on the client's IP address.
// This is used when browser geolocation is unavailable (e.g., insecure context or denied).
export async function fetchIpLocation() {
  // Use a public IP geolocation service that supports HTTPS. ipapi.co is simple and free
  // for basic use; consider replacing with your own backend or paid provider for
  // production/volume usage.
  try {
  const res = await fetch('https://ipapi.co/json/')
    if (!res.ok) throw new Error('IP lookup failed')
    const data = await res.json()
    if (!data || !data.latitude || !data.longitude) throw new Error('IP lookup returned no coords')
  return { lat: Number(data.latitude), lon: Number(data.longitude), source: 'ip' }
  } catch (e) {
    // Try an alternate provider as a second chance
    try {
  const r2 = await fetch('https://ipwhois.app/json/')
      if (!r2.ok) throw new Error('IP lookup failed')
      const d2 = await r2.json()
      if (!d2 || !d2.latitude || !d2.longitude) throw new Error('IP lookup returned no coords')
  return { lat: Number(d2.latitude), lon: Number(d2.longitude), source: 'ip' }
    } catch (e2) {
      throw new Error('Could not determine location from IP')
    }
  }
}

// Try high-quality browser geolocation first, then fall back to IP-based lookup.
export async function getLocationWithFallback() {
  try {
    return await getBrowserLocation()
  } catch (e) {
    // If user denied or secure context prevents geolocation, try IP-based lookup.
    try {
      return await fetchIpLocation()
    } catch (ipErr) {
      // rethrow original browser error if IP fallback also fails so callers get the more
      // actionable browser message (e.g., permission denied).
      throw e
    }
  }
}

function parsePlace(data) {
  const address = data.address ?? {}

  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    data.name ??
    'Your area'

  const region = address.state ?? address.region ?? ''
  const country = address.country ?? ''

  return {
    city,
    region,
    country,
    label: data.display_name ?? [city, region].filter(Boolean).join(', '),
    searchQuery: [city, country].filter(Boolean).join(' ') || city,
  }
}

export async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({
    lat,
    lon,
    format: 'json',
    zoom: '10',
  })

  // Try primary reverse endpoint via our API proxy
  let response = await fetch(`/api/nominatim/reverse?${params}`)

  // If 404 or other non-ok, try jsonv2 format which some nominatim instances prefer
  if (!response.ok) {
    try {
      const paramsV2 = new URLSearchParams({ lat, lon, format: 'jsonv2', zoom: '10' })
      const r2 = await fetch(`/api/nominatim/reverse?${paramsV2}`)
      if (r2.ok) {
        response = r2
      }
    } catch (e) {
      // swallow and continue to throw below
    }
  }

  if (!response.ok) {
    // Try one direct attempt to upstream for debugging (may be blocked by CORS in browser)
    try {
      const direct = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)
      if (direct.ok) return parsePlace(await direct.json())
    } catch (e) {
      // ignore
    }

    const text = await response.text().catch(() => '')
    throw new Error(`Could not resolve your location name (status ${response.status}): ${text}`)
  }

  return parsePlace(await response.json())
}

export async function searchLocation(query) {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('Enter a city or place name.')

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: '1',
  })

  const response = await fetch(`/api/nominatim/search?${params}`)
  if (!response.ok) throw new Error('Could not search for that location.')

  const results = await response.json()
  if (results.length === 0) {
    throw new Error('No matching location found. Try a city name like "Boston" or "London, UK".')
  }

  const match = results[0]
  return {
    lat: Number(match.lat),
    lon: Number(match.lon),
    place: parsePlace(match),
  }
}

export async function searchSuggestions(query, limit = 5) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: String(limit),
  })

  const response = await fetch(`/api/nominatim/search?${params}`)
  if (!response.ok) return []
  const results = await response.json()
  return results.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }))
}
