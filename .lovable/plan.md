

# AI Newsletter Writer -- Full Plan

## Overview

Build an edge function that uses Lovable AI (Gemini) to generate a complete newsletter for each agent, outputting structured `blocks_json` that slots directly into the existing newsletter builder. An admin triggers generation from the Admin Newsletter page, the AI drafts are saved as templates marked "pending review," and an action item is created for the admin to review/edit/send.

## Architecture

```text
Admin clicks "Generate AI Newsletter"
  for agent X
        │
        ▼
Edge Function: generate-ai-newsletter
  1. Fetch agent profile + marketing settings
     (brand_guidelines, tone_guidelines, gpt_prompt,
      target_audience, what_not_to_say, example_copy,
      primary_color, secondary_color)
  2. Fetch agent's recent listings (if any exist)
  3. Build system prompt with branding context
  4. Call Lovable AI Gateway (Gemini) with tool_choice
     to get structured blocks_json output
  5. Save as newsletter_template (is_active = false)
  6. Insert agent_action_item for admin review
  7. Return template ID
        │
        ▼
Admin sees template in builder → edits → approves → sends
```

## Database Changes

### Add columns to `newsletter_templates`

- `ai_generated` (boolean, default false) -- flag AI-created templates
- `review_status` (text, default null) -- 'pending_review' | 'approved' | null

No new tables needed. The existing `agent_action_items` table will hold the review task.

## Edge Function: `generate-ai-newsletter`

### Input
```json
{
  "agent_id": "uuid",
  "topic_hint": "optional - e.g. 'Summer market update'",
  "include_listings": true
}
```

### Logic
1. **Fetch context** from Supabase:
   - `profiles` -- agent name, brokerage, license, contact info
   - `agent_marketing_settings` -- brand guidelines, tone, colors, GPT prompt, target audience, what NOT to say, example copy
   - `contacts` count (for personalization context)
   - Recent listings from the agent's newsletter templates (if `include_listings` is true)

2. **Build system prompt** incorporating all branding/content guidelines:
   - Use `gpt_prompt` as the base creative direction
   - Apply `brand_guidelines` and `tone_guidelines` for voice
   - Reference `target_audience` for content targeting
   - Enforce `what_not_to_say` as negative constraints
   - Use `example_copy` as style reference
   - Use `primary_color` and `secondary_color` for button/heading colors

3. **Call Lovable AI Gateway** with structured output (tool calling):
   - Model: `google/gemini-3-flash-preview`
   - Use a tool definition that returns a `blocks_json` array matching the existing `NewsletterBlock` schema
   - The AI generates: heading, text paragraphs, a CTA button, divider, agent bio block, and social icons block
   - Subject line is also generated

4. **Save template** to `newsletter_templates`:
   - `agent_id` = the target agent
   - `name` = "AI Draft: {subject}" 
   - `blocks_json` = the AI-generated blocks
   - `global_styles` = derived from agent's brand colors + defaults
   - `is_active` = false (draft state)
   - `ai_generated` = true
   - `review_status` = 'pending_review'
   - `created_by` = requesting admin's user ID

5. **Create action item** in `agent_action_items`:
   - `agent_id` = admin user ID (the reviewer)
   - `item_type` = 'newsletter_review'
   - `title` = "Review AI Newsletter for {Agent Name}"
   - `description` = "An AI-generated newsletter draft is ready for review"
   - `action_url` = `/newsletter-builder/{template_id}`
   - `priority` = 'medium'

### AI Prompt Strategy

The system prompt will be structured like:

```
You are a real estate newsletter copywriter. Generate engaging email 
newsletter content for {agent_name} at {brokerage}.

BRAND GUIDELINES: {brand_guidelines}
TONE: {tone_guidelines}  
TARGET AUDIENCE: {target_audience}
DO NOT SAY: {what_not_to_say}
STYLE REFERENCE: {example_copy}

Use primary brand color {primary_color} for buttons and accents.
Generate a complete newsletter with: an engaging headline, 2-3 content 
sections with market insights or tips, a clear call-to-action, and 
include the agent bio block at the end.
```

The tool definition will enforce the `NewsletterBlock[]` schema so the output is directly usable.

## Frontend Changes

### Admin Newsletter Page (`src/pages/AdminNewsletter.tsx`)

Add a "Generate AI Newsletter" button to each agent card in the Agent Overview tab:
- Shows a small dialog to optionally provide a topic hint
- Calls the edge function
- On success, navigates to the newsletter builder with the new template

### Newsletter Builder (`src/components/newsletter/builder/NewsletterBuilder.tsx`)

Add a visual banner at the top when `review_status === 'pending_review'`:
- Yellow banner: "AI-Generated Draft -- Review and edit before sending"
- "Approve" button that sets `review_status = 'approved'` and `is_active = true`

### Template List (`src/components/newsletter/builder/TemplateList.tsx`)

Show an "AI" badge on AI-generated templates and a "Pending Review" status badge.

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate-ai-newsletter/index.ts` | **Create** -- new edge function |
| `supabase/config.toml` | **Modify** -- add function config |
| DB migration | **Create** -- add `ai_generated` and `review_status` columns to `newsletter_templates` |
| `src/pages/AdminNewsletter.tsx` | **Modify** -- add Generate AI button to agent cards |
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | **Modify** -- add review banner |
| `src/components/newsletter/builder/TemplateList.tsx` | **Modify** -- add AI/review badges |

## Dependencies

- Uses `LOVABLE_API_KEY` (already configured) for the AI Gateway
- No new secrets needed
- No new npm packages needed

