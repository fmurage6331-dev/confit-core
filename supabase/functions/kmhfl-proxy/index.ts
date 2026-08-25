import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const url = new URL(req.url)
    const mflCode = url.searchParams.get('code')

    if (!mflCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: code' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const kmhflUrl =
      `https://kmhfr.health.go.ke/api/facilities/facilities/?code=${encodeURIComponent(mflCode)}&format=json`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(kmhflUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AegisCareHMS/5.16',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `KMHFL returned ${response.status}` }),
        { status: response.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const isTimeout = String(err).includes('AbortError') || String(err).includes('abort')
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'KMHFL API timed out — server is slow. Try again.' : 'Proxy error',
        detail: String(err)
      }),
      { status: isTimeout ? 504 : 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})