import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UnsubscribeRequest {
  email: string;
  agent_id?: string;
  reason?: string;
  token?: string; // For verification
}

// Cryptographically secure token generation using HMAC-SHA256
async function generateUnsubscribeToken(email: string, agentId: string): Promise<string> {
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET must be configured');
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const data = encoder.encode(`${email}:${agentId}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyUnsubscribeToken(email: string, agentId: string, token: string): Promise<boolean> {
  try {
    const expectedToken = await generateUnsubscribeToken(email, agentId);
    // Constant-time comparison to prevent timing attacks
    if (expectedToken.length !== token.length) return false;
    let result = 0;
    for (let i = 0; i < expectedToken.length; i++) {
      result |= expectedToken.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Handle GET request (one-click unsubscribe from email link)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const email = url.searchParams.get('email');
      const agentId = url.searchParams.get('agent_id');
      const token = url.searchParams.get('token');
      const reason = url.searchParams.get('reason') || 'One-click unsubscribe';

      if (!email) {
        return new Response(generateErrorPage('Missing email parameter'), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      // Verify token if provided
      if (token && agentId && !(await verifyUnsubscribeToken(email, agentId, token))) {
        return new Response(generateErrorPage('Invalid unsubscribe link'), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      // Process unsubscribe
      const { error } = await supabase
        .from('newsletter_unsubscribes')
        .upsert({
          email: email.toLowerCase(),
          agent_id: agentId || null,
          reason,
          unsubscribed_at: new Date().toISOString()
        }, {
          onConflict: 'email,agent_id'
        });

      if (error) {
        console.error('Error processing unsubscribe:', error);
        return new Response(generateErrorPage('Failed to process unsubscribe request'), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
      }

      console.log(`Unsubscribed: ${email} from agent: ${agentId || 'all'}`);

      return new Response(generateSuccessPage(email), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Handle POST request (API call)
    if (req.method === 'POST') {
      const { email, agent_id, reason }: UnsubscribeRequest = await req.json();

      if (!email) {
        return new Response(JSON.stringify({ error: 'Email is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase
        .from('newsletter_unsubscribes')
        .upsert({
          email: email.toLowerCase(),
          agent_id: agent_id || null,
          reason: reason || 'User requested unsubscribe',
          unsubscribed_at: new Date().toISOString()
        }, {
          onConflict: 'email,agent_id'
        });

      if (error) {
        console.error('Error processing unsubscribe:', error);
        return new Response(JSON.stringify({ error: 'Failed to unsubscribe' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Unsubscribed via API: ${email} from agent: ${agent_id || 'all'}`);

      return new Response(JSON.stringify({ success: true, message: 'Successfully unsubscribed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in newsletter-unsubscribe:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateSuccessPage(email: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed Successfully</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
    .email {
      color: #764ba2;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>Unsubscribed Successfully</h1>
    <p>You've been unsubscribed from our market update newsletters.</p>
    <p>Email: <span class="email">${email}</span></p>
    <p>You won't receive any more newsletters from us. If you change your mind, contact your real estate agent directly.</p>
  </div>
</body>
</html>
  `;
}

function generateErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>Something Went Wrong</h1>
    <p>${message}</p>
    <p>Please contact your real estate agent directly to unsubscribe from their mailing list.</p>
  </div>
</body>
</html>
  `;
}

// Export for use in newsletter-send
export { generateUnsubscribeToken };
