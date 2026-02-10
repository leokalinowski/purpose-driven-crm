

# Full Workflow Gap Analysis: What's Missing to Make It All Work

## The Complete Scenario 05 Pipeline

```text
[ClickUp Task status -> "Ready to Schedule"]
        |
        v  (webhook)
[clickup-social-ready-to-schedule edge function]
        |
        +-- Read ClickUp task custom fields (Client ID, Shade Asset ID, Publish Date)
        +-- Look up agent profile + marketing settings
        +-- Fetch social copy from content_generation_results table
        +-- Get video download URL from Shade
        +-- Normalize media via Metricool
        +-- Schedule post via Metricool API
```

---

## GAP 1 (CRITICAL): No Content Generation / Copy Writing Step

The scheduling function reads from `content_generation_results` to get the `social_copy` and `youtube_titles` for each post. But:

- The `content_generation_results` table is **completely empty** (0 rows)
- **No edge function exists** to generate social copy
- **No webhook or trigger** is registered to kick off copy generation
- The `gpt_prompt`, `brand_guidelines`, `target_audience`, `tone_guidelines`, `what_not_to_say`, and `example_copy` columns in `agent_marketing_settings` are **all NULL** for every agent

This means every scheduled post will go out with **empty text** -- no caption, no hashtags, nothing.

### What's Needed

A content generation step that:
1. Is triggered earlier in the workflow (e.g., when a video lands in ClickUp or reaches an "Editing Complete" status)
2. Takes the video transcript (or description) + the agent's brand guidelines/GPT prompt
3. Calls an AI model (Lovable AI / Grok / etc.) to generate platform-appropriate social copy
4. Writes the results to `content_generation_results` with `status = 'completed'`
5. The agent brand settings (`gpt_prompt`, `brand_guidelines`, etc.) need to be populated for each agent

### Implementation

- **New edge function**: `generate-social-copy` that accepts a ClickUp task ID, fetches the transcript, applies the agent's GPT prompt/brand guidelines, calls an LLM, and writes to `content_generation_results`
- **Trigger**: Either a separate ClickUp webhook on an earlier status (e.g., "Editing Complete"), or called as a step within Scenario 05 before scheduling
- **Data population**: All agents need their `gpt_prompt`, `brand_guidelines`, `target_audience`, `tone_guidelines`, and `example_copy` filled in

---

## GAP 2 (CRITICAL): No ClickUp Webhook Registered

The `clickup_webhooks` table is **completely empty**. No webhook has been registered to trigger `clickup-social-ready-to-schedule`.

The existing `clickup-register-and-sync` function registers webhooks, but it's designed for **event task tracking** (it points to `clickup-webhook`, not to `clickup-social-ready-to-schedule`). A new webhook registration is needed specifically for the social scheduling workflow.

### What's Needed

Register a ClickUp webhook that fires on `taskStatusUpdated` and points to:
```
https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/clickup-social-ready-to-schedule
```

This can be done:
- Via ClickUp API call (needs the team ID and target list ID for social/video tasks)
- Or via ClickUp workspace Automations UI

The edge function also needs logic to **filter** for the specific status (e.g., "Ready to Schedule") since the webhook will fire on every status change.

### Missing: Status Filtering in the Edge Function

Currently `clickup-social-ready-to-schedule` processes **every** incoming webhook payload without checking which status the task moved to. It should verify the task is actually in "Ready to Schedule" status before proceeding. Without this, it will attempt to schedule every time any field on the task changes.

---

## GAP 3 (MODERATE): Metricool API Authentication Header

The Metricool API documentation specifies the auth header as:
```
X-Mc-Auth: <userToken>
```

But the edge function uses:
```
Authorization: Bearer <METRICOOL_API_KEY>
```

This **may or may not work** depending on whether Metricool accepts both formats. If the API rejects the `Authorization` header, every normalize and schedule call will fail. This needs to be verified or corrected to use `X-Mc-Auth`.

---

## GAP 4 (MODERATE): Metricool Post Format Limitations

The current implementation sends the **same text and media** to all platforms uniformly. Platform-specific issues:

