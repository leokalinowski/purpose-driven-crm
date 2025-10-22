import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Validate the URL is a Metricool URL for security
    if (!targetUrl.includes('metricool.com')) {
      return new Response(JSON.stringify({ error: 'Only Metricool URLs are allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch the target URL
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': req.headers.get('User-Agent') || 'Mozilla/5.0 (compatible; MetricoolProxy/1.0)',
        'Accept': req.headers.get('Accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.headers.get('Accept-Language') || 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      // Don't follow redirects automatically to handle them properly
      redirect: 'manual',
    })

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('location')
      if (redirectUrl) {
        // Follow the redirect through our proxy
        const redirectResponse = await fetch(redirectUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MetricoolProxy/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        })

        const newHeaders = new Headers(redirectResponse.headers)
        newHeaders.delete('x-frame-options')
        newHeaders.delete('content-security-policy')
        newHeaders.delete('x-content-type-options')
        newHeaders.set('Access-Control-Allow-Origin', '*')
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        newHeaders.set('Access-Control-Allow-Headers', '*')

        return new Response(redirectResponse.body, {
          status: redirectResponse.status,
          statusText: redirectResponse.statusText,
          headers: newHeaders,
        })
      }
    }

    // Create response with modified headers to allow embedding
    const newHeaders = new Headers(response.headers)

    // Remove restrictive headers
    newHeaders.delete('x-frame-options')
    newHeaders.delete('content-security-policy')
    newHeaders.delete('x-content-type-options')
    newHeaders.delete('strict-transport-security')

    // Add permissive headers
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    newHeaders.set('Access-Control-Allow-Headers', '*')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: `Proxy error: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
