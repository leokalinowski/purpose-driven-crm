import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostingRequest {
  post_id: string;
  platform: string;
  content: string;
  media_url?: string;
  schedule_time: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { post_id, platform, content, media_url, schedule_time }: PostingRequest = await req.json();

    console.log(`🚀 Direct posting to ${platform} for post ${post_id}`);

    // Get the social account for this platform
    const { data: account, error: accountError } = await supabaseClient
      .from('social_accounts')
      .select('*')
      .eq('platform', platform)
      .eq('agent_id', (await supabaseClient.auth.getUser()).data.user?.id)
      .single();

    if (accountError || !account) {
      throw new Error(`No ${platform} account connected`);
    }

    let postResult: any = null;
    let postStatus = 'failed';
    let errorMessage = '';

    try {
      switch (platform) {
        case 'facebook':
          postResult = await postToFacebook(account, content, media_url, schedule_time);
          break;
        case 'instagram':
          postResult = await postToInstagram(account, content, media_url, schedule_time);
          break;
        case 'linkedin':
          postResult = await postToLinkedIn(account, content, media_url, schedule_time);
          break;
        case 'twitter':
          postResult = await postToTwitter(account, content, media_url, schedule_time);
          break;
        case 'tiktok':
          postResult = await postToTikTok(account, content, media_url, schedule_time);
          break;
        default:
          throw new Error(`Platform ${platform} not supported`);
      }

      postStatus = 'posted';
      console.log(`✅ Successfully posted to ${platform}`);

    } catch (platformError) {
      errorMessage = platformError.message;
      console.error(`❌ Failed to post to ${platform}:`, errorMessage);
    }

    // Update the post status
    const updateData: any = {
      status: postStatus,
      updated_at: new Date().toISOString(),
    };

    if (postStatus === 'posted') {
      updateData.posted_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (postResult?.post_id) {
      updateData.platform_post_id = postResult.post_id;
    }

    const { error: updateError } = await supabaseClient
      .from('social_posts')
      .update(updateData)
      .eq('id', post_id);

    if (updateError) {
      console.error('Failed to update post status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: postStatus === 'posted',
        platform,
        post_id,
        error: errorMessage || undefined,
        platform_post_id: postResult?.post_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: postStatus === 'posted' ? 200 : 500,
      }
    );

  } catch (error) {
    console.error('💥 Direct posting error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

// Facebook posting function
async function postToFacebook(account: any, content: string, media_url?: string, schedule_time?: string) {
  const pageAccessToken = account.access_token;
  const pageId = account.account_id;

  // For scheduled posts, we'd need to use different endpoint
  // For now, this posts immediately
  const postData: any = {
    message: content,
    access_token: pageAccessToken,
  };

  if (media_url) {
    // If media URL provided, assume it's an image
    postData.link = media_url; // Facebook can handle links to images
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Facebook API error: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();
  return { post_id: result.id };
}

// Instagram posting function (placeholder - requires Instagram Business API)
async function postToInstagram(account: any, content: string, media_url?: string, schedule_time?: string) {
  // Instagram Business API implementation would go here
  // This is complex and requires Instagram Business account setup
  throw new Error('Instagram direct posting not yet implemented');
}

// LinkedIn posting function (placeholder)
async function postToLinkedIn(account: any, content: string, media_url?: string, schedule_time?: string) {
  // LinkedIn API implementation would go here
  throw new Error('LinkedIn direct posting not yet implemented');
}

// Twitter/X posting function (placeholder)
async function postToTwitter(account: any, content: string, media_url?: string, schedule_time?: string) {
  // Twitter API v2 implementation would go here
  throw new Error('Twitter direct posting not yet implemented');
}

// TikTok posting function (placeholder)
async function postToTikTok(account: any, content: string, media_url?: string, schedule_time?: string) {
  // TikTok API implementation would go here
  throw new Error('TikTok direct posting not yet implemented');
}

console.log('🌟 Social Direct Posting Handler Loaded');
serve(handler);

