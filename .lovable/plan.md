

# Fix: Use Asset-Specific Drive ID from Task Description

## Problem
The Shade API is still returning 403 because the code uses the `SHADE_DRIVE_ID` environment secret, but the task description contains the correct, asset-specific Drive ID (`434a697c-9f1f-43e5-b9db-93e02a28bd5a`). Your working Make scenario also uses the Drive ID associated with each specific asset. Since the transcript fetch fails, the `transcript` variable stays empty, and the "Video Transcription" field update is skipped entirely.

## Fix

### File: `supabase/functions/clickup-generate-copy-webhook/index.ts`

**Re-add Drive ID parsing from task description, with env var fallback:**

Around line 237 (where `textContent` and `idMatch` already exist), add a regex to extract the Drive ID from the description:

```
const driveIdMatch = textContent.match(/\bDrive ID:\s*([a-f0-9-]{36})/i);
const shadeDriveId = driveIdMatch ? driveIdMatch[1] : SHADE_DRIVE_ID;
```

Then on line 256, change the URL from using `SHADE_DRIVE_ID` to `shadeDriveId`:

```
const shadeUrl = `https://api.shade.inc/assets/${shadeAssetId}/transcription/file?drive_id=${shadeDriveId}&type=txt`;
```

Also update the guard on line 252 to use `shadeDriveId`:

```
if (shadeAssetId && SHADE_API_KEY && shadeDriveId) {
```

This way each task uses its own Drive ID (which is what Shade requires for permissions), falling back to the secret if the description doesn't contain one.

### Deployment
Redeploy `clickup-generate-copy-webhook`.
