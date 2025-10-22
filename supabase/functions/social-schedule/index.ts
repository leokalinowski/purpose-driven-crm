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

        // Call Postiz API to schedule the post
        const postizBaseUrl = Deno.env.get('POSTIZ_BASE_URL');
        const postizApiKey = Deno.env.get('POSTIZ_API_KEY');
        
        if (!postizBaseUrl || !postizApiKey) {
          console.error('Postiz configuration missing');
          results.push({
            platform,
            success: false,
            error: 'Postiz configuration missing',
          });
          continue;
        }

        try {
          // Retry logic for Postiz API calls
          const maxRetries = 3;
          let lastError: Error | null = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // Prepare post data for Postiz
              const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/social-webhook`;

              const postData = {
                content,
                datetime: schedule_time,
                platforms: [platform],
                ...(media_url && { media: [{ url: media_url }] }),
                webhook_url: webhookUrl, // Add webhook URL for status updates
              };

              console.log(`Attempting Postiz API call for ${platform} (attempt ${attempt}/${maxRetries})`);

              // Call Postiz Public API with timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

              const postizResponse = await fetch(`${postizBaseUrl}/api/posts`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${postizApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!postizResponse.ok) {
                const errorData = await postizResponse.text();
                console.error(`Postiz API error for ${platform} (attempt ${attempt}):`, errorData);

                // Check if it's a retryable error
                const isRetryable = postizResponse.status >= 500 || postizResponse.status === 429;

                if (!isRetryable || attempt === maxRetries) {
                  throw new Error(`Postiz API error (${postizResponse.status}): ${errorData}`);
                }

                // Wait before retry (exponential backoff)
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`Retrying ${platform} post in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
              }

              const postizResult = await postizResponse.json();
              const postizId = postizResult.id || `postiz_${Date.now()}_${platform}`;

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
                  postiz_post_id: postizId,
                })
                .select()
                .single();

              if (insertError) {
                console.error(`Database error for ${platform}:`, insertError);
                throw new Error(`Failed to save post: ${insertError.message}`);
              }

              console.log(`✅ Successfully scheduled ${platform} post via Postiz:`, post.id);
              results.push({
                platform,
                success: true,
                post_id: post.id,
                postiz_id: postizId,
              });
              break; // Success, exit retry loop

            } catch (attemptError) {
              lastError = attemptError as Error;
              console.error(`Attempt ${attempt} failed for ${platform}:`, attemptError);

              if (attempt === maxRetries) {
                throw lastError;
              }

              // Wait before next attempt
              const waitTime = Math.pow(2, attempt) * 1000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }

        } catch (postizError) {
          console.error(`❌ All Postiz attempts failed for ${platform}:`, postizError);

          // Categorize the error
          let errorMessage = postizError.message;
          let fallbackStatus = 'failed';

          if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
            errorMessage = 'Postiz API timeout - will retry later';
            fallbackStatus = 'pending';
          } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
            errorMessage = 'Postiz authentication failed - check API key';
          } else if (errorMessage.includes('429')) {
            errorMessage = 'Postiz rate limit exceeded - will retry later';
            fallbackStatus = 'pending';
          }

          // Fallback: save to database without Postiz
          const { data: post, error: insertError } = await supabaseClient
            .from('social_posts')
            .insert({
              agent_id: actualAgentId,
              platform,
              content,
              media_url,
              schedule_time,
              status: fallbackStatus,
              error_message: errorMessage,
            })
            .select()
            .single();

          // Try direct posting as fallback for supported platforms
          if (platform === 'facebook' && post?.id) {
            try {
              console.log(`🔄 Attempting direct posting to ${platform} as fallback`);

              const directPostResult = await supabaseClient.functions.invoke('social-posting', {
                body: {
                  post_id: post.id,
                  platform,
                  content,
                  media_url,
                  schedule_time,
                },
              });

              if (directPostResult.data?.success) {
                console.log(`✅ Direct posting succeeded for ${platform}`);
                results.push({
                  platform,
                  success: true,
                  post_id: post.id,
                  method: 'direct',
                  error: undefined,
                });
                continue; // Skip to next platform
              }
            } catch (directPostError) {
              console.error(`❌ Direct posting also failed for ${platform}:`, directPostError);
            }
          }

          results.push({
            platform,
            success: false,
            error: errorMessage,
            post_id: post?.id,
            retryable: fallbackStatus === 'pending',
          });
        }

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