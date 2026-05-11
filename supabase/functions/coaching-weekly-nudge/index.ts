/**
 * coaching-weekly-nudge — cron-triggered.
 *
 * Drops an in-app Coach action item (agent_action_items) for every agent
 * who hasn't submitted a coaching check-in for the CURRENT ISO week.
 * Priority + copy escalate as the week ends:
 *
 *   Wednesday  → priority=low,    "Log your week — takes 90 seconds"
 *   Thursday   → priority=medium, "Don't lose your check-in streak"
 *   Friday     → priority=high,   "Last chance — submit before the weekend"
 *
 * Idempotent: keyed by `(agent_id, week_number, year, day_tag)` baked into
 * `action_url` so the same trigger can't fire twice per week. Also: if the
 * agent has already submitted that week, we DELETE any pending nudge tasks
 * for the week so they don't linger.
 *
 * Companion to (and partial replacement for) the existing email-only
 * `coaching-reminder`. The email cron stays — this in-app nudge is the
 * higher-leverage signal because agents work IN REOP, not in their inbox.
 *
 * Auth: cron-bypass via `X-Cron-Job: true`, or service-role JWT.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface NudgeRequest {
  /** Override the day tag (testing). Defaults to today's UTC weekday. */
  day_tag?: 'wednesday' | 'thursday' | 'friday';
  /** Force-run even if today isn't Wed/Thu/Fri. */
  force?: boolean;
}

interface DayConfig {
  tag: 'wednesday' | 'thursday' | 'friday';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
}

