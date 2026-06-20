export function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.debug('Geolocation API not available on navigator')
      reject(new Error('Geolocation is not supported by your browser.'))
      return
    }

    // If the Permissions API is available, query the permission first to provide
    // a clearer error message and avoid triggering a prompt in some browsers.
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          console.debug('Geolocation permission state:', status.state)
          // If denied, reject early with a clear message
          if (status.state === 'denied') {
            reject(new Error('Location access was denied. Allow location in your browser settings.'))
            return
          }

          // otherwise, request the location which may prompt the user
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              })
            },
            (error) => {
              const messages = {
                1: 'Location access was denied. Allow location in your browser settings.',
                2: 'Your location could not be determined.',
                3: 'Location request timed out. Try again.',
              }
              console.debug('Geolocation error', error)
              reject(new Error(messages[error.code] ?? 'Could not get your location.'))
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
          )
        })
        .catch((err) => {
          console.debug('Permissions API query failed', err)
          // Fallback to directly requesting geolocation
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              })
            },
            (error) => {
              const messages = {
                1: 'Location access was denied. Allow location in your browser settings.',
                2: 'Your location could not be determined.',
                3: 'Location request timed out. Try again.',
              }
              console.debug('Geolocation error', error)
              reject(new Error(messages[error.code] ?? 'Could not get your location.'))
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
          )
        })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      (error) => {
        const messages = {
          1: 'Location access was denied. Allow location in your browser settings.',
          2: 'Your location could not be determined.',
          3: 'Location request timed out. Try again.',
        }
        console.debug('Geolocation error (no Permissions API)', error)
        reject(new Error(messages[error.code] ?? 'Could not get your location.'))
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    )
  })
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

  const response = await fetch(`/api/nominatim/reverse?${params}`)
  if (!response.ok) throw new Error('Could not resolve your location name.')

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
