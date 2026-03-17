

## Remove RSVP Stats from Public Event Page

The `RSVPStats` component is currently rendered on the public-facing `EventPublicPage.tsx` (lines ~133-141). This shows Total RSVPs, Confirmed count, Checked In count, and the Capacity bar to anyone visiting the RSVP link — information that should only be visible to agents/admins.

### Change

**File: `src/pages/EventPublicPage.tsx`** — Remove the `RSVPStats` rendering block (lines ~133-141) and clean up the unused `showStats` state and `RSVPStats` import. The component itself stays untouched since it's still used in the admin/agent RSVPManagement view.

Specifically:
- Remove `RSVPStats` import (line 9)
- Remove `showStats` state (line 53)
- Remove `setShowStats(true)` (line 63)
- Remove the `RSVPStats` JSX block (lines ~133-141)

