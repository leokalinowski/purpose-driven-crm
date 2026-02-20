

# Thumbnail Generation System -- Upgrade Plan

## Current Status

The pipeline exists and is technically functional end-to-end, but it has never successfully completed a run. The one attempt failed because the target agent had no reference images uploaded. Here's the readiness breakdown across your 9 configured agents:

| Requirement | Ready | Missing |
|---|---|---|
| ClickUp list ID mapped | 9/9 | -- |
| Reference images uploaded | 2/9 | 7 agents need photos |
| Headshot URL set | 0/9 | Fallback not configured |
| Backgrounds linked | 2/9 | 7 agents use generic fallback |
| Thumbnail guidelines written | 1/9 | 8 agents get generic prompts |

## What This Plan Fixes

### 1. Smarter Image Prompt (Better Thumbnails)

The current prompt is generic and doesn't leverage all the agent data we have. The upgraded prompt will:

- Use the agent's **brand colors** (primary/secondary) to influence background tones
- Add explicit **text-safe zone** instructions so Placid text overlay doesn't clash with the subject
- Include **target audience** context so the image feels right for the agent's market
- Use `google/gemini-3-pro-image-preview` (higher quality) instead of `google/gemini-2.5-flash-image` for noticeably better results
- Add a structured prompt that separates subject instructions from background instructions more clearly

**File: `supabase/functions/process-thumbnail-queue/index.ts`**

Current prompt (simplified):
```
Create a new image that preserves facial identity...
Places subject in new background: ${backgroundPrompt}
```

Upgraded prompt structure:
```
SUBJECT: [reference image] -- recreate this person exactly...
BACKGROUND: ${backgroundPrompt}, influenced by brand palette (${primaryColor}, ${secondaryColor})
COMPOSITION for 9:16: Subject in lower 60%, upper 40% clear for text overlay
COMPOSITION for 16:9: Subject on left/right third, opposite side clear for text
STYLE: ${thumbnailGuidelines || default professional guidelines}
AUDIENCE CONTEXT: ${targetAudience}
```

### 2. Richer Title Generation

Currently the title generator only uses `thumbnail_guidelines`. It should also incorporate:
- `tone_guidelines` -- so titles match the agent's voice
- `brand_guidelines` -- for terminology/positioning
- `target_audience` -- to speak to the right people
- `what_not_to_say` -- to avoid forbidden words/phrases

**File: `supabase/functions/process-thumbnail-queue/index.ts`** (same file, `generateTitle` function)

### 3. Separate Placid Templates per Aspect Ratio

Right now both 9:16 and 16:9 use the same Placid template (`nlhaoglryb9fg`). The text placement and sizing should differ between portrait and landscape. 

This requires creating a second Placid template for 9:16 (you'd do this in the Placid dashboard), then updating the code to use the correct template per ratio.

**File: `supabase/functions/process-thumbnail-queue/index.ts`**

Change from:
```typescript
const PLACID_TEMPLATE_UUID = "nlhaoglryb9fg";
```

To:
```typescript
const PLACID_TEMPLATE_16x9 = "nlhaoglryb9fg";
const PLACID_TEMPLATE_9x16 = "<new-template-id>"; // To be created in Placid
```

For now, we'll add a config field in `agent_marketing_settings` (or use constants) so this can be updated without redeploying.

### 4. Manual Trigger Button in Admin UI

Add a "Generate Thumbnail" button to the admin dashboard so you can trigger thumbnail generation for any ClickUp task without waiting for the ClickUp Automation. This is useful for testing, re-generating, and on-demand use.

**New component: `src/components/admin/ThumbnailGenerator.tsx`**

A simple card with:
- A text input for the ClickUp task ID
- A "Generate" button that calls the webhook endpoint
- Status display showing the workflow run progress (polling `workflow_runs` + `workflow_run_steps`)
- Links to the generated thumbnails when complete

This component can be placed in the agent's marketing settings page or as a standalone admin tool.

### 5. Graceful Fallback for Missing Images

Instead of hard-failing when no reference image exists, the system should:
- Check `agent_images` first (any type, not just headshot)
- Fall back to `headshot_url` from marketing settings
- Fall back to the agent's **profile** avatar/photo if one exists in `profiles`
- If truly nothing exists, generate a text-only thumbnail (skip the person, just do background + title) rather than failing entirely

**File: `supabase/functions/process-thumbnail-queue/index.ts`** (Step 3: select_assets)

### 6. Pull All Brand Context into the Pipeline

The `resolve_agent_settings` step currently only fetches `thumbnail_guidelines` and `headshot_url`. It should also pull:
- `primary_color`, `secondary_color` -- for brand-influenced imagery
- `tone_guidelines` -- for title generation
- `brand_guidelines` -- for title generation  
- `target_audience` -- for both image and title
- `what_not_to_say` -- for title generation
- `logo_colored_url` -- potential future logo watermark

**File: `supabase/functions/process-thumbnail-queue/index.ts`** (Step 2 select query)

## Technical Changes Summary

| File | Changes |
|---|---|
| `supabase/functions/process-thumbnail-queue/index.ts` | Upgrade image prompt, upgrade title prompt, pull full brand context, add fallback for missing images, separate Placid templates per ratio, use `gemini-3-pro-image-preview` model |
| `src/components/admin/ThumbnailGenerator.tsx` | New component -- manual trigger + status viewer |
| `src/components/admin/AgentMarketingSettingsForm.tsx` | Add ThumbnailGenerator to the Images or a new Thumbnails tab |

## Data Setup Needed (Not Code)

Before this works well for all agents, you'll need to:

1. **Upload reference photos** for the 7 agents who don't have any yet (via Admin > Agent Settings > Images tab)
2. **Link backgrounds** to agents who don't have any (via Admin > Agent Settings > Backgrounds tab)
3. **Write thumbnail guidelines** for agents beyond the one who already has them (via Admin > Agent Settings > Content tab)
4. **Create a 9:16 Placid template** in the Placid dashboard (duplicate the 16:9 template and adjust text positioning for portrait)

## What Won't Change

- The webhook/queue architecture stays the same (proven pattern)
- Idempotency and deduplication logic stays the same
- Storage bucket and ClickUp field update stay the same
- The `workflow_runs` + `workflow_run_steps` logging stays the same

