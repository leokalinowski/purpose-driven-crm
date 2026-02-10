

# Fix Shade API + Duplicate Block

## Two Issues to Fix

### Issue 1: Wrong Shade API Endpoint
Your working Make scenario uses this URL pattern:
```
/assets/{asset_id}/transcription/file?drive_id=...&type=txt
```
Our code uses `/transcription/utterances` -- a different endpoint that's returning 403. Switching to the exact endpoint and parameters that work in Make will fix the permission error.

### Issue 2: Duplicate Block in Content Generation
The `generate-social-copy` function checks for an existing completed record and returns `{ duplicate: true }` with **no copy data**. The webhook then has nothing to write back to ClickUp -- hence no field updates. On re-triggers, this blocks all regeneration.

---

## Technical Changes

### File 1: `supabase/functions/clickup-generate-copy-webhook/index.ts`

**Switch to `/transcription/file` endpoint with `type=txt`:**
- Change URL from:
  `https://api.shade.inc/assets/${shadeAssetId}/transcription/utterances?drive_id=${SHADE_DRIVE_ID}`
- To:
  `https://api.shade.inc/assets/${shadeAssetId}/transcription/file?drive_id=${SHADE_DRIVE_ID}&type=txt`
- Since this returns plain text (not JSON), change `shadeResp.json()` to `shadeResp.text()`
- Remove the utterance array parsing -- the response IS the transcript string directly
- Remove the `"Content-Type": "application/json"` header from the Shade request (we're requesting a text file)

### File 2: `supabase/functions/generate-social-copy/index.ts`

**Allow regeneration by deleting old record:**
- When an existing completed record is found, delete it instead of returning early
- This lets each new webhook trigger produce fresh content

### Deployment
Redeploy both `clickup-generate-copy-webhook` and `generate-social-copy`.

