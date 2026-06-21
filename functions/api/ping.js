export async function onRequest(context) {
  const headers = {}
  for (const [k, v] of context.request.headers) headers[k] = v

  const payload = {
    ok: true,
    url: context.request.url,
    timestamp: new Date().toISOString(),
    headers,
  }

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