| Platform | Issue |
|---|---|
| Instagram | `instagramPublishMode` is hardcoded to "REEL" -- what about feed posts, carousels, or stories? |
| YouTube | `shorts: true` is hardcoded -- what about longer videos that should be regular uploads? |
| Twitter/X | Has a 280-character limit -- long social copy will be truncated/rejected by the API |
| TikTok | May require specific video format/dimensions |
| Facebook | Reels vs. feed post distinction not handled |

The scheduling payload has no logic to adapt content per platform. The Metricool API supports per-provider text overrides and format settings, but none are used.

---

## GAP 5 (MODERATE): No `CLICKUP_WEBHOOK_SECRET` Configured

The secret `CLICKUP_WEBHOOK_SECRET` is **not in the secrets list** (22 secrets listed, none is `CLICKUP_WEBHOOK_SECRET`). The code falls back gracefully -- if no secret is set, signature verification is skipped (`if (!secret) return true`). This means the endpoint accepts requests from anyone, not just ClickUp.

For production, this should be configured with the webhook signing secret from ClickUp.

---

## GAP 6 (MINOR): Agent Brand/Content Settings Are All Empty

Every single agent has NULL for all content generation fields:

| Field | Status |
|---|---|
| gpt_prompt | NULL for all 13 agents |
| brand_guidelines | NULL for all 13 agents |
| target_audience | NULL for all 13 agents |
| tone_guidelines | NULL for all 13 agents |
| what_not_to_say | NULL for all 13 agents |
| example_copy | NULL for all 13 agents |
| thumbnail_guidelines | NULL for all 13 agents |

Even if we build the copy generation function, there's nothing to guide the AI without this data.

---

## Priority Order of Fixes

### Must-have (workflow won't function without these)

1. **Register ClickUp webhook** for social scheduling -- otherwise the function never fires
2. **Add status filtering** in the edge function -- only process tasks in "Ready to Schedule" status
3. **Build content generation** -- either a separate edge function or inline in the scheduling flow, plus populate agent brand settings

### Should-have (will cause failures for some posts/platforms)

4. **Verify Metricool auth header** -- confirm `Authorization: Bearer` works or switch to `X-Mc-Auth`
5. **Add per-platform format handling** -- Twitter character limits, Instagram post types, YouTube shorts vs. regular
6. **Configure `CLICKUP_WEBHOOK_SECRET`** for production security

### Nice-to-have

7. **Platform-specific copy** -- generate different text for Twitter (short) vs. LinkedIn (professional) vs. Instagram (hashtag-heavy)

---

## Technical Implementation Plan

### 1. Create `generate-social-copy` Edge Function

New file: `supabase/functions/generate-social-copy/index.ts`

- Accepts `{ clickup_task_id, transcript?, video_description? }`
- Fetches agent settings from `agent_marketing_settings` (gpt_prompt, brand_guidelines, etc.)
- Calls Lovable AI gateway with the agent's custom prompt + transcript
- Writes social_copy, youtube_titles, youtube_description to `content_generation_results`
- Returns the generated content

### 2. Add Status Filter to `clickup-social-ready-to-schedule`

After parsing the webhook payload, check the task status:
```typescript
const taskStatus = task?.status?.status?.toLowerCase();
if (taskStatus !== "ready to schedule") {
  console.log("Task not in 'Ready to Schedule' status, skipping");
  return new Response(JSON.stringify({ ok: true, skipped: true, reason: "wrong_status" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

### 3. Register ClickUp Webhook

Either create a new edge function or extend `clickup-register-and-sync` to register a webhook pointing to `clickup-social-ready-to-schedule` for the social/video deliverables list(s). The list IDs are stored in `agent_marketing_settings.clickup_video_deliverables_list_id`.

### 4. Verify/Fix Metricool Auth Header

Test a simple Metricool API call. If `Authorization: Bearer` fails, update all Metricool calls to use:
```typescript
headers: { "X-Mc-Auth": METRICOOL_API_KEY }
```

### 5. Populate Agent Brand Settings

Either via admin UI (the Marketing form in Team Management already has fields for this) or via a data migration with the actual brand guidelines for each agent.

