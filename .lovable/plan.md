

# Scenario 05 Gap Analysis: What's Missing or Broken

## CRITICAL: Column Name Mismatches (will cause runtime failures)

The edge function writes to `workflow_runs` and `workflow_run_steps` using column names that **do not exist** in the actual database tables. Every run will fail with insert errors.

### workflow_runs table

| Edge function writes | Actual column in DB | Fix needed |
|---|---|---|
| `workflow_type` | `workflow_name` | Rename in code |
| `trigger_source` | `triggered_by` | Rename in code |
| `trigger_data` | `input` | Rename in code (and it's jsonb, not text) |

The unique index is on `(workflow_name, idempotency_key)`, so using the wrong column name means idempotency won't work either.

### workflow_run_steps table

| Edge function writes | Actual column in DB | Fix needed |
|---|---|---|
| `input_data` | `request` (jsonb) | Rename in code |
| `output_data` | Does not exist | Use `response_body` (jsonb) |

The `logStep` helper also writes `input_data`/`output_data` as stringified text, but the actual columns are `jsonb` type, so the data format needs to change too.

## CRITICAL: Missing social platforms in providers array

The edge function builds Metricool providers for Facebook, Instagram, LinkedIn, Threads, and YouTube -- but **skips three platforms** that have data in the DB:

| Platform | DB column | Has agent data? | In edge function? |
|---|---|---|---|
| TikTok | `metricool_tiktok_id` | Yes (Traci, Samir) | **NO** |
| Twitter/X | `metricool_twitter_id` | No data yet | **NO** |
| Google My Business | `metricool_gmb_id` | No data yet | **NO** |

TikTok is the most urgent since two agents have active TikTok IDs.

## REQUIRED: ClickUp Webhook Registration

The edge function is deployed and ready at:
```
https://cguoaokqwgqvzkqqezcq.supabase.co/functions/v1/clickup-social-ready-to-schedule
```

But **no webhook has been registered in ClickUp** to actually trigger it. You need to either:
- Register it via ClickUp API (using `clickup-register-and-sync` or similar)
- Or manually add it in ClickUp workspace settings

The webhook should fire on a specific trigger -- likely a **status change** to "Ready to Schedule" or a custom automation. The exact ClickUp List ID and trigger event need to be confirmed.

## MINOR: Hook interface out of sync

`src/hooks/useAgentMarketingSettings.ts` still references `metricool_user_id` in the TypeScript interface (line was not removed in the last edit), though the DB column was dropped. This won't break Scenario 05 (edge function only) but will cause TypeScript errors if the hook is used.

## Summary of Fixes

### 1. Fix workflow_runs column names in edge function
Update the insert/update calls to use actual column names: `workflow_name`, `triggered_by`, `input`, and proper jsonb format.

### 2. Fix workflow_run_steps column names in logStep helper
Change `input_data` to `request` and `output_data` to `response_body`, and pass objects (not stringified text) since the columns are jsonb.

### 3. Add TikTok, Twitter/X, and GMB to providers
Add three more provider blocks in the scheduling section, matching the pattern of the existing five.

### 4. Remove `metricool_user_id` from useAgentMarketingSettings.ts interface
Clean up the TypeScript interface to match the current schema.

### 5. Register ClickUp webhook (manual step)
You need to register the webhook URL in ClickUp, targeting the correct List and trigger event (e.g., status changed to "Ready to Schedule"). This is a configuration step, not a code change.

### Technical Details: Code Changes

**File: `supabase/functions/clickup-social-ready-to-schedule/index.ts`**

Insert block (lines 208-221) changes from:
```typescript
workflow_type: "schedule",
trigger_source: "clickup_webhook",
trigger_data: JSON.stringify({...}).slice(0, 5000),
```
To:
```typescript
workflow_name: "schedule",
triggered_by: "clickup_webhook",
input: { task_id: taskId, event: eventId },
```

logStep helper (lines 98-121) changes column references:
```typescript
// Before
input_data: input ? JSON.stringify(input).slice(0, 5000) : null,
output_data: output ? JSON.stringify(output).slice(0, 5000) : null,

// After
request: input || null,
response_body: output || null,
```

Add TikTok provider (after Threads block, ~line 375):
```typescript
if (mktSettings.metricool_tiktok_id) {
  providers.push({
    blogKey: mktSettings.metricool_tiktok_id,
    network: "TIKTOK",
  });
}
```

Similarly for Twitter and GMB.

**File: `src/hooks/useAgentMarketingSettings.ts`**

Remove the `metricool_user_id` line from the `AgentMarketingSettings` interface.

