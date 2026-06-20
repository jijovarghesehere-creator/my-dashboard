const WEATHER_ICONS = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '🌨️',
  80: '🌦️',
  81: '🌧️',
  82: '🌧️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weatherIcon(code) {
  return WEATHER_ICONS[code] ?? '🌡️'
}

export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
    ].join(','),
    daily: ['weather_code', 'temperature_2m_max', 'temperature_2m_min'].join(','),
    timezone: 'auto',
    forecast_days: '5',
  })

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
  )
  if (!response.ok) throw new Error('Could not load weather data.')
  return response.json()
}

// Fetch tide heights from Open-Meteo's tide endpoint.
// Returns an object { high: {time, height}, low: {time, height} } or null.
export async function fetchTides(lat, lon) {
  const start = new Date().toISOString().slice(0, 10)
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 2)
  const end = endDate.toISOString().slice(0, 10)

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    start_date: start,
    end_date: end,
    timezone: 'auto',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/tide?${params}`)
  if (!response.ok) return null

  const data = await response.json()
  // Open-Meteo may return an array called `heights` with {time, height}
  const heights = data.heights || data.heights_utc || data.heights_local || []
  if (!Array.isArray(heights) || heights.length === 0) return null

  let max = heights[0]
  let min = heights[0]
  for (const h of heights) {
    const value = Number(h.height ?? h.value ?? h[1] ?? NaN)
    if (Number.isFinite(value)) {
      if (value > Number(max.height ?? max.value ?? max[1] ?? -Infinity)) max = h
      if (value < Number(min.height ?? min.value ?? min[1] ?? Infinity)) min = h
    }
  }

  const parse = (item) => ({ time: item.time || item[0], height: Number(item.height ?? item.value ?? item[1]) })
  try {
    return { high: parse(max), low: parse(min) }
  } catch (e) {
    return null
  }
}

export function formatForecastDay(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  if (target.getTime() === today.getTime()) return 'Today'
  return DAY_NAMES[date.getDay()]
}

// Fetch nearby public transit stops using Overpass (OpenStreetMap).
// Returns an array of { name, type, lat, lon, distance_m }
export async function fetchTransit(lat, lon, radius = 1000) {
  const query = `[
out:json][timeout:25];
(
  node(around:${radius},${lat},${lon})[public_transport=platform];
  node(around:${radius},${lat},${lon})[public_transport=stop_position];
  node(around:${radius},${lat},${lon})[highway=bus_stop];
  node(around:${radius},${lat},${lon})[railway=tram_stop];
  node(around:${radius},${lat},${lon})[railway=station];
);
out body 20;
`

  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (!resp.ok) return null
    const data = await resp.json()
    if (!data.elements || data.elements.length === 0) return null

    const toMeters = (d) => Math.round(d)

    // haversine distance
    const toRad = (v) => (v * Math.PI) / 180
    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const R = 6371000
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    }

    const stops = data.elements
      .filter((el) => el.type === 'node')
      .map((el) => {
        const name = (el.tags && (el.tags.name || el.tags.ref)) || 'Unnamed stop'
        const type = (el.tags && (el.tags.public_transport || el.tags.highway || el.tags.railway)) || 'stop'
        const d = distanceMeters(lat, lon, el.lat, el.lon)
        return { name, type, lat: el.lat, lon: el.lon, distance_m: Math.round(d) }
      })
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 8)

    return stops
  } catch (e) {
    return null
  }
}
