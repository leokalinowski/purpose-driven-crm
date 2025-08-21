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
        let tokenData;
        
        if (platform === 'facebook') {
          // Handle Facebook OAuth callback
          const facebookAppId = Deno.env.get('FACEBOOK_APP_ID');
          const facebookAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');
          const redirectUri = Deno.env.get('REDIRECT_URI');
          
          if (!facebookAppId || !facebookAppSecret || !redirectUri) {
            throw new Error('Facebook OAuth configuration is missing');
          }

          // Exchange code for access token
          const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: facebookAppId,
              client_secret: facebookAppSecret,
              code,
              redirect_uri: redirectUri,
            }),
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Facebook token error:', errorData);
            throw new Error('Failed to get Facebook access token');
          }

          tokenData = await tokenResponse.json();
          console.log('Facebook token data received');

          // Get user profile data
          const profileResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${tokenData.access_token}&fields=id,name,email`);
          const profileData = await profileResponse.json();

          if (!profileResponse.ok) {
            console.error('Facebook profile error:', profileData);
            throw new Error('Failed to get Facebook profile data');
          }

          // Store the account information in the database
          const { error: insertError } = await supabaseClient
            .from('social_accounts')
            .upsert({
              agent_id: actualAgentId,
              platform,
              access_token: tokenData.access_token,
              refresh_token: null,
              expires_at: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
              account_id: profileData.id,
              account_name: profileData.name,
            }, {
              onConflict: 'agent_id,platform'
            });

          if (insertError) {
            console.error('Database error:', insertError);
            throw new Error('Failed to save Facebook account information');
          }
        } else {
          throw new Error(`OAuth callback not implemented for platform: ${platform}`);
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
    // Generate OAuth URL directly with the platform
    try {
      const redirectUri = Deno.env.get('REDIRECT_URI') || '';
      
      if (!redirectUri) {
        throw new Error('Redirect URI is missing');
      }

      let oauthUrl: string;
      
      if (platform === 'facebook') {
        const facebookAppId = Deno.env.get('FACEBOOK_APP_ID');
        
        if (!facebookAppId) {
          throw new Error('Facebook App ID is missing');
        }

        const scopes = 'pages_manage_posts,pages_read_engagement,pages_show_list,business_management';
        const state = `${actualAgentId}_${platform}`;
        
        oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${facebookAppId}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent(scopes)}&` +
          `state=${encodeURIComponent(state)}&` +
          `response_type=code`;
      } else {
        throw new Error(`OAuth URL generation not implemented for platform: ${platform}`);
      }

      return new Response(
        JSON.stringify({
          oauth_url: oauthUrl,
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