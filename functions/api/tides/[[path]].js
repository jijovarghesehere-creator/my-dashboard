const UPSTREAM = 'https://api.open-meteo.com'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const upstreamPath = url.pathname.replace(/^\/api\/tides/, '') || '/'
  const target = `${UPSTREAM}${upstreamPath}${url.search}`

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; my-dashboard/1.0)',
      Accept: context.request.headers.get('Accept') ?? 'application/json, application/xml, */*',
    },
  })

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
