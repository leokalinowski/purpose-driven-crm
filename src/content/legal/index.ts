// src/content/legal/index.ts
//
// Single source of truth for the T&C version + raw markdown body.
//
// VERSION CONVENTION
//   The TERMS_VERSION string is a calendar date in YYYY-MM-DD form
//   matching the "Last Updated" line at the top of terms.md. When the
//   legal text changes materially, bump BOTH the date in the markdown
//   AND the constant below. The acceptance gate prompts any user whose
//   stored `profiles.terms_version` doesn't match the current value.
//
// MARKDOWN LOADING
//   `terms.md` is imported via Vite's `?raw` query so the source-of-
//   truth lives in a real .md file (easy to view, diff, copy-edit)
//   rather than escaped inside a string literal.

// `?raw` is a Vite primitive — the import returns the file contents as
// a string at build time. No runtime fetch.
import termsBody from './terms.md?raw';

/**
 * The version of the currently-shipping T&C. Format: YYYY-MM-DD,
 * matching the "Last Updated" line at the top of terms.md. Bump this
 * AND the date in the markdown whenever the legal text changes
 * materially; users with a stale `profiles.terms_version` will be
 * re-prompted to accept on next sign-in.
 */
export const TERMS_VERSION = '2026-05-06';

/** Human-readable version label shown in UI. Mirrors TERMS_VERSION. */
export const TERMS_LAST_UPDATED = 'May 6, 2026';

/** The raw markdown body of the Terms and Conditions. */
export const TERMS_BODY: string = termsBody;
