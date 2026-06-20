const UPSTREAM = 'https://nominatim.openstreetmap.org'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const upstreamPath = url.pathname.replace(/^\/api\/nominatim/, '') || '/'
  const target = `${UPSTREAM}${upstreamPath}${url.search}`

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'my-dashboard/1.0 (Cloudflare Pages; personal weather dashboard)',
      Accept: context.request.headers.get('Accept') ?? 'application/json',
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
