/**
 * RouteGuard — minimal route-level access wrapper.
 *
 * Usage:
 *   <Route path="/transactions" element={
 *     <RouteGuard route="/transactions">
 *       <Transactions />
 *     </RouteGuard>
 *   } />
 *
 * Reads `useFeatureAccess.hasAccess(route)` and:
 *   - Renders children if allowed
 *   - Redirects to fallback path (default '/') with a toast if not
 *   - Renders nothing while role is loading (avoids a flash of redirect)
 *
 * The sidebar already hides off-limits items; this is a belt-and-suspenders
 * defense for direct URL access (bookmarks, emailed links, etc.).
 */

import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useToast } from '@/hooks/use-toast';

interface RouteGuardProps {
  /** The route key as it appears in useFeatureAccess.ROUTE_MIN_TIER. */
  route: string;
  /** Where to redirect when access is denied. Defaults to '/'. */
  redirectTo?: string;
  children: React.ReactNode;
}

export function RouteGuard({ route, redirectTo = '/', children }: RouteGuardProps) {
  const { hasAccess, loading } = useFeatureAccess();
  const { toast } = useToast();
  const allowed = hasAccess(route);

  useEffect(() => {
    if (!loading && !allowed) {
      toast({
        title: 'Restricted page',
        description: 'This area is only available on a higher plan. Contact your admin if this looks wrong.',
        variant: 'destructive',
      });
    }
  }, [loading, allowed, toast]);

  // Don't flash a redirect while we're still resolving the role.
  if (loading) return null;
  if (!allowed) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
