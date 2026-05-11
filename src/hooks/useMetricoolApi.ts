/**
 * useMetricoolApi — typed wrapper around the metricool-proxy edge function.
 *
 * Every Metricool REST call goes through here:
 *   await metricool({ method, path, query?, body? })
 *
 * The proxy ALWAYS returns 200 with `{ ok, status, data?, error?, detail? }`,
 * so we read the body to know whether to throw. supabase-js's auto-throw
 * on non-2xx would otherwise mask Metricool's actual error structure.
 *
 * Top-level helpers:
 *   listPosts(start, end)
 *   getAnalyticsAggregation(start, end)
 *   schedulePost(payload)
 *   deletePost(id)
 *   getBestTimes(provider)
 *   listConnections()
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Generic proxy response ──────────────────────────────────────────────

export interface MetricoolProxyResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  detail?: unknown;
}

export interface MetricoolCallParams {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  skipAuthInject?: boolean;
}

// ── Domain types ────────────────────────────────────────────────────────

export type MetricoolNetwork =
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'threads'
  | 'bluesky'
  | 'gmb';

export const ALL_NETWORKS: MetricoolNetwork[] = [
  'instagram', 'facebook', 'twitter', 'linkedin',
  'tiktok', 'youtube', 'pinterest', 'threads', 'bluesky', 'gmb',
];

export const NETWORK_LABEL: Record<MetricoolNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  gmb: 'Google Business',
};

/**
 * Network-specific character limits (post text). Used by the composer to
 * show a per-network counter. Conservative numbers — Metricool itself
 * doesn't auto-truncate; the API will reject overlimit posts.
 */
export const NETWORK_LIMITS: Record<MetricoolNetwork, number> = {
  instagram: 2200,
  facebook: 63206,
  twitter: 280,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  pinterest: 500,
  threads: 500,
  bluesky: 300,
  gmb: 1500,
};

export interface ScheduledPost {
  id?: string;
  uuid?: string;
  text: string;
  publicationDate: { dateTime: string; timezone?: string } | string;
  providers: Array<{ network: string; status?: string; mediaIds?: string[] }>;
  media?: Array<{ url: string; type?: string }>;
  status?: 'scheduled' | 'published' | 'failed' | 'draft';
  draft?: boolean;
  autoPublish?: boolean;
}

export interface AnalyticsAggregation {
  followers?: number;
  posts_count?: number;
  impressions?: number;
  engagement?: number;
  engagement_rate?: number;
  per_network?: Array<{
    network: MetricoolNetwork;
    followers?: number;
    posts?: number;
    impressions?: number;
    engagement?: number;
  }>;
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useMetricoolApi() {
  /** Generic proxy call. Throws on `ok: false` so callers can catch. */
  const call = useCallback(
    async <T = unknown>(params: MetricoolCallParams): Promise<T> => {
      const { data, error: invokeErr } = await supabase.functions.invoke<MetricoolProxyResponse<T>>(
        'metricool-proxy',
        {
          body: {
            method: params.method ?? 'GET',
            path: params.path,
            query: params.query,
            body: params.body,
            skipAuthInject: params.skipAuthInject,
          },
        },
      );
      if (invokeErr) {
        throw new Error(invokeErr.message);
      }
      if (!data) {
        throw new Error('Empty response from metricool-proxy');
      }
      if (!data.ok) {
        // NOT_CONNECTED is a known signal — let UI distinguish.
        const err = new Error(data.error ?? `Metricool ${data.status}`);
        (err as Error & { code?: string; status?: number; detail?: unknown }).code = data.error;
        (err as Error & { code?: string; status?: number; detail?: unknown }).status = data.status;
        (err as Error & { code?: string; status?: number; detail?: unknown }).detail = data.detail;
        throw err;
      }
      return data.data as T;
    },
    [],
  );

  // ── Typed convenience methods ────────────────────────────────────────

  /** GET /v2/scheduler/posts — list scheduled+published posts in a range. */
  const listPosts = useCallback(
    (start: string, end: string) =>
      call<ScheduledPost[]>({
        method: 'GET',
        path: '/v2/scheduler/posts',
        query: { start, end },
      }),
    [call],
  );

  /** POST /v2/scheduler/posts — schedule a new post. */
  const schedulePost = useCallback(
    (payload: ScheduledPost) =>
      call<ScheduledPost>({
        method: 'POST',
        path: '/v2/scheduler/posts',
        body: payload,
      }),
    [call],
  );

  /** DELETE /v2/scheduler/posts/{uuid} — remove a scheduled post. */
  const deletePost = useCallback(
    (uuid: string) =>
      call<unknown>({
        method: 'DELETE',
        path: `/v2/scheduler/posts/${encodeURIComponent(uuid)}`,
      }),
    [call],
  );

  /** GET /v2/scheduler/besttimes/{provider} — recommended posting times. */
  const getBestTimes = useCallback(
    (provider: MetricoolNetwork) =>
      call<{ times: Array<{ hour: number; score?: number }> }>({
        method: 'GET',
        path: `/v2/scheduler/besttimes/${provider}`,
      }),
    [call],
  );

  /** GET /v2/analytics/aggregation — high-level cross-network metrics. */
  const getAnalyticsAggregation = useCallback(
    (start: string, end: string) =>
      call<AnalyticsAggregation>({
        method: 'GET',
        path: '/v2/analytics/aggregation',
        query: { start, end },
      }),
    [call],
  );

  /** GET /v2/settings/brands — current brand state including connected networks. */
  const listConnections = useCallback(
    () =>
      call<Record<string, unknown>>({
        method: 'GET',
        path: '/v2/settings/brands',
      }),
    [call],
  );

  return {
    call,
    listPosts,
    schedulePost,
    deletePost,
    getBestTimes,
    getAnalyticsAggregation,
    listConnections,
  };
}
