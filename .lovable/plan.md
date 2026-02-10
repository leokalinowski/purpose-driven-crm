

# Fix: Remove `Bearer` Prefix from Shade API Authorization Header

## Root Cause (finally!)
The Shade API documentation states clearly:

> "There is no need to put Authorization Bearer. The Authorization header should be: `Authorization: sk_<<your key>>`"

Our code sends `Authorization: Bearer ${SHADE_API_KEY}`, but Shade expects `Authorization: ${SHADE_API_KEY}` (the key itself starts with `sk_` and goes directly into the header with no prefix).

This is why every Shade transcript fetch has returned 403 -- the `Bearer` prefix corrupts the authentication.

## Changes

### File: `supabase/functions/clickup-generate-copy-webhook/index.ts`

One-line fix. Change:
```typescript
Authorization: `Bearer ${SHADE_API_KEY}`,
```
To:
```typescript
Authorization: SHADE_API_KEY,
```

### File: `supabase/functions/clickup-social-ready-to-schedule/index.ts`

Same fix -- this function also uses `Bearer` with Shade. Change:
```typescript
Authorization: `Bearer ${SHADE_API_KEY}`,
```
To:
```typescript
Authorization: SHADE_API_KEY,
```

### Deployment
Redeploy both `clickup-generate-copy-webhook` and `clickup-social-ready-to-schedule`.

