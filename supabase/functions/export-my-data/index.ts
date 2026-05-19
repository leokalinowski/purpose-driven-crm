// export-my-data — self-service "give me all my data" export.
//
// Maps to T&C §19 (Data Return and Deletion): "Customer may request
// export of certain Customer Data during the subscription term."
//
// Behavior:
//   - Caller must be authenticated (verify_jwt: true).
//   - Returns a single JSON document bundling every row across the
//     agent-scoped tables that belong to the caller.
//   - Each query runs through a user-context Supabase client so RLS
//     handles scope automatically — no per-table agent_id filter needed
//     in the function body. If a future table is added with proper RLS,
//     listing it below auto-exports its caller-owned rows.
//   - Response is a `Content-Disposition: attachment` JSON download so
//     the browser saves it directly. The frontend just navigates/fetches
//     the URL with the access token.
//
// Why a single JSON (not a zip of CSVs):
//   - Easiest format for legal/regulatory questions ("here's all of it").
//   - Self-describing — each table is a top-level key with an array of rows.
//   - Easy to re-import or post-process. A zip would add complexity for
//     no real-world benefit at the current ~3K row volume per agent.
//
// SECURITY
//   - verify_jwt: true at deploy time.
//   - Re-validates the JWT and derives `agent_id` from auth.getUser().
//   - All queries use the USER-context client (anon key + Authorization
//     header) so PostgREST runs them through RLS. We never use the
//     service-role key here — that would bypass RLS and let any caller
//     dump anyone else's data.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Tables to dump. Order is roughly: identity → relationships → activity
// → coaching → operations. Each table must have an RLS policy that
// limits SELECT to the caller's own rows.
const TABLES_TO_EXPORT = [
  // ── Identity & settings ──
  'profiles',
  'agent_marketing_settings',
  'agent_growth_goals',
  'agent_images',

  // ── The sphere itself ──
  'contacts',
  'contact_activities',

  // ── Pipeline + opportunity surface ──
  'opportunities',
  'opportunity_activities',
  'opportunity_notes',
  'opportunity_stage_history',
  'opportunity_tasks',
  'pipeline_tasks',
  'transactions',

  // ── SphereSync rotation tasks ──
  'spheresync_tasks',
  'spheresync_email_logs',

  // ── Coaching surface ──
  'coaching_submissions',
  'coaching_sessions',
  'coaching_reminder_logs',
  'agent_coaching_state',
  'agent_intelligence_snapshots',
  'agent_action_items',

  // ── Events ──
  'events',
  'event_tasks',

  // ── Outreach / compliance ──
  'email_logs',
  'dnc_logs',

  // ── Integrations ──
  'clickup_tasks',
  'metricool_brands',
  'metricool_links',

  // ── Misc ──
  'support_tickets',
  'announcement_dismissals',
] as const;

interface ExportBundle {
  schema_version: 1;
  exported_at: string;
  agent: { id: string; email: string | null };
  notes: string;
  // Tables present as top-level keys. Each value is either an array of
  // rows OR an `{ error: string }` object if that table's query failed
  // (we never want one bad table to nuke the whole export).
  data: Record<string, unknown[] | { error: string }>;
  // Per-table row counts for quick verification.
  counts: Record<string, number | null>;
}

async function fetchTable(client: SupabaseClient, table: string): Promise<{ rows: unknown[] } | { error: string }> {
  try {
    const { data, error } = await client.from(table).select('*');
    if (error) return { error: error.message };
    return { rows: data ?? [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  const cors = buildCorsHeaders(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // ── Auth ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Auth required' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  // User-context client — every query below runs through RLS as the
  // caller, so they only see their own rows. This is the security
  // backbone of this function: we do NOT use service_role here.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const agentId = userRes.user.id;
  const agentEmail = userRes.user.email ?? null;

  // ── Fetch every table in parallel ──
  // Parallel because each query is independent; if any fails, we
  // record the error in the bundle rather than aborting.
  const results = await Promise.all(
    TABLES_TO_EXPORT.map(async (table) => {
      const result = await fetchTable(userClient, table);
      return { table, result };
    }),
  );

  const data: ExportBundle['data'] = {};
  const counts: ExportBundle['counts'] = {};
  for (const { table, result } of results) {
    if ('error' in result) {
      data[table] = { error: result.error };
      counts[table] = null;
    } else {
      data[table] = result.rows;
      counts[table] = result.rows.length;
    }
  }

  const bundle: ExportBundle = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    agent: { id: agentId, email: agentEmail },
    notes:
      'This export contains every database row scoped to your account at the time of export. ' +
      'It does not include: file storage objects (headshots/logos — those have their own URLs), ' +
      'data from third-party integrations (Stripe billing details, Resend email events outside email_logs, ' +
      'Metricool analytics, etc.), or system audit logs that are retained for legal/compliance reasons. ' +
      'Tables that returned an error during the export are represented as { error: "..." } so you can ' +
      'see what was unavailable and retry. See T&C §19 for retention details.',
    data,
    counts,
  };

  const filename = `reop-data-${agentEmail?.replace(/[^a-zA-Z0-9]+/g, '-') ?? agentId}-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Pretty-printed JSON can be large; tell the browser it's downloadable
      // and not to try to render as a page.
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
