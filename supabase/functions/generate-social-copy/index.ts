// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
  const XAI_MODEL = Deno.env.get("XAI_MODEL") ?? "grok-4-1-fast-reasoning";

  if (!XAI_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing XAI_API_KEY" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { clickup_task_id, transcript, video_description, client_id, shade_asset_id } = await req.json();

    if (!clickup_task_id) {
      return new Response(JSON.stringify({ error: "clickup_task_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing completed generation
    const { data: existing } = await supabase
      .from("content_generation_results")
      .select("id, social_copy, youtube_titles")
      .eq("clickup_task_id", clickup_task_id)
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      // Delete old record to allow regeneration with fresh content
      await supabase
        .from("content_generation_results")
        .delete()
        .eq("id", existing.id);
      console.log("Deleted previous generation for re-run:", existing.id);
    }

    // Resolve client_id to get agent marketing settings
    let agentUserId = client_id;
    let mktSettings: any = null;

    if (agentUserId) {
      const { data } = await supabase
        .from("agent_marketing_settings")
        .select("*")
        .eq("user_id", agentUserId)
        .single();
      mktSettings = data;
    }

    // Build the system prompt from agent brand settings
    const brandParts: string[] = [];
    if (mktSettings?.brand_guidelines) brandParts.push(`Brand Guidelines: ${mktSettings.brand_guidelines}`);
    if (mktSettings?.target_audience) brandParts.push(`Target Audience: ${mktSettings.target_audience}`);
    if (mktSettings?.tone_guidelines) brandParts.push(`Tone: ${mktSettings.tone_guidelines}`);
    if (mktSettings?.what_not_to_say) brandParts.push(`Avoid saying: ${mktSettings.what_not_to_say}`);
    if (mktSettings?.example_copy) brandParts.push(`Example copy for reference:\n${mktSettings.example_copy}`);

    const agentGptPrompt = mktSettings?.gpt_prompt || "";

    const systemPrompt = `You are a social media copywriter for a real estate professional.
${agentGptPrompt ? `\nAgent-specific instructions:\n${agentGptPrompt}` : ""}
${brandParts.length > 0 ? `\n${brandParts.join("\n")}` : ""}

Your task: Generate social media copy for a video post. Provide:
1. A single social media caption (with relevant hashtags) suitable for Instagram, Facebook, LinkedIn, and TikTok
2. Three YouTube title options (short, catchy, SEO-friendly)
3. A YouTube description (2-3 sentences with relevant keywords)

Keep the caption engaging, authentic, and aligned with the agent's brand. Do NOT use generic real estate clichés.`;

    const userContent = transcript
      ? `Here is the video transcript:\n\n${transcript}`
      : video_description
        ? `Here is the video description:\n\n${video_description}`
        : "Generate engaging social media copy for a real estate video post. No transcript or description was provided, so create a general engaging caption.";

    // Call xAI Grok with JSON-object response format for structured output
    const jsonInstruction = `\n\nRespond with a JSON object exactly matching this shape:
{
  "social_copy": "<caption with hashtags>",
  "youtube_titles": ["<title 1>", "<title 2>", "<title 3>"],
  "youtube_description": "<2-3 sentences>"
}
No prose outside the JSON.`;

    const aiResp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt + jsonInstruction },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("xAI error:", aiResp.status, errText);

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`xAI error [${aiResp.status}]: ${errText}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content ?? "";

    let socialCopy = "";
    let youtubeTitles = "[]";
    let youtubeDescription = "";

    try {
      const args = JSON.parse(content);
      socialCopy = args.social_copy || "";
      youtubeTitles = JSON.stringify(args.youtube_titles || []);
      youtubeDescription = args.youtube_description || "";
    } catch {
      console.error("Failed to parse Grok JSON response, using raw content as caption");
      socialCopy = content;
    }

    // Save to content_generation_results
    const { data: result, error: insertErr } = await supabase
      .from("content_generation_results")
      .insert({
        clickup_task_id,
        shade_asset_id: shade_asset_id || null,
        agent_marketing_settings_id: mktSettings?.id || null,
        social_copy: socialCopy,
        youtube_titles: youtubeTitles,
        youtube_description: youtubeDescription,
        status: "completed",
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    console.log("Content generated:", { id: result.id, clickup_task_id, copyLength: socialCopy.length });

    return new Response(
      JSON.stringify({
        ok: true,
        id: result.id,
        social_copy: socialCopy,
        youtube_titles: youtubeTitles,
        youtube_description: youtubeDescription,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-social-copy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
