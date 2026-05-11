/**
 * SupportArticle — full article view at /support/articles/:slug.
 *
 * Renders the markdown body, shows category + featured pill, links back
 * to the Hub, and surfaces "still stuck? open a ticket" CTA at the
 * bottom. View tracking happens automatically inside useArticleBySlug.
 *
 * Admins viewing a draft see a yellow "Draft — not visible to agents" pill.
 */

import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Loader2, AlertCircle, MessageSquare, Eye } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { ArticleMarkdown } from '@/components/support/ArticleMarkdown';
import { useArticleBySlug, useSupportCategories } from '@/hooks/useSupportKb';

export default function SupportArticle() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { article, isLoading, error } = useArticleBySlug(slug);
  const { categories } = useSupportCategories();
  const category = article ? categories.find((c) => c.id === article.category_id) : null;

  return (
    <Layout>
      <Helmet>
        <title>{article ? `${article.title} — Support` : 'Support article'}</title>
      </Helmet>

      <div className="max-w-[820px] mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/support')}
          className="mb-4 -ml-3 text-muted-foreground hover:text-reop-dark-blue gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All articles
        </Button>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : error || !article ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-semibold text-reop-dark-blue mb-2">Article not found</h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-[420px] mx-auto">
              This article may have been moved, archived, or never published. Try searching from the Support Hub.
            </p>
            <Button asChild>
              <Link to="/support">Back to Support Hub</Link>
            </Button>
          </div>
        ) : (
          <>
            <header className="mb-6 pb-5 border-b border-border">
              <div className="flex items-center gap-2 mb-3 text-[12px]">
                {category && (
                  // Plain text — the in-page hash anchors were removed when
                  // we swapped inline category sections for the modal flow
                  // on /support. We could pass state to auto-open the
                  // modal, but agents arriving here from search rarely
                  // want a category-browse re-entry.
                  <span className="inline-flex items-center font-semibold uppercase tracking-[0.06em] text-primary text-[10.5px]">
                    {category.name}
                  </span>
                )}
                {article.is_featured && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Star className="w-3 h-3" />
                    Featured
                  </span>
                )}
                {!article.is_published && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                    Draft — not visible to agents
                  </span>
                )}
              </div>
              <h1 className="font-display text-[clamp(1.8rem,2.4vw+0.5rem,2.4rem)] font-medium tracking-[-0.035em] leading-[1.15] text-reop-dark-blue text-balance">
                {article.title}
              </h1>
              {article.summary && (
                <p className="mt-3 text-[15.5px] text-muted-foreground leading-[1.65] max-w-[640px]">
                  {article.summary}
                </p>
              )}
              <div className="mt-4 flex items-center gap-4 text-[11.5px] text-muted-foreground">
                {article.published_at && (
                  <span>
                    Published {new Date(article.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {article.view_count} view{article.view_count === 1 ? '' : 's'}
                </span>
              </div>
            </header>

            <ArticleMarkdown body={article.body} />

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="mt-8 pt-5 border-t border-border flex flex-wrap gap-1.5">
                {article.tags.map((t) => (
                  <span key={t} className="inline-block px-2 py-0.5 rounded-md bg-[hsl(210_20%_94%)] text-[11.5px] text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Still stuck? CTA */}
            <div className="mt-8 rounded-xl border border-primary/20 bg-reop-teal-soft/40 px-6 py-5 flex items-start gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="text-sm font-semibold text-reop-dark-blue">Still stuck?</div>
                <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">
                  Open a ticket and the team will pick it up.
                </p>
              </div>
              <Button asChild className="gap-1.5 flex-shrink-0">
                <Link to="/support#new-ticket">
                  Open a ticket
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
