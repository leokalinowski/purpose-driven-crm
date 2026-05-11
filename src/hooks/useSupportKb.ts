/**
 * useSupportKb — hooks for the support knowledge base.
 *
 * Three surfaces:
 *   - useSupportCategories()       → list + admin CRUD (admin-gated by RLS)
 *   - useSupportArticles()         → list (filterable, includes admin draft view)
 *   - useArticleBySlug(slug)       → single article + view tracking
 *   - useArticleSearch()           → debounced FTS via the support-search edge fn
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';

// ── Tier gating ────────────────────────────────────────────────────────
//
// Articles carry a `min_tier` ('core' | 'agent' | 'admin'). Core users
// don't see Agent-only articles; nobody but admins sees admin-only ones.
// The order matters — `admin` is the most permissive (sees everything),
// `core` is the most restricted.

type ArticleTier = 'core' | 'agent' | 'admin';

const TIER_RANK: Record<ArticleTier, number> = { core: 1, agent: 2, admin: 3 };

/** Tiers an article must satisfy for the given user role. */
function visibleTiers(role: string | null, isAdmin: boolean): ArticleTier[] {
  if (isAdmin) return ['core', 'agent', 'admin'];
  // 'agent' DB role + 'editor' = Agent-tier docs visible.
  if (role === 'agent' || role === 'editor') return ['core', 'agent'];
  // Core and anything unrecognized = only Core-tier docs.
  return ['core'];
}

void TIER_RANK; // exported helpers below use the array form, kept as a reference

// ── Types ──────────────────────────────────────────────────────────────

export interface SupportCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_token: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Live count of published articles in this category. Populated by useSupportCategories. */
  article_count?: number;
}

export interface SupportArticle {
  id: string;
  slug: string;
  category_id: string;
  title: string;
  summary: string | null;
  body: string;
  tags: string[];
  is_published: boolean;
  is_featured: boolean;
  /** Lowest tier that sees this article. Core users only see 'core'; Agent
   *  tier sees 'core' + 'agent'; admins see everything. */
  min_tier: ArticleTier;
  view_count: number;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category_id: string;
  category_slug: string;
  category_name: string;
  snippet: string;     // ts_headline result
  rank: number;        // higher = more relevant
}

// ── useSupportCategories ──────────────────────────────────────────────

export function useSupportCategories(opts?: { withCounts?: boolean; includeEmpty?: boolean }) {
  const { role, isAdmin } = useUserRole();
  const tiers = visibleTiers(role, isAdmin);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support_categories', { withCounts: !!opts?.withCounts, includeEmpty: !!opts?.includeEmpty, tiers }],
    queryFn: async () => {
      const { data: cats, error: catErr } = await supabase
        .from('support_categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (catErr) throw catErr;
      const list = (cats ?? []) as SupportCategory[];

      // Always count articles visible to this user — used both for the
      // display badge and for filtering empty categories out by default.
      const { data: counts, error: countErr } = await supabase
        .from('support_articles')
        .select('category_id, min_tier')
        .eq('is_published', true)
        .in('min_tier', tiers);
      if (countErr) throw countErr;
      const byCat = new Map<string, number>();
      for (const row of counts ?? []) {
        byCat.set(row.category_id, (byCat.get(row.category_id) ?? 0) + 1);
      }
      const withCounts = list.map((c) => ({ ...c, article_count: byCat.get(c.id) ?? 0 }));
      // Hide categories with zero visible articles unless the caller asks
      // for empties (admin browsing).
      if (opts?.includeEmpty) return withCounts;
      return withCounts.filter((c) => (c.article_count ?? 0) > 0);
    },
    staleTime: 60_000,
  });
  return { categories: data ?? [], isLoading, error, refetch };
}

// ── useSupportArticles (list) ─────────────────────────────────────────

interface ArticlesFilter {
  /** Restrict to a category id. Undefined = all categories. */
  categoryId?: string;
  /** Only featured (Top FAQs). */
  featuredOnly?: boolean;
  /** Include drafts (admins only — RLS already enforces). Default false. */
  includeDrafts?: boolean;
  /** Cap result count. Default 50. */
  limit?: number;
}

