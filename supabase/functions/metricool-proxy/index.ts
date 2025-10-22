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

    // Forward cookies and more headers for authentication
    const forwardedHeaders = new Headers();

    // Copy important headers from the original request
    const headersToForward = [
      'cookie',
      'authorization',
      'user-agent',
      'accept',
      'accept-language',
      'accept-encoding',
      'cache-control',
      'pragma',
      'referer',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
      'sec-fetch-user',
      'upgrade-insecure-requests',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform'
    ];

    headersToForward.forEach(headerName => {
      const headerValue = req.headers.get(headerName);
      if (headerValue) {
        forwardedHeaders.set(headerName, headerValue);
      }
    });

    // Set default User-Agent if not provided
    if (!forwardedHeaders.has('user-agent')) {
      forwardedHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    // Fetch the target URL with forwarded headers
    const response = await fetch(targetUrl, {
      headers: forwardedHeaders,
      // Don't follow redirects automatically to handle them properly
      redirect: 'manual',
    })

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('location')
      if (redirectUrl) {
        // Follow the redirect through our proxy with forwarded headers
        const redirectResponse = await fetch(redirectUrl, {
          headers: forwardedHeaders,
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

    // Remove ALL restrictive headers that prevent embedding
    newHeaders.delete('x-frame-options')
    newHeaders.delete('content-security-policy')
    newHeaders.delete('x-content-security-policy')
    newHeaders.delete('x-webkit-csp')
    newHeaders.delete('x-content-type-options')
    newHeaders.delete('strict-transport-security')
    newHeaders.delete('x-xss-protection')
    newHeaders.delete('referrer-policy')

    // Add permissive headers for embedding
    newHeaders.set('Access-Control-Allow-Origin', '*')
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
    newHeaders.set('Access-Control-Allow-Headers', '*')
    newHeaders.set('Access-Control-Allow-Credentials', 'true')

    // Override referrer policy to allow embedding
    newHeaders.set('Referrer-Policy', 'no-referrer-when-downgrade')

    // Ensure cookies are forwarded properly
    if (response.headers.has('set-cookie')) {
      // Keep set-cookie headers for authentication
      newHeaders.set('Set-Cookie', response.headers.get('set-cookie')!)
    }

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