const DAY_CONFIGS: Record<number, DayConfig> = {
  // 0 = Sunday, 1 = Monday, etc. (UTC)
  3: { // Wednesday
    tag: 'wednesday',
    priority: 'low',
    title: '📊 Log your week — takes 90 seconds',
    description: 'Two days in — submit your check-in now to keep tomorrow\'s Coach signals sharp.',
  },
  4: { // Thursday
    tag: 'thursday',
    priority: 'medium',
    title: '⏳ Don\'t lose your check-in streak',
    description: 'Your streak resets if you skip this week. One quick form gets you to the weekend.',
  },
  5: { // Friday
    tag: 'friday',
    priority: 'high',
    title: '🚨 Last chance — submit before the weekend',
    description: 'Your numbers feed Monday\'s Coach plan. 90 seconds — log them now.',
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** ISO 8601 week number (1-53). Same logic as the frontend's getCurrentWeekNumber. */
function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday in current week decides the year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Auth gate
  const isCronCall = req.headers.get('X-Cron-Job') === 'true' || req.headers.get('x-cron-job') === 'true';
  const authHeader = req.headers.get('authorization') ?? '';
  const isServiceRole =
    authHeader.toLowerCase().startsWith('bearer ') &&
    authHeader.slice(7).trim() === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!isCronCall && !isServiceRole) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  // Parse optional body for testing overrides.
  let body: NudgeRequest = {};
  if (req.method === 'POST') {
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {/* ignore */}
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const { week: weekNumber, year } = isoWeek(now);

  // Pick the day config. UTC weekday is fine — the cron schedules at 13:00
  // UTC which is 9am ET regardless of DST drift.
  let dayConfig: DayConfig | undefined;
  if (body.day_tag) {
    dayConfig = Object.values(DAY_CONFIGS).find((c) => c.tag === body.day_tag);
  } else {
    dayConfig = DAY_CONFIGS[now.getUTCDay()];
  }
  if (!dayConfig && !body.force) {
    return jsonResponse({
      ok: true,
      skipped: 'today is not a configured nudge day',
      utc_weekday: now.getUTCDay(),
    });
  }
  if (!dayConfig) {
    // force=true with no day_tag — default to Friday (most aggressive) for tests.
    dayConfig = DAY_CONFIGS[5];
  }

  // ── Step 1: pull all agents that should be nudged ──
  // Includes each agent's notification + timezone prefs (Settings →
  // Notifications). Agents who opted out of in-app reminders, or are
  // currently inside their quiet-hours window, are filtered before insert.
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, role, notify_in_app, timezone, quiet_hours_start, quiet_hours_end')
    .in('role', ['agent', 'admin']);
  if (profErr) {
    console.error('[coaching-weekly-nudge] profile load failed:', profErr);
    return jsonResponse({ ok: false, error: profErr.message }, 500);
  }
  interface AgentPref {
    user_id: string;
    notify_in_app: boolean | null;
    timezone: string | null;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
  }
  const agentPrefs: AgentPref[] = (profiles ?? []) as AgentPref[];
  const agentIds = agentPrefs.map((p) => p.user_id);
  const prefByAgent = new Map<string, AgentPref>(agentPrefs.map((p) => [p.user_id, p]));

  /**
   * Returns true if `now` is INSIDE the user's quiet-hours window in their
   * local timezone. Both start/end are hours 0-23 in local time. Windows
   * that wrap midnight (e.g. start=21, end=7) are supported.
   */
  function isQuietNow(pref: AgentPref): boolean {
    const start = pref.quiet_hours_start ?? 21;
    const end = pref.quiet_hours_end ?? 7;
    if (start === end) return false; // disabled
    const tz = pref.timezone || 'America/New_York';
    let localHour: number;
    try {
      // Intl ✓ — supported in Deno + edge runtime.
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      }).format(now);
      localHour = parseInt(hourStr, 10);
      if (Number.isNaN(localHour)) localHour = now.getUTCHours();
    } catch {
      localHour = now.getUTCHours();
    }
    return start < end ? localHour >= start && localHour < end : localHour >= start || localHour < end;
  }

  // ── Step 2: pull agents who already submitted current week ──
  const { data: submitted, error: subErr } = await supabase
    .from('coaching_submissions')
    .select('agent_id')
    .eq('week_number', weekNumber)
    .eq('year', year)
    .in('agent_id', agentIds);
  if (subErr) {
    console.error('[coaching-weekly-nudge] submission load failed:', subErr);
    return jsonResponse({ ok: false, error: subErr.message }, 500);
  }
  const submittedSet = new Set((submitted ?? []).map((r: { agent_id: string }) => r.agent_id));
  const needsNudge = agentIds.filter((id) => !submittedSet.has(id));

  // ── Step 3: insert nudges (idempotent via action_url stamping) ──
  // Per-agent gates: opt-out + quiet hours are applied before insert.
  let created = 0;
  let skipped = 0;
  let skippedOptOut = 0;
  let skippedQuiet = 0;
  const actionUrl = `/scoreboard?nudge=${encodeURIComponent(`${weekNumber}:${year}:${dayConfig.tag}`)}`;

  for (const agentId of needsNudge) {
    const pref = prefByAgent.get(agentId);
    if (pref && pref.notify_in_app === false) {
      skippedOptOut++;
      continue;
    }
    if (pref && isQuietNow(pref)) {
      skippedQuiet++;
      continue;
    }
    const { count } = await supabase
      .from('agent_action_items')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', agentId)
      .eq('item_type', 'coaching_nudge')
      .eq('action_url', actionUrl);
    if ((count ?? 0) > 0) {
      skipped++;
      continue;
    }
    const { error: insErr } = await supabase.from('agent_action_items').insert({
      agent_id: agentId,
      item_type: 'coaching_nudge',
      title: dayConfig.title,
      description: dayConfig.description,
      action_url: actionUrl,
      priority: dayConfig.priority,
    });
    if (insErr) {
      console.error('[coaching-weekly-nudge] insert failed:', insErr);
      continue;
    }
    created++;
  }

  // ── Step 4: clear stale nudges for agents who DID submit this week ──
  // (e.g. if Wed nudge fired and they submitted Wednesday afternoon, the
  // Thursday nudge shouldn't still be sitting in their Coach inbox.)
  let cleared = 0;
  if (submittedSet.size > 0) {
    const submittedAgentIds = Array.from(submittedSet);
    const weekTagPrefix = `/scoreboard?nudge=${encodeURIComponent(`${weekNumber}:${year}:`)}`;
    const { data: stale } = await supabase
      .from('agent_action_items')
      .select('id, action_url, agent_id')
      .eq('item_type', 'coaching_nudge')
      .eq('is_dismissed', false)
      .is('resolved_at', null)
      .in('agent_id', submittedAgentIds);
    const toClear = (stale ?? []).filter((row: { action_url: string | null }) =>
      typeof row.action_url === 'string' && row.action_url.startsWith(weekTagPrefix),
    );
    if (toClear.length > 0) {
      const ids = toClear.map((r: { id: string }) => r.id);
      const { error: updErr } = await supabase
        .from('agent_action_items')
        .update({ resolved_at: new Date().toISOString() })
        .in('id', ids);
      if (!updErr) cleared = toClear.length;
    }
  }

  return jsonResponse({
    ok: true,
    week_number: weekNumber,
    year,
    day_tag: dayConfig.tag,
    priority: dayConfig.priority,
    agents_eligible: agentIds.length,
    agents_already_submitted: submittedSet.size,
    agents_needing_nudge: needsNudge.length,
    nudges_created: created,
    nudges_skipped_dedup: skipped,
    nudges_skipped_opt_out: skippedOptOut,
    nudges_skipped_quiet_hours: skippedQuiet,
    stale_resolved: cleared,
  });
});
