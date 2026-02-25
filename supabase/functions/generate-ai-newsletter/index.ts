import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Unauthorized');

    // Verify admin role
    const { data: roleData } = await supabase.rpc('get_current_user_role');
    // Use service role to check directly
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!userRole) throw new Error('Admin access required');

    const { agent_id, topic_hint, include_listings } = await req.json();
    if (!agent_id) throw new Error('agent_id is required');

    // 1. Fetch agent profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name, email, phone_number, brokerage, office_address, website, license_number')
      .eq('user_id', agent_id)
      .maybeSingle();

    const agentName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Agent';

    // 2. Fetch marketing settings
    const { data: marketing } = await supabase
      .from('agent_marketing_settings')
      .select('brand_guidelines, tone_guidelines, gpt_prompt, target_audience, what_not_to_say, example_copy, primary_color, secondary_color, headshot_url, logo_colored_url')
      .eq('user_id', agent_id)
      .maybeSingle();

    // 3. Fetch contact count
    const { count: contactCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agent_id)
      .not('email', 'is', null)
      .neq('email', '');

    // 4. Build system prompt
    const primaryColor = marketing?.primary_color || '#2563eb';
    const secondaryColor = marketing?.secondary_color || '#1e40af';

    const systemPrompt = `You are a professional real estate newsletter copywriter. Generate engaging email newsletter content for ${agentName}${profile?.brokerage ? ` at ${profile.brokerage}` : ''}.

${marketing?.gpt_prompt ? `CREATIVE DIRECTION: ${marketing.gpt_prompt}` : ''}
${marketing?.brand_guidelines ? `BRAND GUIDELINES: ${marketing.brand_guidelines}` : ''}
${marketing?.tone_guidelines ? `TONE: ${marketing.tone_guidelines}` : 'TONE: Professional, warm, and knowledgeable'}
${marketing?.target_audience ? `TARGET AUDIENCE: ${marketing.target_audience}` : 'TARGET AUDIENCE: Homeowners and potential buyers/sellers in the local market'}
${marketing?.what_not_to_say ? `DO NOT SAY OR INCLUDE: ${marketing.what_not_to_say}` : ''}
${marketing?.example_copy ? `STYLE REFERENCE (match this voice): ${marketing.example_copy}` : ''}
${topic_hint ? `TOPIC/THEME FOR THIS NEWSLETTER: ${topic_hint}` : 'Create a timely market update newsletter with useful tips for homeowners.'}

AGENT DETAILS:
- Name: ${agentName}
- Email: ${profile?.email || 'N/A'}
- Phone: ${profile?.phone_number || 'N/A'}
- Brokerage: ${profile?.brokerage || 'N/A'}
- Website: ${profile?.website || 'N/A'}
- Database size: ${contactCount || 0} contacts with email

Use primary brand color ${primaryColor} for buttons and accent elements.
Use secondary brand color ${secondaryColor} for secondary elements.

Generate a complete newsletter with:
1. An engaging headline
2. A brief intro paragraph
3. 2-3 content sections with market insights, tips, or local updates
4. A clear call-to-action button
5. A divider before the agent bio section

The newsletter should feel personal and valuable, not salesy. Focus on providing genuine value to the reader.`;

    // 5. Call Lovable AI Gateway with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the newsletter now. Return the complete blocks_json array and a compelling subject line.' },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'create_newsletter',
            description: 'Create a complete newsletter with blocks and subject line',
            parameters: {
              type: 'object',
              properties: {
                subject: {
                  type: 'string',
                  description: 'The email subject line, compelling and under 60 characters',
                },
                blocks: {
                  type: 'array',
                  description: 'Array of newsletter blocks',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['heading', 'text', 'button', 'divider', 'spacer', 'agent_bio', 'social_icons'],
                      },
                      props: {
                        type: 'object',
                        description: 'Block properties. For heading: {text, level (1-4), align, color}. For text: {html (HTML string with <p> tags), align, color, fontSize}. For button: {text, url, backgroundColor, textColor, align, borderRadius, fullWidth}. For divider: {color, thickness, style, width}. For spacer: {height}. For agent_bio: {layout, showHeadshot, showLogo, showPhone, showEmail, showLicense, showBrokerage, showOfficeAddress, showOfficePhone, showWebsite, showEqualHousing}. For social_icons: {align, iconSize, links}.',
                      },
                    },
                    required: ['type', 'props'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['subject', 'blocks'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'create_newsletter' } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI Gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error('AI did not return structured output');
    }

    const generated = JSON.parse(toolCall.function.arguments);
    const subject = generated.subject || 'Monthly Newsletter';

    // Add unique IDs to each block
    const blocksWithIds = (generated.blocks || []).map((block: any, i: number) => ({
      ...block,
      id: crypto.randomUUID(),
      props: {
        ...block.props,
        // Apply brand color defaults for headings and buttons
        ...(block.type === 'heading' && !block.props.color ? { color: primaryColor } : {}),
        ...(block.type === 'button' && !block.props.backgroundColor ? { backgroundColor: primaryColor } : {}),
      },
    }));

    // 6. Save as newsletter template
    const globalStyles = {
      backgroundColor: '#f4f4f5',
      contentWidth: 600,
      fontFamily: 'Georgia, serif',
      bodyColor: '#1a1a1a',
    };

    const { data: template, error: insertError } = await supabase
      .from('newsletter_templates')
      .insert({
        agent_id,
        name: `AI Draft: ${subject}`,
        blocks_json: blocksWithIds,
        global_styles: globalStyles,
        is_active: false,
        ai_generated: true,
        review_status: 'pending_review',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // 7. Create action item for admin review
    await supabase.from('agent_action_items').insert({
      agent_id: user.id,
      item_type: 'newsletter_review',
      title: `Review AI Newsletter for ${agentName}`,
      description: `An AI-generated newsletter draft "${subject}" is ready for review and editing before sending.`,
      action_url: `/newsletter-builder/${template.id}`,
      priority: 'medium',
    });

    return new Response(JSON.stringify({
      success: true,
      template_id: template.id,
      subject,
      block_count: blocksWithIds.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('generate-ai-newsletter error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
