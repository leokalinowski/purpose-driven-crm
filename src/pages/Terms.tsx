/**
 * Terms.tsx — public-facing T&C page.
 *
 * Renders the markdown from `src/content/legal/terms.md` (single source
 * of truth) via the existing `ArticleMarkdown` styled wrapper. Lives at
 * `/terms` and is accessible to anyone (signed-in or not) — it has to
 * be reachable from the auth/signup flow before the user has an account,
 * and from a footer link inside the app shell afterwards.
 *
 * Has a small sticky header with a Back button. No Layout wrapper —
 * the rest of the agent shell isn't relevant on a legal-text page.
 */

import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';

import { ArticleMarkdown } from '@/components/support/ArticleMarkdown';
import { Button } from '@/components/ui/button';
import { TERMS_BODY, TERMS_LAST_UPDATED, TERMS_VERSION } from '@/content/legal';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Terms and Conditions · REOP</title>
        <meta
          name="description"
          content={`SphereSync / REOP Terms and Conditions. Last updated ${TERMS_LAST_UPDATED}.`}
        />
      </Helmet>

      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-5 md:px-8 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // history.back() falls through to "/" if there's no prior
              // entry (e.g. someone landed directly on /terms).
              if (window.history.length > 1) navigate(-1);
              else navigate('/');
            }}
            className="gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <span className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            v{TERMS_VERSION}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-14">
        <ArticleMarkdown body={TERMS_BODY} />
      </main>
    </div>
  );
}
