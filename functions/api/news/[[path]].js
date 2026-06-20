const UPSTREAM = 'https://news.google.com'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const upstreamPath = url.pathname.replace(/^\/api\/news/, '') || '/'
  const target = `${UPSTREAM}${upstreamPath}${url.search}`

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; my-dashboard/1.0)',
      Accept: context.request.headers.get('Accept') ?? 'application/rss+xml, application/xml, text/xml, */*',
    },
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/xml',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
