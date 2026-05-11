/**
 * useSocialScheduler — Metricool-backed adapters that preserve the
 * pre-existing `Social*` types so the page + components don't have to
 * change. Same hook signatures, same return shapes; the data plane
 * underneath now talks to Metricool's REST API via the metricool-proxy
 * edge function.
 *
 * Hooks:
 *   - useSocialAccounts   → translates `metricool_brands.connected_networks`
 *                            into one SocialAccount per network
 *   - useSocialPosts      → calls /v2/scheduler/posts; expands a
 *                            multi-provider post into one SocialPost per
 *                            network so per-platform UI (calendar
 *                            entries etc.) works as before
 *   - useSocialAnalytics  → calls /v2/analytics/aggregation; returns one
 *                            SocialAnalytics row per network with the
 *                            window's totals
 *   - useSchedulePost     → POST /v2/scheduler/posts. Media files upload
 *                            to Supabase Storage first; we hand Metricool
 *                            the public URL (Metricool fetches it)
 *   - useRefreshAnalytics → invalidates the analytics cache (Metricool
 *                            does its own server-side aggregation)
 *   - useConnectSocialAccount → not supported on the current Metricool
 *                            tier; tells the agent to ask their admin
 *   - useCSVUpload        → schedules each row via /v2/scheduler/posts;
 *                            same UX, same response shape
 *
 * Postiz is gone — no more `social_accounts`, `social_posts`,
 * `social_analytics` table reads or `social-*` edge function calls.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// ── Types (UNCHANGED — components still import these) ───────────────────

export interface SocialAccount {
  id: string;
  agent_id: string;
  platform: string;
  account_name?: string;
  account_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  agent_id: string;
  platform: string;
  content: string;
  media_url?: string;
  media_type?: string;
  schedule_time: string;
  status: 'scheduled' | 'posted' | 'failed' | 'draft';
  posted_at?: string;
  postiz_post_id?: string; // kept for backwards compat — now holds Metricool uuid
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface SocialAnalytics {
  id: string;
  post_id?: string;
  agent_id: string;
  platform: string;
  metric_date: string;
  reach: number;
  impressions: number;
  followers: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

export interface NewPost {
  content: string;
  platforms: string[];
  schedule_time: string;
  media_file?: File;
  agent_id?: string;
}

export interface CSVPost {
  content: string;
  media_file?: string;
  schedule_time: string;
  platform: string;
}

// ── Internal: typed proxy call ──────────────────────────────────────────

interface MetricoolProxyResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  detail?: unknown;
}

async function metricool<T = unknown>(params: {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<MetricoolProxyResponse<T>>(
    'metricool-proxy',
    {
      body: {
        method: params.method ?? 'GET',
        path: params.path,
        query: params.query,
        body: params.body,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Empty response from metricool-proxy');
  if (!data.ok) {
    const err = new Error(data.error ?? `Metricool ${data.status}`);
    (err as Error & { code?: string; status?: number }).code = data.error;
    (err as Error & { code?: string; status?: number }).status = data.status;
    throw err;
  }
  return data.data as T;
}

// ── Domain helpers ──────────────────────────────────────────────────────

/** Map Metricool's provider/network slug → the same string the UI uses. */
const NETWORK_NORMALIZE: Record<string, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  twitter: 'twitter',
  x: 'twitter',
  tiktok: 'tiktok',
  youtube: 'youtube',
  pinterest: 'pinterest',
  threads: 'threads',
  bluesky: 'bluesky',
  gmb: 'gmb',
  gbp: 'gmb',
};

interface MetricoolBrandRow {
  agent_id: string;
  blog_id: number;
  brand_label: string | null;
  connected_networks: unknown;
  last_sync_at: string | null;
  updated_at: string;
}

function normalizeNetworks(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((n) => (typeof n === 'string' ? NETWORK_NORMALIZE[n.toLowerCase()] ?? n.toLowerCase() : null))
    .filter((n): n is string => !!n);
}

/** Metricool ScheduledPost shape we read; intentionally loose. */
interface MetricoolScheduledPost {
  id?: string;
  uuid?: string;
  text?: string;
  publicationDate?: { dateTime?: string; timezone?: string } | string;
  providers?: Array<{ network?: string; status?: string }>;
  media?: Array<{ url?: string; type?: string }>;
  status?: 'scheduled' | 'published' | 'failed' | 'draft';
  draft?: boolean;
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string;
}

