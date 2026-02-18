

# Fix: Sponsor Contact Insert Error

## Problem

When creating a new sponsor, the `sponsor_contacts` insert fails because the code sets `id: undefined` in the contact rows. Supabase sends this as `null`, which violates the `NOT NULL` constraint on the `id` column (which has a `gen_random_uuid()` default that only kicks in when the column is omitted entirely).

The same issue exists in the `updateSponsor` mutation (line 145).

## Solution

In `src/hooks/useSponsors.ts`, destructure out the `id` (and `sponsor_id`) fields from each contact before inserting, rather than setting them to `undefined`.

### Lines 119-122 (createSponsor)
Change from:
```ts
const rows = contacts.map((c) => ({ ...c, sponsor_id: data.id, id: undefined }));
```
To:
```ts
const rows = contacts.map(({ id, sponsor_id, ...c }) => ({ ...c, sponsor_id: data.id }));
```

### Lines 144-146 (updateSponsor)
Same fix:
```ts
const rows = contacts.map(({ id, sponsor_id, ...c }) => ({ ...c, sponsor_id: id_param }));
```

This ensures the `id` key is never sent to Supabase, allowing the database default (`gen_random_uuid()`) to generate it automatically.

