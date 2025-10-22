import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Postiz webhook payload structure
interface PostizWebhookPayload {
  id: string; // Postiz post ID
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  platform: string;
  published_at?: string;
  error_message?: string;
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    impressions?: number;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎣 Social Webhook received');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse webhook payload
    const payload: PostizWebhookPayload = await req.json();
    console.log('📦 Webhook payload:', payload);

    // Find the corresponding social post by Postiz ID
    const { data: socialPost, error: findError } = await supabaseClient
      .from('social_posts')
      .select('*')
      .eq('postiz_post_id', payload.id)
      .single();

    if (findError || !socialPost) {
      console.error('❌ Social post not found for Postiz ID:', payload.id);
      return new Response(
        JSON.stringify({ error: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Found social post:', socialPost.id);

    // Update post status
    const updateData: any = {
      status: payload.status === 'published' ? 'posted' : payload.status,
      updated_at: new Date().toISOString(),
    };

    if (payload.published_at) {
      updateData.posted_at = payload.published_at;
    }

    if (payload.error_message) {
      updateData.error_message = payload.error_message;
    }

    const { error: updateError } = await supabaseClient
      .from('social_posts')
      .update(updateData)
      .eq('id', socialPost.id);

    if (updateError) {
      console.error('❌ Failed to update post status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update post status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If post was published and we have metrics, update analytics
    if (payload.status === 'published' && payload.metrics) {
      const analyticsData = {
        post_id: socialPost.id,
        agent_id: socialPost.agent_id,
        platform: payload.platform || socialPost.platform,
        metric_date: new Date().toISOString().split('T')[0],
        reach: payload.metrics.reach || 0,
        impressions: payload.metrics.impressions || 0,
        likes: payload.metrics.likes || 0,
        comments: payload.metrics.comments || 0,
        shares: payload.metrics.shares || 0,
        engagement_rate: 0, // Calculate this later
        clicks: 0,
      };

      // Calculate engagement rate
      const totalEngagement = (analyticsData.likes + analyticsData.comments + analyticsData.shares);
      analyticsData.engagement_rate = analyticsData.reach > 0 ? (totalEngagement / analyticsData.reach) * 100 : 0;

      const { error: analyticsError } = await supabaseClient
        .from('social_analytics')
        .upsert(analyticsData, {
          onConflict: 'post_id,platform,metric_date'
        });

      if (analyticsError) {
        console.error('❌ Failed to update analytics:', analyticsError);
        // Don't fail the webhook for analytics errors
      } else {
        console.log('✅ Analytics updated for post:', socialPost.id);
      }
    }

    console.log('🎉 Successfully processed webhook for post:', socialPost.id);
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        post_id: socialPost.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('💥 Webhook processing error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown webhook error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

console.log('🌟 Social Webhook Handler Loaded');
serve(handler);