function mapStatus(post: MetricoolScheduledPost, providerStatus?: string): SocialPost['status'] {
  if (post.draft) return 'draft';
  const s = (providerStatus ?? post.status ?? '').toLowerCase();
  if (s === 'published' || s === 'posted') return 'posted';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'draft') return 'draft';
  return 'scheduled';
}

function readDateTime(pd: MetricoolScheduledPost['publicationDate']): string {
  if (!pd) return new Date().toISOString();
  if (typeof pd === 'string') return pd;
  return pd.dateTime ?? new Date().toISOString();
}

/**
 * Expand a Metricool post into one SocialPost per provider (so per-platform
 * UI like the calendar shows distinct entries). Falls back to a single
 * 'all' row if no providers were declared (rare).
 */
function expandPost(post: MetricoolScheduledPost, agentId: string): SocialPost[] {
  const baseId = post.uuid ?? post.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dt = readDateTime(post.publicationDate);
  const created = post.createdAt ?? dt;
  const updated = post.updatedAt ?? created;
  const providers = post.providers ?? [];
  if (providers.length === 0) {
    return [{
      id: baseId,
      agent_id: agentId,
      platform: 'all',
      content: post.text ?? '',
      media_url: post.media?.[0]?.url,
      media_type: post.media?.[0]?.type,
      schedule_time: dt,
      status: mapStatus(post),
      posted_at: mapStatus(post) === 'posted' ? dt : undefined,
      postiz_post_id: baseId, // keep for back-compat
      error_message: post.errorMessage,
      created_at: created,
      updated_at: updated,
    }];
  }
  return providers.map((p, i) => {
    const platform = NETWORK_NORMALIZE[(p?.network ?? '').toLowerCase()] ?? p?.network ?? 'unknown';
    const status = mapStatus(post, p?.status);
    return {
      id: `${baseId}__${platform}__${i}`,
      agent_id: agentId,
      platform,
      content: post.text ?? '',
      media_url: post.media?.[0]?.url,
      media_type: post.media?.[0]?.type,
      schedule_time: dt,
      status,
      posted_at: status === 'posted' ? dt : undefined,
      postiz_post_id: baseId,
      error_message: post.errorMessage,
      created_at: created,
      updated_at: updated,
    };
  });
}

// ── Hooks (signatures unchanged; backend is now Metricool) ──────────────

/**
 * Returns one SocialAccount per connected network on the agent's brand.
 */
