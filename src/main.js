import './style.css'
import { getBrowserLocation, reverseGeocode, searchLocation } from './location.js'
import { fetchWeather, formatForecastDay, weatherIcon } from './weather.js'
import { fetchLocalNews, formatNewsDate } from './news.js'

const STORAGE_KEY = 'my-dashboard-manual-location'
const app = document.querySelector('#app')
let activeLocation = null

function renderShell() {
  app.innerHTML = `
    <div class="dashboard">
      <header class="header">
        <div class="header-main">
          <p class="eyebrow">Local dashboard</p>
          <h1 id="location-title">hello Olivia</h1>
          <p id="location-subtitle" class="subtitle"></p>
          <form id="location-form" class="location-form hidden" hidden>
            <label class="location-label" for="location-input">Enter a city or place</label>
            <div class="location-row">
              <input
                id="location-input"
                name="location"
                type="text"
                placeholder="e.g. San Francisco, London"
                autocomplete="off"
                spellcheck="false"
              />
              <button id="location-submit" type="submit" class="location-submit">Go</button>
            </div>
            <button id="use-geo-btn" type="button" class="use-geo-btn">Use my current location</button>
          </form>
        </div>
        <div class="header-meta">
          <p id="clock" class="clock"></p>
          <div class="header-actions">
            <button id="change-location-btn" type="button" class="text-btn hidden" hidden>
              Change location
            </button>
            <button id="refresh-btn" type="button" class="refresh-btn">Refresh</button>
          </div>
        </div>
      </header>

      <main class="grid">
        <section class="card weather-card" aria-labelledby="weather-heading">
          <div class="card-header">
            <h2 id="weather-heading">Weather</h2>
            <span id="weather-updated" class="muted"></span>
          </div>
          <div id="weather-content" class="weather-content loading">Loading weather…</div>
        </section>

        <section class="card news-card" aria-labelledby="news-heading">
          <div class="card-header">
            <h2 id="news-heading">Local news</h2>
            <span id="news-updated" class="muted"></span>
          </div>
          <div id="news-content" class="news-content loading">Loading news…</div>
        </section>
      </main>

      <p id="status" class="status" role="status" aria-live="polite"></p>
    </div>
  `
}

function setStatus(message, isError = false) {
  const status = document.querySelector('#status')
  status.textContent = message
  status.classList.toggle('error', isError)
}

function showLocationForm(show, { focusInput = false } = {}) {
  const form = document.querySelector('#location-form')
  const changeBtn = document.querySelector('#change-location-btn')
  form.hidden = !show
  form.classList.toggle('hidden', !show)
  changeBtn.hidden = show
  changeBtn.classList.toggle('hidden', show)

  if (show && focusInput) {
    document.querySelector('#location-input').focus()
  }
}

function saveManualLocation(query) {
  localStorage.setItem(STORAGE_KEY, query)
}

function getSavedManualLocation() {
  return localStorage.getItem(STORAGE_KEY) ?? ''
}

function renderWeather(data) {
  const current = data.current
  const daily = data.daily

  const forecastHtml = daily.time
    .map((date, index) => {
      const code = daily.weather_code[index]
      const high = Math.round(daily.temperature_2m_max[index])
      const low = Math.round(daily.temperature_2m_min[index])

      return `
        <li class="forecast-day">
          <span class="forecast-label">${formatForecastDay(date)}</span>
          <span class="forecast-icon" aria-hidden="true">${weatherIcon(code)}</span>
          <span class="forecast-temps"><strong>${high}°</strong> / ${low}°</span>
        </li>
      `
    })
    .join('')

  return `
    <div class="weather-current">
      <div class="weather-main">
        <span class="weather-icon" aria-hidden="true">${weatherIcon(current.weather_code)}</span>
        <div>
          <p class="temperature">${Math.round(current.temperature_2m)}°</p>
          <p class="feels-like">Feels like ${Math.round(current.apparent_temperature)}°</p>
        </div>
      </div>
      <ul class="weather-stats">
        <li><span>Humidity</span><strong>${current.relative_humidity_2m}%</strong></li>
        <li><span>Wind</span><strong>${Math.round(current.wind_speed_10m)} km/h</strong></li>
      </ul>
    </div>
    <ul class="forecast">${forecastHtml}</ul>
  `
}

