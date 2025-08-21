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

// Get secrets from Supabase vault using service role
const getSecretFromVault = async (secretName: string, supabaseServiceClient: any): Promise<string> => {
  try {
    const { data, error } = await supabaseServiceClient
      .from('vault')
      .select('decrypted_secret')
      .eq('name', secretName)
      .single();
    
    if (error) {
      console.error(`❌ Failed to retrieve secret ${secretName}:`, error);
      return '';
    }
    
    console.log(`✅ Retrieved secret ${secretName} from vault`);
    return data?.decrypted_secret || '';
  } catch (error) {
    console.error(`❌ Error accessing vault for ${secretName}:`, error);
    return '';
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Social OAuth Handler Started');
    
    // Get basic environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Critical validation with detailed error messages
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ CRITICAL: Supabase credentials missing');
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error: Supabase credentials missing',
          details: { 
            supabaseUrl: !!supabaseUrl, 
            supabaseAnonKey: !!supabaseAnonKey,
            message: 'Edge function cannot access Supabase environment variables'
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseServiceClient = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
    console.log('✅ Supabase client created successfully');

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Retrieve Facebook credentials from vault or environment
    console.log('🔍 Retrieving Facebook credentials...');
    let facebookAppId = Deno.env.get('FACEBOOK_APP_ID') || '';
    let facebookAppSecret = Deno.env.get('FACEBOOK_APP_SECRET') || '';
    let redirectUri = Deno.env.get('REDIRECT_URI') || '';
    
    // Try to get missing credentials from vault if service client is available
    if (supabaseServiceClient) {
      if (!facebookAppId) {
        console.log('🔍 Retrieving FACEBOOK_APP_ID from vault...');
        facebookAppId = await getSecretFromVault('FACEBOOK_APP_ID', supabaseServiceClient);
      }
      if (!facebookAppSecret) {
        console.log('🔍 Retrieving FACEBOOK_APP_SECRET from vault...');
        facebookAppSecret = await getSecretFromVault('FACEBOOK_APP_SECRET', supabaseServiceClient);
      }
      if (!redirectUri) {
        console.log('🔍 Retrieving REDIRECT_URI from vault...');
        redirectUri = await getSecretFromVault('REDIRECT_URI', supabaseServiceClient);
      }
    }

    console.log('📋 Credentials status:', {
      facebookAppId: !!facebookAppId,
      facebookAppSecret: !!facebookAppSecret,
      redirectUri: !!redirectUri,
      serviceClientAvailable: !!supabaseServiceClient
    });

    const { platform, agent_id, code, state }: OAuthRequest = await req.json();
    const actualAgentId = agent_id || user.id;
    
    console.log('📋 Request details:', { 
      platform, 
      hasAgentId: !!agent_id, 
      hasCode: !!code, 
      hasState: !!state,
      userId: user.id,
      actualAgentId
    });

    if (!platform) {
      console.error('❌ Platform parameter missing');
      return new Response(
        JSON.stringify({ error: 'Platform is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OAuth Callback Handler
    if (code) {
      console.log(`🔄 Processing OAuth callback for ${platform}`);
      
      if (platform !== 'facebook') {
        console.error('❌ Unsupported platform for callback:', platform);
        return new Response(
          JSON.stringify({ error: `OAuth callback not supported for platform: ${platform}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate Facebook credentials again for callback
      if (!facebookAppId || !facebookAppSecret || !redirectUri) {
        const missing = [];
        if (!facebookAppId) missing.push('FACEBOOK_APP_ID');
        if (!facebookAppSecret) missing.push('FACEBOOK_APP_SECRET');
        if (!redirectUri) missing.push('REDIRECT_URI');
        
        console.error('❌ Missing Facebook credentials for callback:', missing);
        return new Response(
          JSON.stringify({ 
            error: 'Facebook OAuth configuration incomplete',
            missing_credentials: missing,
            message: 'Required Facebook OAuth environment variables are not set in Supabase secrets'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        console.log('📞 Exchanging Facebook code for token...');
        
        // Exchange code for access token
        const tokenResponse = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: facebookAppId,
            client_secret: facebookAppSecret,
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error('❌ Facebook token exchange failed:', {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            errorData
          });
          return new Response(
            JSON.stringify({ 
              error: 'Facebook token exchange failed',
              details: errorData
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenData = await tokenResponse.json();
        console.log('✅ Facebook token received');

        // Get user profile
        const profileResponse = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${tokenData.access_token}&fields=id,name,email`
        );
        
        if (!profileResponse.ok) {
          console.error('❌ Facebook profile fetch failed');
          return new Response(
            JSON.stringify({ error: 'Failed to fetch Facebook profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const profileData = await profileResponse.json();
        console.log('✅ Facebook profile retrieved:', { id: profileData.id, name: profileData.name });

        // Save to database
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
          console.error('❌ Database save failed:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save account', details: insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('🎉 Facebook account connected successfully');
        return new Response(
          JSON.stringify({ success: true, message: 'Facebook account connected successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        return new Response(
          JSON.stringify({ 
            error: error instanceof Error ? error.message : 'OAuth callback failed'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // OAuth URL Generation
    console.log('🔗 Generating OAuth URL for platform:', platform);
    
    if (platform !== 'facebook') {
      console.error('❌ Unsupported platform for URL generation:', platform);
      return new Response(
        JSON.stringify({ error: `OAuth URL generation not supported for platform: ${platform}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Final check for Facebook credentials
    if (!facebookAppId || !redirectUri) {
      const missing = [];
      if (!facebookAppId) missing.push('FACEBOOK_APP_ID');
      if (!redirectUri) missing.push('REDIRECT_URI');
      
      console.error('❌ Missing Facebook credentials for URL generation:', missing);
      return new Response(
        JSON.stringify({ 
          error: 'Facebook OAuth configuration incomplete',
          missing_credentials: missing,
          message: 'FACEBOOK_APP_ID and REDIRECT_URI must be set in Supabase secrets',
          troubleshooting: {
            step1: 'Check Supabase Dashboard > Settings > Edge Functions > Environment Variables',
            step2: 'Ensure FACEBOOK_APP_ID and REDIRECT_URI are properly set',
            step3: 'Redeploy the edge function after setting the variables'
          }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate Facebook OAuth URL
    const scopes = 'pages_manage_posts,pages_read_engagement,pages_show_list,business_management';
    const oauthState = `${actualAgentId}_${platform}`;
    
    const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(facebookAppId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `state=${encodeURIComponent(oauthState)}&` +
      `response_type=code`;

    console.log('✅ Facebook OAuth URL generated successfully');
    console.log('🔗 OAuth URL (first 50 chars):', oauthUrl.substring(0, 50) + '...');

    return new Response(
      JSON.stringify({
        oauth_url: oauthUrl,
        message: `Redirect to ${platform} OAuth`,
        state: oauthState
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Fatal OAuth error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown OAuth error',
        message: 'OAuth process failed completely'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

console.log('🌟 Social OAuth Edge Function Loaded - Enhanced Debugging Version');
serve(handler);