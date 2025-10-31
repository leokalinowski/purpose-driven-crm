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

    // DO NOT delete localStorage - let Supabase manage its own session storage
  } catch (_) {
    // no-op
  }
}
