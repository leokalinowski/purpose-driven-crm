

# Fix OpenToClose API Connection — Wrong Endpoint & Auth Method

## Root Cause

The edge function logs show clearly:
```
OpenToClose API error: 404 {"detail":"Not Found"}
```

**Two critical bugs in `opentoclose-sync/index.ts`:**

1. **Wrong endpoint**: The code calls `https://api.opentoclose.com/v1/deals` — but OTC has no `/deals` endpoint. In OpenToClose, transactions are called **Properties** and the correct endpoint is `https://api.opentoclose.com/v1/properties`.

2. **Wrong authentication**: The code sends `X-API-Key` as a header, but OTC uses a **query string parameter**: `?api_token=YOUR_TOKEN`. This is documented at [docs.opentoclose.com](https://docs.opentoclose.com/).

3. **Wrong data mapping**: OTC Properties don't return flat fields like `sale_price`, `gci`, `client_name`. Instead they return a `field_values` array of `{key, value, label}` objects (e.g., `contract_title`, `contract_status`, `property_address`). Each property also has `agent_id`, `agent_name`, `team_user_name` at the top level.

## Changes

### `supabase/functions/opentoclose-sync/index.ts`

**Fix `fetchOtcDeals`:**
- Change URL from `/v1/deals` to `/v1/properties`
- Move API token from `X-API-Key` header to `?api_token=` query parameter
- Paginate with `offset` + `limit` (max 50 per call) to fetch all properties
- Log the raw response structure on first call for debugging

**Fix `mapDealToTransaction`:**
- Add a helper `getFieldValue(property, key)` that extracts values from the `field_values` array by key
- Map OTC field keys to our schema:
  - `contract_title` → used for display
  - `contract_status` → maps to `transaction_stage` (Active/Pending → under_contract, Closed → closed)
  - `contract_client_type` → maps to `transaction_type` (Buyer/Seller)
  - `property_address`, `property_city`, `property_state`, `property_zip` → concatenated into `property_address`
  - `agent_name` / `agent_id` (top-level fields) → used for agent matching
- Use OTC `agent_name` to match against Hub profiles by name (since OTC agent IDs won't match Supabase UUIDs)

**Fix agent matching in team sync:**
- Instead of blindly assigning all deals to every agent, fetch OTC agents list (`/v1/agents`) to get their names/emails
- Match OTC `agent_name` or `agent_id` to Hub profiles by email or name
- Only assign properties to the matched agent

**Add discovery/debug endpoint:**
- When called with `mode: 'discover'`, return raw OTC response + field keys so we can see exactly what fields your account uses (field keys are customizable per OTC account)

### `supabase/functions/opentoclose-sync/index.ts` — also fetch property contacts
- For each property, call `/v1/properties/{id}/contacts` to get client names (buyer/seller contacts)
- Rate-limit to 1 request/second per OTC docs

## Implementation Order
1. Fix auth method (query string) and endpoint (`/properties`) — deploy and test
2. Add discover mode to log raw field structure from your account
3. Update field mapping based on actual field keys from your OTC account
4. Fix agent matching using OTC agent names/emails → Hub profiles
5. Add pagination to fetch all properties (not just first 20)

