/**
 * TermsAcceptanceGate — modal that fires when the signed-in user
 * hasn't accepted the current T&C version.
 *
 * Mounted once near the top of the app shell. When `needsAcceptance`
 * is true, it renders a non-dismissible Dialog. The user can either:
 *   - Accept   → write terms_version + terms_accepted_at to profiles, close modal
 *   - Decline  → sign out (the app is not usable without acceptance)
 *
 * Quiet on:
 *   - Public pages (/auth, /auth/reset, /event/:slug, /terms, /pricing,
 *     /welcome) — those are reachable before the user has a session, so
 *     useAuth().user is null and the hook returns needsAcceptance=false
 *     anyway. The explicit pathname allowlist below handles the edge case
 *     of an admin who lands on /terms specifically to read the doc — we
 *     don't want to pop a modal ON TOP of the doc they're trying to read.
 *
 * Scrollable preview of the markdown is in-place (so the user can
 * scan the doc before clicking Accept) plus an "Open full page" link
 * for a more comfortable read.
 */

import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArticleMarkdown } from '@/components/support/ArticleMarkdown';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { useAuth } from '@/hooks/useAuth';
import { TERMS_BODY, TERMS_LAST_UPDATED, TERMS_VERSION } from '@/content/legal';

// Routes where the gate should NOT pop, even for a signed-in user
// whose acceptance is stale. Mostly the legal page itself + public
// surfaces. Pathname-prefix match is `startsWith`.
const SILENT_PATHS = [
  '/terms',
  '/auth',
  '/event/',
  '/welcome',
  '/pricing',
];

function isSilentPath(pathname: string): boolean {
  return SILENT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/') || (p.endsWith('/') && pathname.startsWith(p)));
}

export function TermsAcceptanceGate() {
  const { needsAcceptance, accept, accepting, previousVersion } = useTermsAcceptance();
  const { signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Sync the open state to needsAcceptance, but only when we're on a
  // non-silent route. This lets the user navigate to /terms to read
  // the full doc, then come back and the modal will pop again on
  // a real app surface.
  useEffect(() => {
    if (needsAcceptance && !isSilentPath(location.pathname)) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [needsAcceptance, location.pathname]);

  const handleAccept = async () => {
    try {
      await accept();
      toast.success('Terms accepted. Thanks!');
      setOpen(false);
    } catch (err) {
      toast.error('Could not save your acceptance', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  };

  const handleDecline = async () => {
    // Decline = sign out. The app is not usable without acceptance.
    try {
      await signOut();
    } catch {
      // ignore — the AuthProvider will reset state on its own
    }
  };

  // Re-consent (user accepted an earlier version) vs first-time consent
  const title = previousVersion ? 'Updated Terms and Conditions' : 'Terms and Conditions';
  const intro = previousVersion
    ? `We've updated our terms since you last accepted them. The current version (${TERMS_LAST_UPDATED}, v${TERMS_VERSION}) is below. Please review and accept to continue using REOP.`
    : `Before you continue, please review and accept our Terms and Conditions (${TERMS_LAST_UPDATED}, v${TERMS_VERSION}).`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block dismissal by clicking outside or pressing Escape.
        // The user must click Accept or Decline.
        if (next === false) return;
        setOpen(next);
      }}
    >
      <DialogContent
        // Wide + tall enough to hold a real read of the doc on desktop;
        // falls back to viewport limits on mobile so it doesn't overflow.
        className="max-w-3xl w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] p-0 gap-0"
        // Hide the default close (X) button — this dialog is non-dismissible
        // until the user makes a choice.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="text-[20px] font-display tracking-tight text-reop-dark-blue">
            {title}
          </DialogTitle>
          <DialogDescription className="text-[13.5px] text-muted-foreground leading-relaxed pt-1">
            {intro}{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener"
              className="text-primary hover:underline font-medium"
            >
              Open full page →
            </Link>
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4 max-h-[55vh] border-b border-border bg-background">
          <ArticleMarkdown body={TERMS_BODY} />
        </div>

        <div className="px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleDecline}
            disabled={accepting}
          >
            Decline & sign out
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="min-w-[180px]"
          >
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'I accept the Terms'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
