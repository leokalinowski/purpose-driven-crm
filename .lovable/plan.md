

# Fix Shade API Connection

## Root Cause
The 403 "User does not have permission" error is caused by the `drive_id` handling. The current code tries to parse a Drive ID from the ClickUp task description and, if found, uses that **instead** of the reliable `SHADE_DRIVE_ID` environment variable. If the parsed value is wrong or from a different context, the Shade API rejects the request.

Since the Drive ID is always the same (as you confirmed), the code should always use the `SHADE_DRIVE_ID` secret and not try to override it from the task description.

## Changes

### File: `supabase/functions/clickup-generate-copy-webhook/index.ts`

1. **Always use `SHADE_DRIVE_ID` env var** -- remove the regex-based `driveIdMatch` override. The `drive_id` is constant and already stored as a secret.

2. **Require `SHADE_DRIVE_ID`** before attempting the Shade API call (same pattern as `clickup-social-ready-to-schedule` which already does `if (!SHADE_API_KEY || !SHADE_DRIVE_ID) throw new Error(...)`).

3. **Keep the utterances endpoint** -- the docs confirm `/transcription/utterances` returns `[{speaker, start, end, text, words}]` which gives the full transcription. No endpoint change needed.

4. **Always include `drive_id` as a required query param** -- change from conditional `${shadeDriveId ? ... : ""}` to always including it.

### Specific code changes:

- Remove the `driveIdMatch` regex line and the conditional drive ID logic
- Set `shadeDriveId = SHADE_DRIVE_ID` directly
- Guard the Shade fetch with: `if (shadeAssetId && SHADE_API_KEY && SHADE_DRIVE_ID)`
- Simplify the URL to: `` `https://api.shade.inc/assets/${shadeAssetId}/transcription/utterances?drive_id=${SHADE_DRIVE_ID}` ``

### No other files change
The `clickup-social-ready-to-schedule` function already handles Shade correctly (always uses `SHADE_DRIVE_ID` env var, always passes it).

### Deployment
Redeploy `clickup-generate-copy-webhook`.

