export async function fetchLocalNews(searchQuery) {
  const rssPath = `/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-US&gl=US&ceid=US:en`
  const response = await fetch(`/api/news${rssPath}`)
  if (!response.ok) throw new Error('Could not load local news.')

  const xml = await response.text()
  const doc = new DOMParser().parseFromString(xml, 'text/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('News feed could not be parsed.')
  }

  return [...doc.querySelectorAll('item')]
    .slice(0, 12)
    .map((item) => ({
      title: item.querySelector('title')?.textContent?.trim() ?? 'Untitled',
      link: item.querySelector('link')?.textContent?.trim() ?? '#',
      pubDate: item.querySelector('pubDate')?.textContent?.trim() ?? '',
      source: item.querySelector('source')?.textContent?.trim() ?? '',
    }))
}

export function formatNewsDate(pubDate) {
  if (!pubDate) return ''
  const date = new Date(pubDate)
  if (Number.isNaN(date.getTime())) return pubDate

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
