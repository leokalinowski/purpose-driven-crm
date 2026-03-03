

## Plan: Remove ClickUp folder creation from normal user event creation

The `addEvent` function (used by normal users) fires `clickup-create-event-folder` on every event creation. This should only happen in `addEventAsAdmin`. Normal users should only get Hub Tasks.

### Changes

**`src/hooks/useEvents.ts`** -- Remove the ClickUp folder invocation block (lines 206-212) from the `addEvent` function. Keep it only in `addEventAsAdmin` (lines 360-367), which is the admin-only path.

That's it -- one deletion, ~7 lines removed.

