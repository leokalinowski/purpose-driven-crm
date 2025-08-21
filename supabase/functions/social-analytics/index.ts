import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  agent_id?: string;
  platform?: string;
  start_date?: string;
  end_date?: string;
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

    const { agent_id, platform, start_date, end_date }: AnalyticsRequest = await req.json();
    const actualAgentId = agent_id || user.id;

    console.log(`Fetching analytics for agent ${actualAgentId}`);

    // Get all connected accounts for the agent
    let accountsQuery = supabaseClient
      .from('social_accounts')
      .select('*')
      .eq('agent_id', actualAgentId);

    if (platform) {
      accountsQuery = accountsQuery.eq('platform', platform);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError) {
      throw new Error('Failed to fetch social accounts');
    }

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No social accounts found',
          analytics: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const analyticsData = [];
    const today = new Date().toISOString().split('T')[0];

    for (const account of accounts) {
      try {
        console.log(`Fetching analytics for ${account.platform} account ${account.account_id}`);

        // In a real implementation, you would call the actual platform APIs
        // For now, we'll generate mock analytics data
        const mockAnalytics = generateMockAnalytics(account.platform, actualAgentId, start_date, end_date);

        // Store/update analytics in database
        for (const analytics of mockAnalytics) {
          const { error: upsertError } = await supabaseClient
            .from('social_analytics')
            .upsert({
              agent_id: actualAgentId,
              platform: account.platform,
              metric_date: analytics.metric_date,
              reach: analytics.reach,
              impressions: analytics.impressions,
              followers: analytics.followers,
              likes: analytics.likes,
              comments: analytics.comments,
              shares: analytics.shares,
              engagement_rate: analytics.engagement_rate,
              clicks: analytics.clicks,
            }, {
              onConflict: 'agent_id,platform,metric_date',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`Error upserting analytics for ${account.platform}:`, upsertError);
          }
        }

        analyticsData.push(...mockAnalytics);

        // Here you would make actual API calls to fetch real analytics
        // Example for different platforms:
        
        // Facebook/Instagram:
        // const fbResponse = await fetch(`https://graph.facebook.com/v18.0/${account.account_id}/insights`, {
        //   headers: { 'Authorization': `Bearer ${account.access_token}` }
        // });
        
        // LinkedIn:
        // const liResponse = await fetch('https://api.linkedin.com/v2/organizationalEntityFollowerStatistics', {
        //   headers: { 'Authorization': `Bearer ${account.access_token}` }
        // });
        
        // Twitter/X:
        // const twitterResponse = await fetch('https://api.twitter.com/2/users/me/tweets', {
        //   headers: { 'Authorization': `Bearer ${account.access_token}` }
        // });

      } catch (platformError) {
        console.error(`Error fetching ${account.platform} analytics:`, platformError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Analytics updated for ${accounts.length} platforms`,
        analytics: analyticsData,
        updated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Analytics fetch error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: 'Failed to fetch analytics'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

function generateMockAnalytics(platform: string, agentId: string, startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const analytics = [];
  const platformMultipliers = {
    facebook: { followers: 1000, engagement: 50, reach: 500 },
    instagram: { followers: 800, engagement: 80, reach: 400 },
    linkedin: { followers: 500, engagement: 30, reach: 200 },
    twitter: { followers: 1200, engagement: 40, reach: 600 },
    tiktok: { followers: 600, engagement: 100, reach: 300 },
  };

  const multiplier = platformMultipliers[platform as keyof typeof platformMultipliers] || { followers: 500, engagement: 25, reach: 250 };

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const variance = 0.8 + Math.random() * 0.4; // 80% to 120% variance
    
    const daysSinceStart = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const growth = Math.max(0, daysSinceStart * 2); // Slight growth over time
    
    const followers = Math.floor((multiplier.followers + growth) * variance);
    const likes = Math.floor(multiplier.engagement * variance * Math.random());
    const comments = Math.floor(likes * 0.1 * variance);
    const shares = Math.floor(likes * 0.05 * variance);
    const reach = Math.floor(multiplier.reach * variance);
    const impressions = Math.floor(reach * 1.5);
    const clicks = Math.floor(impressions * 0.02);
    
    analytics.push({
      metric_date: dateStr,
      reach,
      impressions,
      followers,
      likes,
      comments,
      shares,
      engagement_rate: followers > 0 ? ((likes + comments + shares) / followers * 100).toFixed(2) : 0,
      clicks,
    });
  }

  return analytics;
}

serve(handler);