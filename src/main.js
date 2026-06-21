import './style.css'
import { getBrowserLocation, getLocationWithFallback, reverseGeocode, searchLocation } from './location.js'
import { fetchWeather, formatForecastDay, weatherIcon, fetchTides } from './weather.js'
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
          <p id="location-subtitle" class="subtitle"><span id="location-label"></span><span id="location-source" class="location-source" aria-hidden="true"></span></p>
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
            <ul id="location-suggestions" class="location-suggestions" hidden></ul>
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
          <div id="tide-content" class="tide-content loading">Loading tides…</div>
        </section>

        <section class="card news-card" aria-labelledby="news-heading">
          <div class="card-header">
            <h2 id="news-heading">Local news</h2>
            <span id="news-updated" class="muted"></span>
          </div>
          <div id="news-content" class="news-content loading">Loading news…</div>
        </section>
        
        <section class="card transit-card" aria-labelledby="transit-heading">
          <div class="card-header">
            <h2 id="transit-heading">Transit nearby</h2>
          </div>
          <div id="transit-content" class="transit-content loading">Loading transit…</div>
        </section>
      </main>

      <p id="status" class="status" role="status" aria-live="polite"></p>
    </div>
  `
}

// debounce helper
function debounce(fn, wait = 300) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
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
          <p class="temperature">${Math.round(current.temperature_2m)}°C / ${Math.round(current.temperature_2m * 9/5 + 32)}°F</p>
          <p class="feels-like">Feels like ${Math.round(current.apparent_temperature)}°C</p>
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
      const coords = await getLocationWithFallback()
      lat = coords.lat
      lon = coords.lon
      place = await reverseGeocode(lat, lon)
      localStorage.removeItem(STORAGE_KEY)
      showLocationForm(false)
    } else {
      setStatus('Detecting your location…')
      try {
        const coords = await getLocationWithFallback()
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
    const labelEl = document.querySelector('#location-label')
    const sourceEl = document.querySelector('#location-source')
    if (labelEl) labelEl.textContent = place.label
    if (sourceEl) sourceEl.textContent = ''

    // If the coords object included a source flag, show an indicator when using IP fallback.
    if (typeof activeLocation === 'object') {
      // activeLocation isn't set yet, so examine coords/place flow: we set activeLocation below.
    }
    setStatus('')

    activeLocation =
      mode === 'manual'
        ? { mode: 'manual', query, lat, lon }
        : { mode: 'geo', lat, lon }

    // Determine and display the source indicator. If the place object doesn't include
    // a source, the coords variable may include it — check both.
    const coordsSource = (typeof coords !== 'undefined' && coords?.source) || null
    const source = coordsSource || null
    if (source === 'ip') {
      const sourceEl2 = document.querySelector('#location-source')
      if (sourceEl2) sourceEl2.textContent = ' · approximate location'
    }

    const [weather, news] = await Promise.all([
      fetchWeather(lat, lon),
      fetchLocalNews(place.searchQuery),
    ])

    // Fetch tides separately (don't block weather/news on tide failures)
    fetchTides(lat, lon)
      .then((tides) => {
        const tideContent = document.querySelector('#tide-content')
        if (!tideContent) return
        tideContent.classList.remove('loading')
        if (!tides) {
          tideContent.innerHTML = '<p class="empty">Tide data unavailable.</p>'
          return
        }
        tideContent.innerHTML = `
          <div class="tide-block">
            <div class="tide-item"><strong>High tide</strong><div>${new Date(tides.high.time).toLocaleString()} — ${tides.high.height.toFixed(2)} m</div></div>
            <div class="tide-item"><strong>Low tide</strong><div>${new Date(tides.low.time).toLocaleString()} — ${tides.low.height.toFixed(2)} m</div></div>
          </div>
        `
      })
      .catch(() => {
        const tideContent = document.querySelector('#tide-content')
        if (tideContent) tideContent.innerHTML = '<p class="empty">Tide data unavailable.</p>'
      })

    // Fetch nearby transit stops (non-blocking)
    import('./weather.js').then(({ fetchTransit }) => {
      fetchTransit(lat, lon)
        .then((stops) => {
          const transitContent = document.querySelector('#transit-content')
          if (!transitContent) return
          transitContent.classList.remove('loading')
          if (!stops || stops.length === 0) {
            transitContent.innerHTML = '<p class="empty">No nearby transit stops found.</p>'
            return
          }
          const items = stops
            .map((s) => `<li><strong>${escapeHtml(s.name)}</strong> · ${escapeHtml(s.type)} · ${s.distance_m} m</li>`)
            .join('')
          transitContent.innerHTML = `<ul class="transit-list">${items}</ul>`
        })
        .catch(() => {
          const transitContent = document.querySelector('#transit-content')
          if (transitContent) transitContent.innerHTML = '<p class="empty">Transit data unavailable.</p>'
        })
    })

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

  // Autocomplete suggestions
  const input = document.querySelector('#location-input')
  const suggestions = document.querySelector('#location-suggestions')
  let selectedIndex = -1

  function closeSuggestions() {
    suggestions.hidden = true
    suggestions.innerHTML = ''
    selectedIndex = -1
  }

  function openSuggestions(items) {
    suggestions.innerHTML = items
      .map((it, i) => `<li role="option" data-index="${i}" class="suggestion-item">${escapeHtml(it.label)}</li>`)
      .join('')
    suggestions.hidden = items.length === 0
    selectedIndex = -1
  }

  async function fetchAndShow(q) {
    if (!q) { closeSuggestions(); return }
    try {
      const res = await fetch(`/api/nominatim/search?q=${encodeURIComponent(q)}&format=json&limit=5`)
      if (!res.ok) { closeSuggestions(); return }
      const data = await res.json()
      const items = data.map((d) => ({ label: d.display_name, lat: d.lat, lon: d.lon }))
      openSuggestions(items)
    } catch (e) {
      closeSuggestions()
    }
  }

  const debounced = debounce((e) => fetchAndShow(e.target.value), 300)
  input.addEventListener('input', debounced)

  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.suggestion-item')
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1)
      items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
      items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault()
        items[selectedIndex].click()
      }
    } else if (e.key === 'Escape') {
      closeSuggestions()
    }
  })

  suggestions.addEventListener('click', (e) => {
    const li = e.target.closest('.suggestion-item')
    if (!li) return
    const index = Number(li.dataset.index)
    // get the label and submit search
    const label = li.textContent
    input.value = label
    closeSuggestions()
    loadDashboard({ mode: 'manual', query: label })
  })

  // close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#location-form')) closeSuggestions()
  })
}

renderShell()
bindEvents()
updateClock()
setInterval(updateClock, 30000)
loadDashboard({ mode: 'auto' })
