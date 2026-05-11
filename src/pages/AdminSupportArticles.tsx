/**
 * Admin → Support articles management.
 *
 * Admin-only page (gated by useUserRole + RouteGuard wrapper if added).
 * Lists every article (published + drafts), with inline filters by
 * category + status, and a side-sheet editor for full CRUD.
 *
 * Editor fields: slug (auto-generated from title, editable), title,
 * category, summary, body (markdown with a live-preview split toggle),
 * tags (comma input), is_published + is_featured toggles.
 *
 * Save invalidates the agent-facing queries so changes appear instantly
 * on /support.
 */

import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Loader2, Check, Eye, EyeOff, Star, Search,
  ExternalLink, AlertCircle, FileText, X,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useSupportCategories, useSupportArticles, useArticleMutations,
  slugify, type SupportArticle, type ArticleDraft, type ArticleTier,
} from '@/hooks/useSupportKb';
import { useToast } from '@/hooks/use-toast';
import { ArticleMarkdown } from '@/components/support/ArticleMarkdown';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'published' | 'draft' | 'featured';

export default function AdminSupportArticles() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  // Admin needs to see every category for the editor dropdown — bypass the
  // "hide empty" filter that agents get.
  const { categories } = useSupportCategories({ includeEmpty: true });
  const { articles, isLoading } = useSupportArticles({ includeDrafts: true, limit: 500 });
  const { create, update, remove } = useArticleMutations();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<SupportArticle | null>(null);

  // Filtered list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (statusFilter === 'published' && !a.is_published) return false;
      if (statusFilter === 'draft' && a.is_published) return false;
      if (statusFilter === 'featured' && !a.is_featured) return false;
      if (categoryFilter !== 'all' && a.category_id !== categoryFilter) return false;
      if (q) {
        const hay = `${a.title} ${a.summary ?? ''} ${a.slug} ${a.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [articles, statusFilter, categoryFilter, searchQuery]);

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      </Layout>
    );
  }
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-[500px] mx-auto rounded-xl border border-border bg-card p-8 text-center mt-12">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-base font-semibold text-reop-dark-blue mb-2">Admin only</h2>
          <p className="text-sm text-muted-foreground">This page manages the support knowledge base — admin access only.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Manage Support Articles — Admin</title>
      </Helmet>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <span className="eye-label">Admin · Support KB</span>
          <h1 className="font-display text-[clamp(1.5rem,2vw+0.5rem,2rem)] font-medium tracking-tighter leading-[1.15] text-reop-dark-blue mt-1.5">
            Knowledge base articles
          </h1>
          <p className="text-[13.5px] text-muted-foreground max-w-[560px] mt-1.5">
            Write, edit, and feature the articles agents see on the Support Hub. Drafts are invisible to agents until published.
          </p>
        </div>
        <Button onClick={() => { setEditorTarget(null); setEditorOpen(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New article
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, slug, tags…"
            className="h-9 pl-9 w-[260px]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px]">
          {(['all', 'published', 'draft', 'featured'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-[6px] rounded-[7px] text-[12.5px] transition-all capitalize',
                statusFilter === s
                  ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-muted-foreground ml-auto">
          {filtered.length} of {articles.length} articles
        </span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-reop-dark-blue mb-1">No articles match</h3>
          <p className="text-[13px] text-muted-foreground mb-4">Try different filters, or create your first article.</p>
          <Button size="sm" onClick={() => { setEditorTarget(null); setEditorOpen(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New article
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13.5px]">
            <thead className="bg-[hsl(210_20%_96%)] border-b border-border text-[11.5px] uppercase tracking-[0.05em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Title</th>
                <th className="text-left px-4 py-2.5 font-semibold">Category</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold">Tier</th>
                <th className="text-left px-4 py-2.5 font-semibold">Views</th>
                <th className="text-left px-4 py-2.5 font-semibold">Updated</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const cat = categories.find((c) => c.id === a.category_id);
                return (
                  <tr
                    key={a.id}
                    className="border-t border-border hover:bg-[hsl(210_20%_98.5%)] transition cursor-pointer"
                    onClick={() => { setEditorTarget(a); setEditorOpen(true); }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-reop-dark-blue truncate">{a.title}</span>
                        {a.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-400 flex-shrink-0" />}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">/{a.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-muted-foreground">{cat?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                        a.is_published
                          ? 'bg-[hsl(140_40%_92%)] text-reop-green'
                          : 'bg-yellow-100 text-yellow-800',
                      )}>
                        {a.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {a.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wide',
                        a.min_tier === 'core' && 'bg-[hsl(184_100%_93%)] text-primary',
                        a.min_tier === 'agent' && 'bg-amber-100 text-amber-800',
                        a.min_tier === 'admin' && 'bg-[hsl(210_20%_93%)] text-muted-foreground',
                      )}>
                        {a.min_tier === 'core' && 'Everyone'}
                        {a.min_tier === 'agent' && 'Agent+'}
                        {a.min_tier === 'admin' && 'Admin'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{a.view_count}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {new Date(a.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ArticleEditor
        open={editorOpen}
        target={editorTarget}
        categories={categories}
        onClose={() => { setEditorOpen(false); setEditorTarget(null); }}
        onCreate={async (draft) => {
          try {
            await create.mutateAsync(draft);
            toast({ title: 'Article created' });
            setEditorOpen(false);
            setEditorTarget(null);
          } catch (e) {
            toast({ title: 'Create failed', description: e instanceof Error ? e.message : 'unknown', variant: 'destructive' });
          }
        }}
        onUpdate={async (id, patch) => {
          try {
            await update.mutateAsync({ id, patch });
            toast({ title: 'Article updated' });
            setEditorOpen(false);
            setEditorTarget(null);
          } catch (e) {
            toast({ title: 'Update failed', description: e instanceof Error ? e.message : 'unknown', variant: 'destructive' });
          }
        }}
        onDelete={async (id) => {
          if (!confirm('Delete this article? This cannot be undone.')) return;
          try {
            await remove.mutateAsync(id);
            toast({ title: 'Article deleted' });
            setEditorOpen(false);
            setEditorTarget(null);
          } catch (e) {
            toast({ title: 'Delete failed', description: e instanceof Error ? e.message : 'unknown', variant: 'destructive' });
          }
        }}
        saving={create.isPending || update.isPending}
        deleting={remove.isPending}
      />
    </Layout>
  );
}

// ── Editor sheet ───────────────────────────────────────────────────────

interface EditorProps {
  open: boolean;
  target: SupportArticle | null;
  categories: { id: string; name: string; slug: string }[];
  onClose: () => void;
  onCreate: (draft: ArticleDraft) => Promise<void>;
  onUpdate: (id: string, patch: Partial<ArticleDraft>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
  deleting: boolean;
}

function ArticleEditor({ open, target, categories, onClose, onCreate, onUpdate, onDelete, saving, deleting }: EditorProps) {
  const isEdit = !!target;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [minTier, setMinTier] = useState<ArticleTier>('core');
  const [showPreview, setShowPreview] = useState(false);

  // Hydrate when opening.
  useEffect(() => {
    if (!open) return;
    if (target) {
      setTitle(target.title);
      setSlug(target.slug);
      setSlugTouched(true);
      setCategoryId(target.category_id);
      setSummary(target.summary ?? '');
      setBody(target.body);
      setTagsText(target.tags.join(', '));
      setIsPublished(target.is_published);
      setIsFeatured(target.is_featured);
      setMinTier((target.min_tier as ArticleTier) ?? 'core');
    } else {
      setTitle('');
      setSlug('');
      setSlugTouched(false);
      setCategoryId(categories[0]?.id ?? '');
      setSummary('');
      setBody('');
      setTagsText('');
      setIsPublished(false);
      setIsFeatured(false);
      setMinTier('core');
    }
    setShowPreview(false);
  }, [open, target, categories]);

  // Auto-slug from title until the admin manually edits the slug.
  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, slugTouched]);

  const tags = useMemo(
    () => tagsText.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsText],
  );

  async function handleSubmit() {
    if (!title.trim()) return;
    if (!slug.trim()) return;
    if (!categoryId) return;
    const draft: ArticleDraft = {
      slug: slug.trim(),
      category_id: categoryId,
      title: title.trim(),
      summary: summary.trim() || null,
      body,
      tags,
      is_published: isPublished,
      is_featured: isFeatured,
      min_tier: minTier,
    };
    if (isEdit && target) {
      await onUpdate(target.id, draft);
    } else {
      await onCreate(draft);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="sm:max-w-[640px] lg:max-w-[800px] w-full overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit article' : 'New article'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update the article body, status, or feature flag.'
              : 'Author a new knowledge-base article. Markdown body supported.'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 py-5">
          <div>
            <Label htmlFor="a-title" className="text-[12px] font-semibold">Title</Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How do I import contacts from KvCore?"
              maxLength={200}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="a-slug" className="text-[12px] font-semibold">Slug</Label>
            <Input
              id="a-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="auto-generated from title"
              maxLength={100}
              className="mt-1.5 font-mono text-[13px]"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Path: <code>/support/articles/<b>{slug || 'your-slug'}</b></code>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="a-cat" className="text-[12px] font-semibold">Category</Label>
              <select
                id="a-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="a-tags" className="text-[12px] font-semibold">Tags (comma-separated)</Label>
              <Input
                id="a-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="onboarding, csv, import"
                className="mt-1.5 text-[13px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="a-summary" className="text-[12px] font-semibold">Summary</Label>
            <Textarea
              id="a-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One-sentence summary shown on category cards and the FAQ list."
              rows={2}
              className="mt-1.5 resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="a-body" className="text-[12px] font-semibold">Body (Markdown)</Label>
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="text-[11.5px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                {showPreview ? <X className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showPreview ? 'Hide preview' : 'Show preview'}
              </button>
            </div>
            {showPreview ? (
              <div className="border border-border rounded-md px-4 py-3 bg-card min-h-[280px] max-h-[480px] overflow-y-auto">
                {body.trim() ? (
                  <ArticleMarkdown body={body} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Body is empty.</p>
                )}
              </div>
            ) : (
              <Textarea
                id="a-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                placeholder={'## Heading\n\nMarkdown body — supports **bold**, _italics_, lists, tables (GFM), `code`, and [links](https://example.com).'}
                className="font-mono text-[13px] resize-y min-h-[280px]"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center justify-between p-3 rounded-md border border-border bg-card cursor-pointer">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-primary" />
                  Published
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Visible to agents on /support
                </p>
              </div>
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
            </label>
            <label className="flex items-center justify-between p-3 rounded-md border border-border bg-card cursor-pointer">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  Featured
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Appears in Top FAQs section
                </p>
              </div>
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
            </label>
          </div>

          {/* Tier gating — controls which user tier sees this article on
             the Support Hub. Admin UI bypasses this filter regardless. */}
          <div>
            <Label htmlFor="a-tier" className="text-[12px] font-semibold">Visible to</Label>
            <select
              id="a-tier"
              value={minTier}
              onChange={(e) => setMinTier(e.target.value as ArticleTier)}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="core">All paying users (Core, Agent, Admin)</option>
              <option value="agent">Agent tier + Admin only (hide from Core)</option>
              <option value="admin">Admin staff only</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {minTier === 'core' && 'Everyone with a paid account sees this article.'}
              {minTier === 'agent' && 'Core users won\'t see it on /support. Use for Agent-only features (e.g. Social Scheduler).'}
              {minTier === 'admin' && 'Only admin staff see this. Use for ops-internal docs.'}
            </p>
          </div>

          {isEdit && target && target.is_published && (
            <Link
              to={`/support/articles/${target.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline self-start"
            >
              View on Support Hub
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between">
          {isEdit && target ? (
            <Button
              variant="outline"
              onClick={() => onDelete(target.id)}
              disabled={deleting || saving}
              className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || deleting || !title.trim() || !slug.trim() || !categoryId}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isEdit ? 'Save changes' : 'Create article'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
