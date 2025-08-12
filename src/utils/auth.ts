// Auth utilities
// Provides helpers to clean up any residual auth parameters from the URL
// and remove potentially stale localStorage auth entries.

export function cleanupAuthState(): void {
  try {
    const url = new URL(window.location.href);
    let changed = false;

    // Remove problematic auth params from query string
    const paramsToDelete = [
      'error',
      'error_code',
      'error_description',
      'code',
      'access_token',
      'refresh_token',
      'provider_token',
      'token_type',
      'expires_in',
      'scope',
      'type',
    ];

    for (const key of paramsToDelete) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    // Clear hash fragments containing auth info
    if (window.location.hash && /(access_token|error|type=signup|type=recovery|type=magiclink)/i.test(window.location.hash)) {
      history.replaceState({}, '', `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}`);
    } else if (changed) {
      history.replaceState({}, '', `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ''}`);
    }

    // Remove known stale supabase auth storage keys
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('supabase.auth.')) toRemove.push(k);
      if (k.startsWith('sb-') && (k.endsWith('-auth-token') || k.includes('-auth-token.'))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch (_) {
    // no-op
  }
}
