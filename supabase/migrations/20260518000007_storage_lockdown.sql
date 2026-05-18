-- ============================================================
-- Storage: lock down public LIST policies + flip CSV bucket private
--
-- Audit finding (2026-05-18): five storage buckets that are
-- `public:true` ALSO have an explicit `Public can view ...` /
-- `Public read access ...` SELECT policy on `storage.objects`.
-- For a public bucket, direct URL fetches via
-- `/storage/v1/object/public/<bucket>/<path>` bypass RLS — so the
-- policy is NOT what enables `<img src>` to render headshots.
-- What the policy DOES enable is `storage.objects.list()`
-- enumeration via the API: an anonymous caller with the anon key
-- can `POST /storage/v1/object/list/<bucket>` and dump every file
-- path in the bucket. For `agent-assets` that's every agent's
-- headshot and logo filename; for `newsletter-assets` every
-- inline image; etc. Trade isn't worth it.
--
-- Frontend usage was audited (`grep -rn ".list(" src/` returns
-- zero storage.list calls) — every consumer is `.getPublicUrl()`,
-- which is pure client-side string concatenation and doesn't
-- touch RLS at all. Direct URL fetches will continue to work for
-- every bucket that stays `public:true`.
--
-- Separately: `newsletter-csvs` is `public:true` but its only
-- writer (the `upload-csv` edge fn, service_role) never serves
-- the file by URL after upload — the CSV is consumed server-side
-- by the newsletter pipeline. Flip it to `public:false` so the
-- raw CSVs (which can contain agent contact lists) stop being
-- world-fetchable by URL guessers.
-- ============================================================

-- ── 1. Drop the public LIST/SELECT policies on storage.objects ──
DROP POLICY IF EXISTS "Public can view agent assets"         ON storage.objects;
DROP POLICY IF EXISTS "Public can view backgrounds"          ON storage.objects;
DROP POLICY IF EXISTS "Public read access for assets"        ON storage.objects;
DROP POLICY IF EXISTS "Public read access for newsletter assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view sponsor logos"        ON storage.objects;

-- ── 2. newsletter-csvs: flip to private ──
-- CSV uploads can contain agent contact lists / PII. There's no
-- consumer that fetches them by URL — service_role reads them
-- internally for newsletter processing.
UPDATE storage.buckets SET public = false WHERE id = 'newsletter-csvs';
