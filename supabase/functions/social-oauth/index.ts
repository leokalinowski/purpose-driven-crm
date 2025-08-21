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
      
      // Here you would normally exchange the code for an access token
      // This is a simplified implementation
      const mockTokenResponse = {
        access_token: `mock_access_token_${platform}_${Date.now()}`,
        refresh_token: `mock_refresh_token_${platform}_${Date.now()}`,
        expires_in: 3600,
        account_id: `account_${platform}_${Date.now()}`,
        account_name: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`,
      };

      // Store the tokens in the database
      const { error: insertError } = await supabaseClient
        .from('social_accounts')
        .upsert({
          agent_id: actualAgentId,
          platform,
          access_token: mockTokenResponse.access_token,
          refresh_token: mockTokenResponse.refresh_token,
          expires_at: new Date(Date.now() + mockTokenResponse.expires_in * 1000).toISOString(),
          account_id: mockTokenResponse.account_id,
          account_name: mockTokenResponse.account_name,
        }, {
          onConflict: 'agent_id,platform'
        });

      if (insertError) {
        console.error('Database error:', insertError);
        throw new Error('Failed to save account');
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
    }

    // If no code, this is an initial OAuth request
    // Return the OAuth URL for the platform
    const platformUrls = {
      facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=YOUR_FB_CLIENT_ID&redirect_uri=${encodeURIComponent('YOUR_REDIRECT_URI')}&scope=pages_manage_posts,pages_read_engagement&state=${actualAgentId}_facebook`,
      instagram: `https://api.instagram.com/oauth/authorize?client_id=YOUR_IG_CLIENT_ID&redirect_uri=${encodeURIComponent('YOUR_REDIRECT_URI')}&scope=user_profile,user_media&response_type=code&state=${actualAgentId}_instagram`,
      linkedin: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_LI_CLIENT_ID&redirect_uri=${encodeURIComponent('YOUR_REDIRECT_URI')}&scope=w_member_social&state=${actualAgentId}_linkedin`,
      twitter: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=YOUR_TW_CLIENT_ID&redirect_uri=${encodeURIComponent('YOUR_REDIRECT_URI')}&scope=tweet.read%20tweet.write%20users.read&state=${actualAgentId}_twitter`,
      tiktok: `https://www.tiktok.com/auth/authorize/?client_key=YOUR_TT_CLIENT_KEY&response_type=code&scope=user.info.basic,video.list&redirect_uri=${encodeURIComponent('YOUR_REDIRECT_URI')}&state=${actualAgentId}_tiktok`,
    };

    const oauthUrl = platformUrls[platform as keyof typeof platformUrls];
    
    if (!oauthUrl) {
      throw new Error(`Unsupported platform: ${platform}`);
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