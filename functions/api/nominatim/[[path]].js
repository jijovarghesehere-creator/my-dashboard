const UPSTREAM = 'https://nominatim.openstreetmap.org'

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const upstreamPath = url.pathname.replace(/^\/api\/nominatim/, '') || '/'
  const target = `${UPSTREAM}${upstreamPath}${url.search}`

  // Use a contact email in the From header if provided via environment (recommended
  // by Nominatim usage policy). Set NOMINATIM_CONTACT in Pages environment to a
  // real address for production.
  const contact = (context.env && context.env.NOMINATIM_CONTACT) || 'noreply@example.com'

  const upstream = await fetch(target, {
    headers: {
      'User-Agent': 'my-dashboard/1.0 (Cloudflare Pages; personal weather dashboard)',
      From: contact,
      Accept: context.request.headers.get('Accept') ?? 'application/json',
    },
  })

  // If upstream returned ok, forward the body and headers as-is (with caching).
  if (upstream.ok) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  // For deployments, surface useful upstream error details as JSON so the client
  // can show a clearer message in DevTools/network for debugging.
  const text = await upstream.text().catch(() => '')
  const payload = {
    error: 'Upstream Nominatim request failed',
    upstreamStatus: upstream.status,
    upstreamBody: text,
    target,
  }

  return new Response(JSON.stringify(payload, null, 2), {
    status: 502,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}
