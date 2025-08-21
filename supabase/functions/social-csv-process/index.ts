import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const agentId = formData.get('agent_id') as string || user.id;

    if (!file) {
      throw new Error('No file provided');
    }

    const csvText = await file.text();
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Validate required fields
        if (!row.content || !row.platform || !row.schedule_time) {
          errorCount++;
          errors.push(`Row ${i + 1}: Missing required fields`);
          continue;
        }

        // Schedule the post
        const scheduleResponse = await supabaseClient.functions.invoke('social-schedule', {
          body: {
            content: row.content,
            platforms: [row.platform.toLowerCase()],
            schedule_time: row.schedule_time,
            media_url: row.media_file || undefined,
            agent_id: agentId,
          },
        });

        if (scheduleResponse.error) {
          errorCount++;
          errors.push(`Row ${i + 1}: ${scheduleResponse.error.message}`);
        } else {
          successCount++;
        }

      } catch (rowError) {
        errorCount++;
        errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        success_count: successCount,
        error_count: errorCount,
        errors: errors.slice(0, 10), // Limit to first 10 errors
        message: `Processed ${successCount + errorCount} rows: ${successCount} success, ${errorCount} errors`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('CSV processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: 'Failed to process CSV file'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
};

serve(handler);