export const useSocialAccounts = (agentId?: string) => {
  const { user } = useAuth();
  const actualAgentId = agentId || user?.id;

  return useQuery({
    queryKey: ['social-accounts', actualAgentId],
    queryFn: async (): Promise<SocialAccount[]> => {
      if (!actualAgentId) return [];
      const { data, error } = await supabase
        .from('metricool_brands')
        .select('agent_id, blog_id, brand_label, connected_networks, last_sync_at, updated_at')
        .eq('agent_id', actualAgentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return [];
      const brand = data as MetricoolBrandRow;
      const nets = normalizeNetworks(brand.connected_networks);
      return nets.map((platform) => ({
        id: `${brand.blog_id}__${platform}`,
        agent_id: brand.agent_id,
        platform,
        account_name: brand.brand_label ?? undefined,
        account_id: String(brand.blog_id),
        created_at: brand.last_sync_at ?? brand.updated_at,
        updated_at: brand.updated_at,
      }));
    },
    enabled: !!actualAgentId,
  });
};

/**
 * Returns scheduled + draft + published + failed posts for a 90-day window
 * (last 30 + next 60), expanded per-platform.
 */
export const useSocialPosts = (agentId?: string) => {
  const { user } = useAuth();
  const actualAgentId = agentId || user?.id;

  return useQuery({
    queryKey: ['social-posts', actualAgentId],
    queryFn: async (): Promise<SocialPost[]> => {
      if (!actualAgentId) return [];
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const end = new Date();
      end.setDate(end.getDate() + 60);
      try {
        const raw = await metricool<unknown>({
          method: 'GET',
          path: '/v2/scheduler/posts',
          query: {
            start: start.toISOString().slice(0, 10),
            end: end.toISOString().slice(0, 10),
          },
        });
        const list: MetricoolScheduledPost[] = Array.isArray(raw)
          ? (raw as MetricoolScheduledPost[])
          : ((raw as { posts?: MetricoolScheduledPost[] })?.posts ?? []);
        return list.flatMap((p) => expandPost(p, actualAgentId));
      } catch (err) {
        const code = (err as Error & { code?: string })?.code;
        // NOT_CONNECTED is a known signal — show empty list rather than error
        if (code === 'NOT_CONNECTED') return [];
        throw err;
      }
    },
    enabled: !!actualAgentId,
  });
};

/**
 * Returns one SocialAnalytics row per connected network with the
 * 30-day-window totals from /v2/analytics/aggregation.
 */
export const useSocialAnalytics = (agentId?: string, startDate?: string, endDate?: string) => {
  const { user } = useAuth();
  const actualAgentId = agentId || user?.id;

  return useQuery({
    queryKey: ['social-analytics', actualAgentId, startDate, endDate],
    queryFn: async (): Promise<SocialAnalytics[]> => {
      if (!actualAgentId) return [];
      const end = endDate ?? new Date().toISOString().slice(0, 10);
      const startDefault = new Date();
      startDefault.setDate(startDefault.getDate() - 30);
      const start = startDate ?? startDefault.toISOString().slice(0, 10);

      try {
        const raw = await metricool<{
          followers?: number;
          posts_count?: number;
          impressions?: number;
          engagement?: number;
          engagement_rate?: number;
          per_network?: Array<{
            network?: string;
            followers?: number;
            posts?: number;
            impressions?: number;
            engagement?: number;
            engagement_rate?: number;
            reach?: number;
            likes?: number;
            comments?: number;
            shares?: number;
            clicks?: number;
          }>;
        }>({
          method: 'GET',
          path: '/v2/analytics/aggregation',
          query: { start, end },
        });
        const perNetwork = raw?.per_network ?? [];
        const today = new Date().toISOString();
        return perNetwork.map((row) => {
          const platform = NETWORK_NORMALIZE[(row.network ?? '').toLowerCase()] ?? row.network ?? 'unknown';
          return {
            id: `${actualAgentId}__${platform}__${end}`,
            agent_id: actualAgentId,
            platform,
            metric_date: end,
            reach: row.reach ?? 0,
            impressions: row.impressions ?? 0,
            followers: row.followers ?? 0,
            likes: row.likes ?? 0,
            comments: row.comments ?? 0,
            shares: row.shares ?? 0,
            engagement_rate: row.engagement_rate ?? 0,
            clicks: row.clicks ?? 0,
            created_at: today,
            updated_at: today,
          };
        });
      } catch (err) {
        const code = (err as Error & { code?: string })?.code;
        if (code === 'NOT_CONNECTED') return [];
        throw err;
      }
    },
    enabled: !!actualAgentId,
  });
};

/**
 * Schedules a multi-platform post on Metricool. Uploads any local media
 * file to Supabase Storage first; Metricool will fetch from the public
 * URL we hand it.
 */
export const useSchedulePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (newPost: NewPost) => {
      // 1. Upload media if a file was picked.
      let mediaPublicUrl: string | undefined;
      if (newPost.media_file) {
        const agentBucket = newPost.agent_id || user?.id || 'anonymous';
        const fileName = `${Date.now()}-${newPost.media_file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const path = `${agentBucket}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('social-media')
          .upload(path, newPost.media_file, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('social-media').getPublicUrl(path);
        mediaPublicUrl = pub?.publicUrl;
      }

      // 2. Build the Metricool payload.
      const isoLocal = new Date(newPost.schedule_time);
      if (Number.isNaN(isoLocal.getTime())) throw new Error('Invalid schedule time');
      const payload = {
        text: newPost.content,
        publicationDate: {
          dateTime: isoLocal.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        providers: newPost.platforms.map((network) => ({
          // Metricool expects the network slug; we already normalize on read.
          network: NETWORK_NORMALIZE[network.toLowerCase()] ?? network.toLowerCase(),
        })),
        media: mediaPublicUrl ? [{ url: mediaPublicUrl }] : undefined,
        autoPublish: true,
        draft: false,
      };

      // 3. Schedule.
      const result = await metricool<MetricoolScheduledPost>({
        method: 'POST',
        path: '/v2/scheduler/posts',
        body: payload,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({
        title: 'Post scheduled',
        description: 'Your post is queued and will publish at the scheduled time.',
      });
    },
    onError: (error: Error & { code?: string }) => {
      const detail = error.code === 'NOT_CONNECTED'
        ? 'Your social accounts aren\'t set up yet. Contact your admin.'
        : error.message;
      toast({
        title: 'Failed to schedule post',
        description: detail,
        variant: 'destructive',
      });
    },
  });
};

/**
 * CSV upload — schedules each row sequentially via Metricool. Returns the
 * same shape the UI expects: `{ success_count, error_count }`.
 */
export const useCSVUpload = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, agentId }: { file: File; agentId?: string }) => {
      const text = await file.text();
      // Tiny CSV parse — the original component used PapaParse on the client
      // before invoking the edge fn. Here we re-use the rows it would have
      // sent; the calling component (SocialCSVUpload) parses with PapaParse
      // and passes a parsed array via this hook's preview flow. To keep the
      // single-call contract working, we accept a CSV file directly and
      // parse minimally. Rows are: content, media_file, schedule_time, platform.
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        return { success_count: 0, error_count: 0 };
      }
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idx = (k: string) => header.indexOf(k);
      const cI = idx('content');
      const sI = idx('schedule_time');
      const pI = idx('platform');
      const mI = idx('media_file');
      if (cI < 0 || sI < 0 || pI < 0) {
        throw new Error('CSV must have columns: content, schedule_time, platform (media_file optional)');
      }

      let success = 0;
      let errors = 0;
      const rows = lines.slice(1);
      // Group rows by (content, schedule_time, media) so multi-platform posts
      // become one Metricool post with multiple providers.
      type Group = { content: string; schedule_time: string; media: string | undefined; platforms: string[] };
      const groups = new Map<string, Group>();
      for (const line of rows) {
        const cols = line.split(',');
        const content = (cols[cI] ?? '').trim();
        const schedule_time = (cols[sI] ?? '').trim();
        const platform = (cols[pI] ?? '').trim().toLowerCase();
        const media = mI >= 0 ? (cols[mI] ?? '').trim() : undefined;
        const key = `${content}|${schedule_time}|${media ?? ''}`;
        if (!groups.has(key)) groups.set(key, { content, schedule_time, media: media || undefined, platforms: [] });
        groups.get(key)!.platforms.push(platform);
      }

      const _agentId = agentId || user?.id;
      for (const g of groups.values()) {
        try {
          const isoLocal = new Date(g.schedule_time);
          if (Number.isNaN(isoLocal.getTime())) throw new Error('Bad date');
          await metricool({
            method: 'POST',
            path: '/v2/scheduler/posts',
            body: {
              text: g.content,
              publicationDate: {
                dateTime: isoLocal.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              },
              providers: g.platforms.map((network) => ({
                network: NETWORK_NORMALIZE[network] ?? network,
              })),
              media: g.media ? [{ url: g.media }] : undefined,
              autoPublish: true,
              draft: false,
            },
          });
          success++;
        } catch {
          errors++;
        }
      }
      void _agentId;
      return { success_count: success, error_count: errors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast({
        title: 'CSV processed',
        description: `${data.success_count} posts scheduled, ${data.error_count} errors.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to process CSV',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

/**
 * Connect a new social network. Not supported on the current Metricool
 * tier (requires WLI / Custom plan). Returns a friendly error toast
 * pointing the agent at their admin.
 */
export const useConnectSocialAccount = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (_args: { platform: string; agentId?: string }) => {
      throw new Error(
        'Adding new social accounts isn\'t self-serve yet. Reach out to your admin and they\'ll get the account linked for you.',
      );
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection unavailable',
        description: error.message,
        variant: 'default',
      });
    },
  });
};

/**
 * Refresh analytics — Metricool aggregates server-side, so this is just
 * an explicit cache invalidation that triggers a refetch.
 */
export const useRefreshAnalytics = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (_agentId?: string) => {
      // No upstream "refresh" call — Metricool computes analytics on demand.
      // Force the React Query cache to drop.
      await queryClient.invalidateQueries({ queryKey: ['social-analytics'] });
      return { ok: true };
    },
    onSuccess: () => {
      toast({
        title: 'Analytics refreshed',
        description: 'Latest metrics loaded.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to refresh analytics',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
