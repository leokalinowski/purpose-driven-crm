/**
 * delight-suggest-gift — Grok-powered gift idea generator.
 *
 * Inputs:  { contact_id, occasion?, budget_usd? }
 * Output:  { ok, suggestions: [{ title, description, price_band, reason }, ...] }
 *
 * Pulls the contact's gift_preferences, category/tier, and the agent's
 * marketing tone from the DB so suggestions feel personal, not generic.
 *
 * Auth: caller must be authenticated. We verify the contact belongs to
 * them (or admin override) before sending the contact details to the AI.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface SuggestRequest {
  contact_id?: string;
  occasion?: string | null;
  budget_usd?: number | null;
}

interface GiftSuggestion {
  title: string;
  description: string;
  price_band: string;
  reason: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const FALLBACK_SUGGESTIONS: GiftSuggestion[] = [
  { title: 'Hand-written note', description: 'A short, personal note acknowledging the milestone.', price_band: '$0–$10', reason: 'Always appropriate; the gesture matters more than the spend.' },
  { title: 'Local bakery delivery', description: 'A small box from a well-reviewed bakery near them.', price_band: '$25–$50', reason: 'Universally well-received; supports a local business.' },
  { title: 'Coffee shop gift card', description: 'A $25 gift card to a chain near their home.', price_band: '$25', reason: 'Easy to send, easy to use, low friction.' },
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    const XAI_MODEL = Deno.env.get('XAI_MODEL') ?? 'grok-4-1-fast-reasoning';

    // ── Auth ──
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ ok: false, error: 'Missing bearer token' }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);

    let body: SuggestRequest;
    try { body = await req.json(); } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
    }
    if (!body.contact_id) return jsonResponse({ ok: false, error: 'contact_id required' }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Verify caller owns the contact (or is admin) ──
    const { data: roleRow } = await adminClient
      .from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    const isAdmin = !!roleRow;

    const { data: contactRow, error: contactErr } = await adminClient
      .from('contacts')
      .select('agent_id, first_name, last_name, gift_preferences, category, birthday, spouse_birthday, home_anniversary, last_gift_sent_at')
      .eq('id', body.contact_id)
      .maybeSingle();
    if (contactErr || !contactRow) {
      return jsonResponse({ ok: false, error: 'Contact not found' }, 404);
    }
    if (!isAdmin && contactRow.agent_id !== userData.user.id) {
      return jsonResponse({ ok: false, error: 'Not authorized for this contact' }, 403);
    }

    // ── Pull the agent's brand tone for voice matching ──
    const { data: marketing } = await adminClient
      .from('agent_marketing_settings')
      .select('tone_guidelines, target_audience, what_not_to_say, gpt_prompt')
      .eq('user_id', contactRow.agent_id)
      .maybeSingle();

    // ── Fall back if no AI key ──
    if (!XAI_API_KEY) {
      return jsonResponse({ ok: true, suggestions: FALLBACK_SUGGESTIONS });
    }

    const contactName = [contactRow.first_name, contactRow.last_name].filter(Boolean).join(' ') || 'this contact';
    const occasion = body.occasion ?? inferOccasion(contactRow);
    const budget = body.budget_usd ?? null;
    const prefs = contactRow.gift_preferences;
    const category = contactRow.category;
    const lastGifted = contactRow.last_gift_sent_at
      ? new Date(contactRow.last_gift_sent_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      : null;

    const systemPrompt = `You are a thoughtful gift advisor for a real estate agent who's nurturing long-term client relationships through personal, well-chosen gifts. The agent wants 4 specific, actionable gift ideas — not generic categories.

CONTACT DETAILS:
- Name: ${contactName}
- Occasion: ${occasion}
- Their gift preferences (free text the agent has noted): ${prefs ?? 'none recorded'}
- Relationship tier / category: ${category ?? 'unknown'}
- Last gift the agent sent them: ${lastGifted ?? 'no prior gift on file'}
${budget ? `- Budget: around $${budget}` : '- Budget: $25–$100 sweet spot for a thoughtful real-estate-client gift'}

${marketing?.gpt_prompt ? `AGENT'S BRAND DIRECTION: ${marketing.gpt_prompt}` : ''}
${marketing?.tone_guidelines ? `AGENT'S TONE: ${marketing.tone_guidelines}` : ''}
${marketing?.what_not_to_say ? `AVOID: ${marketing.what_not_to_say}` : ''}

REQUIREMENTS for each suggestion:
1. Specific (not "a nice candle" — say "a Le Labo Santal 33 candle")
2. Tied to either the recorded preferences OR the occasion
3. Feasible to ship or hand-deliver in <5 days
4. Avoid: alcohol if "no alcohol" appears in preferences; chocolate if dietary issues; anything with strong religious overtones

DON'T:
- Suggest the same thing twice
- Recommend gift cards as the only idea (max 1 of 4 can be a gift card)
- Suggest something the agent has clearly already sent

Respond with JSON exactly matching:
{
  "suggestions": [
    {
      "title": "<short product name, under 60 chars>",
      "description": "<one-sentence pitch the agent can paste into the gift activity log>",
      "price_band": "<e.g. \\"$30–$45\\" or \\"$50\\">",
      "reason": "<one-sentence why this fits THIS contact + occasion>"
    }
  ]
}

Return exactly 4 suggestions ordered most-thoughtful-first. No prose outside the JSON.`;

    const aiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the 4 gift suggestions now.' },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.85,
      }),
    });

    if (!aiResponse.ok) {
      console.error('xAI error:', aiResponse.status, await aiResponse.text());
      return jsonResponse({ ok: true, suggestions: FALLBACK_SUGGESTIONS, error: `AI fallback (status ${aiResponse.status})` });
    }
    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    let parsed: { suggestions?: GiftSuggestion[] } | null = null;
    if (content) {
      try { parsed = JSON.parse(content); }
      catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
      }
    }
    const suggestions = (parsed?.suggestions ?? []).filter((s): s is GiftSuggestion =>
      !!s && typeof s.title === 'string' && typeof s.description === 'string',
    );
    if (suggestions.length === 0) {
      return jsonResponse({ ok: true, suggestions: FALLBACK_SUGGESTIONS, error: 'AI returned no usable suggestions' });
    }
    return jsonResponse({ ok: true, suggestions: suggestions.slice(0, 4) });
  } catch (err) {
    console.error('[delight-suggest-gift] uncaught:', err);
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : 'Suggestion failed' },
      500,
    );
  }
});

function inferOccasion(c: { birthday: string | null; spouse_birthday: string | null; home_anniversary: string | null }): string {
  const today = new Date();
  const monthDay = (s: string | null) => {
    if (!s) return null;
    const [_y, m, d] = s.split('-');
    return { m: Number(m), d: Number(d) };
  };
  const candidates: Array<{ kind: string; m?: number; d?: number }> = [
    { kind: 'birthday', ...(monthDay(c.birthday) ?? {}) },
    { kind: 'spouse birthday', ...(monthDay(c.spouse_birthday) ?? {}) },
    { kind: 'home anniversary', ...(monthDay(c.home_anniversary) ?? {}) },
  ].filter((x) => x.m && x.d);

  let nearest: { kind: string; days: number } | null = null;
  for (const c of candidates) {
    const target = new Date(today.getFullYear(), c.m! - 1, c.d!);
    if (target.getTime() < today.getTime() - 24 * 3600 * 1000) {
      target.setFullYear(today.getFullYear() + 1);
    }
    const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (!nearest || days < nearest.days) nearest = { kind: c.kind, days };
  }
  return nearest?.kind ?? 'thoughtful gesture';
}
