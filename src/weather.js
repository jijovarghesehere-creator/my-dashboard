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

export function formatForecastDay(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  if (target.getTime() === today.getTime()) return 'Today'
  return DAY_NAMES[date.getDay()]
}
