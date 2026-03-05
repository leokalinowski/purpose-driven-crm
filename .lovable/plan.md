## SphereSync and DNC API Review — COMPLETED

All fixes from the approved plan have been implemented and deployed.

### Fixes Applied

| # | Issue | Status |
|---|-------|--------|
| 1 | Set `verify_jwt = false` for DNC functions | ✅ Done — `supabase/config.toml` |
| 2 | Allow agents to run DNC checks on their own contacts | ✅ Done — `dnc-monthly-check/index.ts` |
| 5 | Don't update `dnc_last_checked` on API failure | ✅ Done — `dnc-monthly-check/index.ts` |
| 6 | Use `user_roles` table instead of `profiles.role` | ✅ Done — `dnc-monthly-check/index.ts` |
| 7 | Import shared CORS headers in email function | ✅ Done — `spheresync-email-function/index.ts` |
| 8 | Use `getClaims()` instead of `getUser()` in generate-tasks | ✅ Done — `spheresync-generate-tasks/index.ts` |
| 9 | Consolidate duplicated letter mappings into shared module | ✅ Done — `_shared/spheresync-config.ts` |
| 10 | Modernize `dnc-single-check` to `Deno.serve()` | ✅ Done — `dnc-single-check/index.ts` |
