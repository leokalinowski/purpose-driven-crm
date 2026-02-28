/**
 * Builds a redirect path to /auth that preserves the current location,
 * so after login the user returns to where they were.
 */
export function buildAuthRedirectPath(): string {
  const current = window.location.pathname + window.location.search + window.location.hash;
  // Don't encode a redirect to auth itself or root (it's the default)
  if (current === '/' || current === '/auth' || current.startsWith('/auth?')) {
    return '/auth';
  }
  return `/auth?redirect=${encodeURIComponent(current)}`;
}
