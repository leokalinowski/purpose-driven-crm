import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SchedulePostRequest {
  content: string;
  platforms: string[];
  schedule_time: string;
  media_url?: string;
  agent_id?: string;
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

    const { content, platforms, schedule_time, media_url, agent_id }: SchedulePostRequest = await req.json();

    if (!content || !platforms || platforms.length === 0 || !schedule_time) {
      throw new Error('Missing required fields: content, platforms, schedule_time');
    }

    const actualAgentId = agent_id || user.id;
    const scheduleDate = new Date(schedule_time);

    if (scheduleDate <= new Date()) {
      throw new Error('Schedule time must be in the future');
    }

    console.log(`Scheduling posts for agent ${actualAgentId}:`, { content, platforms, schedule_time });

    const results = [];
    
    for (const platform of platforms) {
      try {
        // Check if agent has connected account for this platform
        const { data: account, error: accountError } = await supabaseClient
          .from('social_accounts')
          .select('*')
          .eq('agent_id', actualAgentId)
          .eq('platform', platform)
          .single();

        if (accountError || !account) {
          console.error(`No ${platform} account found for agent ${actualAgentId}`);
          results.push({
            platform,
            success: false,
            error: `No ${platform} account connected`,
          });
          continue;
        }

        // In a real implementation, you would call Postiz API here
        // For now, we'll create a mock Postiz post ID
        const mockPostizId = `postiz_${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Save the scheduled post to database
        const { data: post, error: insertError } = await supabaseClient
          .from('social_posts')
          .insert({
            agent_id: actualAgentId,
            platform,
            content,
            media_url,
            schedule_time,
            status: 'scheduled',
            postiz_post_id: mockPostizId,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Database error for ${platform}:`, insertError);
          results.push({
            platform,
            success: false,
            error: 'Failed to save post',
          });
          continue;
        }

        console.log(`Successfully scheduled ${platform} post:`, post.id);
        results.push({
          platform,
          success: true,
          post_id: post.id,
          postiz_id: mockPostizId,
        });

        // Here you would make the actual API call to Postiz
        // Example:
        // const postizResponse = await fetch(`${POSTIZ_API_URL}/posts`, {
        //   method: 'POST',
        //   headers: {
        //     'Authorization': `Bearer ${POSTIZ_API_KEY}`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     content,
        //     media_url,
        //     schedule_time,
        //     platform,
        //     access_token: account.access_token,
        //   }),
        // });

      } catch (platformError) {
        console.error(`Error scheduling ${platform} post:`, platformError);
        results.push({
          platform,
          success: false,
          error: platformError.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Successfully scheduled ${successCount} posts${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        results,
        stats: {
          total: platforms.length,
          success: successCount,
          failed: failureCount,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Schedule post error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: 'Failed to schedule posts'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);