function renderNews(articles) {
  if (articles.length === 0) {
    return '<p class="empty">No local news articles found right now.</p>'
  }

  const items = articles
    .map(
      (article) => `
        <li class="news-item">
          <a href="${article.link}" target="_blank" rel="noopener noreferrer">
            <span class="news-title">${escapeHtml(article.title)}</span>
            <span class="news-meta">
              ${escapeHtml(article.source)}${article.pubDate ? ` · ${formatNewsDate(article.pubDate)}` : ''}
            </span>
          </a>
        </li>
      `,
    )
    .join('')

  return `<ul class="news-list">${items}</ul>`
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function updateClock() {
  const clock = document.querySelector('#clock')
  if (!clock) return
  clock.textContent = new Date().toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function loadDashboard({ mode = 'auto', query = '' } = {}) {
  const weatherContent = document.querySelector('#weather-content')
  const newsContent = document.querySelector('#news-content')
  const locationTitle = document.querySelector('#location-title')
  const locationSubtitle = document.querySelector('#location-subtitle')
  const refreshBtn = document.querySelector('#refresh-btn')
  const locationSubmit = document.querySelector('#location-submit')
  const locationInput = document.querySelector('#location-input')

  refreshBtn.disabled = true
  locationSubmit.disabled = true
  weatherContent.classList.add('loading')
  newsContent.classList.add('loading')
  weatherContent.textContent = 'Loading weather…'
  newsContent.textContent = 'Loading news…'

  try {
    let lat
    let lon
    let place

    if (mode === 'manual') {
      setStatus(`Looking up "${query}"…`)
      const result = await searchLocation(query)
      lat = result.lat
      lon = result.lon
      place = result.place
      saveManualLocation(query)
      showLocationForm(false)
    } else if (mode === 'geo') {
      setStatus('Detecting your location…')
      const coords = await getBrowserLocation()
      lat = coords.lat
      lon = coords.lon
      place = await reverseGeocode(lat, lon)
      localStorage.removeItem(STORAGE_KEY)
      showLocationForm(false)
    } else {
      setStatus('Detecting your location…')
      try {
        const coords = await getBrowserLocation()
        lat = coords.lat
        lon = coords.lon
        place = await reverseGeocode(lat, lon)
        showLocationForm(false)
      } catch (geoError) {
        const saved = getSavedManualLocation()
        locationInput.value = saved
        showLocationForm(true, { focusInput: !saved })
        throw geoError
      }
    }

    locationTitle.textContent = place.city
    locationSubtitle.textContent = place.label
    setStatus('')

    activeLocation =
      mode === 'manual'
        ? { mode: 'manual', query, lat, lon }
        : { mode: 'geo', lat, lon }

    const [weather, news] = await Promise.all([
      fetchWeather(lat, lon),
      fetchLocalNews(place.searchQuery),
    ])

    weatherContent.classList.remove('loading')
    newsContent.classList.remove('loading')
    weatherContent.innerHTML = renderWeather(weather)
    newsContent.innerHTML = renderNews(news)

    document.querySelector('#change-location-btn').hidden = false
    document.querySelector('#change-location-btn').classList.remove('hidden')

    const updated = new Date().toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    document.querySelector('#weather-updated').textContent = `Updated ${updated}`
    document.querySelector('#news-updated').textContent = `Updated ${updated}`
  } catch (error) {
    weatherContent.classList.remove('loading')
    newsContent.classList.remove('loading')
    weatherContent.innerHTML = '<p class="empty">Weather unavailable.</p>'
    newsContent.innerHTML = '<p class="empty">News unavailable.</p>'

    if (mode !== 'manual') {
      locationTitle.textContent = 'Location needed'
      locationSubtitle.textContent = 'Enter a place below or allow browser location access.'
      showLocationForm(true, { focusInput: true })
    }

    setStatus(error.message, true)
  } finally {
    refreshBtn.disabled = false
    locationSubmit.disabled = false
  }
}

function bindEvents() {
  document.querySelector('#refresh-btn').addEventListener('click', () => {
    if (activeLocation?.mode === 'manual') {
      loadDashboard({ mode: 'manual', query: activeLocation.query })
    } else if (activeLocation?.mode === 'geo') {
      loadDashboard({ mode: 'geo' })
    } else {
      loadDashboard({ mode: 'auto' })
    }
  })

  document.querySelector('#change-location-btn').addEventListener('click', () => {
    const input = document.querySelector('#location-input')
    input.value = getSavedManualLocation()
    showLocationForm(true, { focusInput: true })
    setStatus('Enter a city or place, or use your current location.')
  })

  document.querySelector('#use-geo-btn').addEventListener('click', () => {
    loadDashboard({ mode: 'geo' })
  })

  document.querySelector('#location-form').addEventListener('submit', (event) => {
    event.preventDefault()
    const query = document.querySelector('#location-input').value
    loadDashboard({ mode: 'manual', query })
  })
}

renderShell()
bindEvents()
updateClock()
setInterval(updateClock, 30000)
loadDashboard({ mode: 'auto' })
