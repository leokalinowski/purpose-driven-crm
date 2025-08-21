import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthRequest {
  platform: string;
  agent_id?: string;
  code?: string;
  state?: string;
}

interface PostizAccount {
  id: string;
  name: string;
  username: string;
  picture: string;
  type: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { platform, agent_id, code, state }: OAuthRequest = await req.json();

    if (!platform) {
      throw new Error('Platform is required');
    }

    const actualAgentId = agent_id || user.id;

    // If code is provided, this is a callback from OAuth
    if (code) {
      console.log(`Processing OAuth callback for ${platform}`);
      
      try {
        // Use Postiz API to exchange the code for account information
        const postizBaseUrl = Deno.env.get('POSTIZ_BASE_URL') || '';
        const postizApiKey = Deno.env.get('POSTIZ_API_KEY') || '';
        
        if (!postizBaseUrl || !postizApiKey) {
          throw new Error('Postiz configuration is missing');
        }

        // Call Postiz API to exchange authorization code for account access
        const tokenResponse = await fetch(`${postizBaseUrl}/oauth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${postizApiKey}`,
          },
          body: JSON.stringify({
            platform,
            code,
            state,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error('Postiz OAuth error:', errorData);
          throw new Error('Failed to authenticate with social platform');
        }

        const accountData = await tokenResponse.json();
        console.log('Postiz account data:', accountData);

        // Store the account information in the database
        const { error: insertError } = await supabaseClient
          .from('social_accounts')
          .upsert({
            agent_id: actualAgentId,
            platform,
            access_token: accountData.access_token,
            refresh_token: accountData.refresh_token || null,
            expires_at: accountData.expires_at ? new Date(accountData.expires_at).toISOString() : null,
            account_id: accountData.account_id || accountData.id,
            account_name: accountData.account_name || accountData.name || accountData.username,
          }, {
            onConflict: 'agent_id,platform'
          });

        if (insertError) {
          console.error('Database error:', insertError);
          throw new Error('Failed to save account information');
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `${platform} account connected successfully`,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );

      } catch (error) {
        console.error('OAuth callback error:', error);
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'OAuth callback failed',
            message: 'Failed to connect account'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }
    }

    // If no code, this is an initial OAuth request
    // Get OAuth URL from Postiz
    try {
      const postizBaseUrl = Deno.env.get('POSTIZ_BASE_URL') || '';
      const postizApiKey = Deno.env.get('POSTIZ_API_KEY') || '';
      const redirectUri = Deno.env.get('REDIRECT_URI') || '';
      
      if (!postizBaseUrl || !postizApiKey || !redirectUri) {
        throw new Error('Postiz configuration is missing');
      }

      // Call Postiz API to get the OAuth URL
      const oauthResponse = await fetch(`${postizBaseUrl}/oauth/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${postizApiKey}`,
        },
        body: JSON.stringify({
          platform,
          state: `${actualAgentId}_${platform}`,
          redirect_uri: redirectUri,
        }),
      });

      if (!oauthResponse.ok) {
        const errorData = await oauthResponse.text();
        console.error('Postiz OAuth URL error:', errorData);
        throw new Error('Failed to get OAuth URL from Postiz');
      }

      const oauthData = await oauthResponse.json();
      
      if (!oauthData.oauth_url) {
        throw new Error('No OAuth URL returned from Postiz');
      }

      return new Response(
        JSON.stringify({
          oauth_url: oauthData.oauth_url,
          message: `Redirect to ${platform} OAuth`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (error) {
      console.error('OAuth URL generation error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to generate OAuth URL',
          message: 'OAuth initialization failed'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: 'OAuth process failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);