export async function fetchApod(apiKey = 'DEMO_KEY') {
  const url = `https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not fetch NASA Astronomy Picture of the Day.')
  return res.json()
}
