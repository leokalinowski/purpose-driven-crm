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

    // Clear any stale auth-related items that might cause issues
    try {
      const storageKeys = Object.keys(localStorage);
      for (const key of storageKeys) {
        if (key.includes('sb-') && key.includes('-auth-token')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const parsed = JSON.parse(value);
              // If token is expired or invalid, remove it
              if (parsed.expires_at && parsed.expires_at < Date.now() / 1000) {
                localStorage.removeItem(key);
              }
            } catch {
              // If we can't parse it, it's corrupted - remove it
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  } catch (_) {
    // no-op
  }
}
