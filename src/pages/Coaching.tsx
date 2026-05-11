/**
 * /coaching is deprecated — merged into /scoreboard.
 *
 * Kept as a redirect-only route so:
 *   - Bookmarks, emailed deep links, action-item action_urls, and the old
 *     sidebar entry all continue to land on a real page.
 *   - We don't have to touch every cross-page navigate('/coaching') call
 *     across the dashboard in lockstep with this merge.
 *
 * Everything that used to live here — check-in form, streak, recent
 * submissions — is now on the Scoreboard. The form is INLINE on that
 * page (no modal hop). Wins/challenges/must-do-task all live on the
 * scoreboard's "+ Add reflection" accordion.
 */

import { Navigate } from 'react-router-dom';

export default function Coaching() {
  return <Navigate to="/scoreboard" replace />;
}
