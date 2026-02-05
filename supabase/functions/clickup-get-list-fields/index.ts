import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const clickupApiToken = Deno.env.get('CLICKUP_API_TOKEN');
    const listId = Deno.env.get('CLICKUP_SUPPORT_LIST_ID') || '901113093436';
    
    if (!clickupApiToken) {
      return new Response(
        JSON.stringify({ error: 'CLICKUP_API_TOKEN not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'Authorization': clickupApiToken,
      'Content-Type': 'application/json',
    };

    // Get list details
    console.log(`Fetching list details for ${listId}...`);
    const listResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      headers,
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Failed to fetch list:', listResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch list', details: errorText }),
        { status: listResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listData = await listResponse.json();

    // Get custom fields for this list
    console.log(`Fetching custom fields for list ${listId}...`);
    const fieldsResponse = await fetch(`https://api.clickup.com/api/v2/list/${listId}/field`, {
      headers,
    });

    let customFields = [];
    if (fieldsResponse.ok) {
      const fieldsData = await fieldsResponse.json();
      customFields = fieldsData.fields || [];
    }

    // Get available statuses
    const statuses = listData.statuses || [];

    console.log('List details:', JSON.stringify(listData, null, 2));
    console.log('Custom fields:', JSON.stringify(customFields, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        list: {
          id: listData.id,
          name: listData.name,
          space: listData.space,
          folder: listData.folder,
        },
        statuses: statuses.map((s: any) => ({
          id: s.id,
          status: s.status,
          color: s.color,
          type: s.type,
        })),
        custom_fields: customFields.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          type_config: f.type_config,
          required: f.required,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching list fields:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
