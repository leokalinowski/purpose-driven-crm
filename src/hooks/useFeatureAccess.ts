import { useUserRole } from './useUserRole';

type Tier = 'core' | 'managed' | 'agent' | 'admin' | 'editor';

const TIER_LEVEL: Record<Tier, number> = {
  admin: 1,
  editor: 2,
  agent: 3,
  managed: 4,
  core: 5,
};

/**
 * Maps each route to the minimum tier required.
 * Routes not listed here are accessible to everyone.
 */
const ROUTE_MIN_TIER: Record<string, Tier> = {
  // Core routes (accessible to all tiers)
  '/': 'core',
  '/spheresync-tasks': 'core',
  '/database': 'core',
  '/coaching': 'core',
  '/newsletter': 'core',
  '/support': 'core',
  // Managed routes
  '/events': 'managed',
  '/social-scheduler': 'managed',
  '/pipeline': 'managed',
};

function getTierLevel(role: string | null): number {
  if (!role) return 99;
  return TIER_LEVEL[role as Tier] ?? 99;
}

export function useFeatureAccess() {
  const { role, isAdmin, loading } = useUserRole();

  /** Check if the current user can access a given route */
  const hasAccess = (route: string): boolean => {
    // Admins, editors, and agents always have full access
    if (isAdmin || role === 'editor' || role === 'agent') return true;

    const minTier = ROUTE_MIN_TIER[route];
    // If route isn't gated, allow access
    if (!minTier) return true;

    return getTierLevel(role) <= getTierLevel(minTier);
  };

  /** Get the minimum tier label for a route (for display) */
  const getRequiredTier = (route: string): string | null => {
    return ROUTE_MIN_TIER[route] ?? null;
  };

  return {
    hasAccess,
    getRequiredTier,
    currentTier: role,
    loading,
  };
}