export function useSupportArticles(filter: ArticlesFilter = {}) {
  const { role, isAdmin } = useUserRole();
  const tiers = visibleTiers(role, isAdmin);
  // includeDrafts implies an admin browsing the management UI; in that case
  // skip the tier filter so admins see EVERY article regardless of gating.
  const skipTierFilter = !!filter.includeDrafts;

  const queryKey = ['support_articles', filter, { tiers, skipTierFilter }];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from('support_articles').select('*');
      if (filter.categoryId) q = q.eq('category_id', filter.categoryId);
      if (filter.featuredOnly) q = q.eq('is_featured', true);
      if (!filter.includeDrafts) q = q.eq('is_published', true);
      if (!skipTierFilter) q = q.in('min_tier', tiers);
      q = q
        .order('is_featured', { ascending: false })
        .order('view_count', { ascending: false })
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(filter.limit ?? 50);
      const { data: rows, error: qErr } = await q;
      if (qErr) throw qErr;
      return (rows ?? []) as SupportArticle[];
    },
    staleTime: 30_000,
  });
  return { articles: data ?? [], isLoading, error, refetch };
}

// ── useArticleBySlug ──────────────────────────────────────────────────

export function useArticleBySlug(slug: string | undefined) {
  const { role, isAdmin } = useUserRole();
  const tiers = visibleTiers(role, isAdmin);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support_article', slug, { isAdmin, tiers }],
    enabled: !!slug,
    queryFn: async () => {
      if (!slug) return null;
      let q = supabase.from('support_articles').select('*').eq('slug', slug);
      if (!isAdmin) {
        q = q.eq('is_published', true).in('min_tier', tiers);
      }
      const { data: row, error: qErr } = await q.maybeSingle();
      if (qErr) throw qErr;
      // Fire-and-forget view bump (RPC) — only for published articles the
      // user is actually allowed to see.
      if (row?.is_published) {
        supabase.rpc('bump_support_article_view', { p_slug: slug }).then(({ error: rpcErr }) => {
          if (rpcErr) console.warn('[support] bump_support_article_view failed:', rpcErr.message);
        });
      }
      return row as SupportArticle | null;
    },
    staleTime: 30_000,
  });
  return { article: data ?? null, isLoading, error, refetch };
}

// ── useArticleSearch (debounced FTS) ──────────────────────────────────

export function useArticleSearch() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce 220ms — snappy without flooding the edge fn while typing.
  useEffect(() => {
    if (query.trim().length < 2) {
      setDebounced('');
      setHits([]);
      return;
    }
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    setSearching(true);
    setError(null);
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('support-search', {
          body: { q: debounced, limit: 8 },
        });
        if (cancelled) return;
        if (fnErr) throw fnErr;
        setHits(((data as { hits?: SearchHit[] } | null)?.hits) ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  return { query, setQuery, hits, searching, error };
}

// ── Admin mutations: create / update / delete article ─────────────────

export interface ArticleDraft {
  slug: string;
  category_id: string;
  title: string;
  summary?: string | null;
  body?: string;
  tags?: string[];
  is_published?: boolean;
  is_featured?: boolean;
  /** Lowest tier that should see this. Defaults to 'core' (everyone). */
  min_tier?: ArticleTier;
}

export type { ArticleTier };

export function useArticleMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (draft: ArticleDraft) => {
      const { data, error } = await supabase
        .from('support_articles')
        .insert({
          slug: draft.slug,
          category_id: draft.category_id,
          title: draft.title,
          summary: draft.summary ?? null,
          body: draft.body ?? '',
          tags: draft.tags ?? [],
          is_published: draft.is_published ?? false,
          is_featured: draft.is_featured ?? false,
          min_tier: draft.min_tier ?? 'core',
        })
        .select()
        .single();
      if (error) throw error;
      return data as SupportArticle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support_articles'] });
      qc.invalidateQueries({ queryKey: ['support_categories'] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ArticleDraft> }) => {
      const { data, error } = await supabase
        .from('support_articles')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as SupportArticle;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['support_articles'] });
      qc.invalidateQueries({ queryKey: ['support_article'] });
      qc.invalidateQueries({ queryKey: ['support_categories'] });
      void vars;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('support_articles').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support_articles'] });
      qc.invalidateQueries({ queryKey: ['support_categories'] });
    },
  });

  return { create, update, remove };
}

// ── Tiny slug helper used by both admin UI and the seed migrator ──────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

// Suppress unused-import warning when callers don't need `useMemo`.
void useMemo;
void useCallback;
