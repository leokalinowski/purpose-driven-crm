/**
 * RecentActivityFeed — last 5 logged activities, mixed across
 * `contact_activities` and `opportunity_activities`.
 *
 * No `outcome IS NOT NULL` filter — every activity shows. The verb
 * wording differs based on whether an outcome is set, so a no-outcome
 * call reads as "Dialed Sarah" (an attempt), and an outcome-bearing
 * call reads as "Talked with Sarah" (an actual conversation). The agent
 * should never see a no-outcome dial labeled as a logged conversation.
 *
 * Layout reference: design/dashboard-v2.html .feed-panel.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  Gift,
  UserPlus,
  StickyNote,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type DotTone = 'teal' | 'green' | 'amber' | 'blue';

interface FeedRow {
  id: string;
  icon: typeof Phone;
  tone: DotTone;
  title: string;
  sub: string;
  when: string;
  whenMs: number;
  href?: string;
}

const DOT_CLASS: Record<DotTone, string> = {
  teal:  'bg-reop-teal-soft text-primary',
  green: 'bg-reop-green-soft text-[hsl(142_55%_32%)]',
  amber: 'bg-[hsl(35_100%_93%)] text-[hsl(35_80%_40%)]',
  blue:  'bg-[hsl(210_80%_94%)] text-[hsl(210_80%_40%)]',
};

interface ContactJoin {
  first_name: string | null;
  last_name: string | null;
}

interface ContactActivityRow {
  id: string;
  activity_type: string;
  activity_date: string;
  notes: string | null;
  outcome: string | null;
  contact_id: string | null;
  contacts: ContactJoin | null;
}

interface OppActivityRow {
  id: string;
  activity_type: string;
  activity_date: string;
  title: string | null;
  description: string | null;
  outcome: string | null;
  opportunity_id: string | null;
  opportunities: {
    title: string | null;
    contact: ContactJoin | null;
  } | null;
}

function nameOf(c: ContactJoin | null): string {
  if (!c) return 'a contact';
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'a contact';
}

function shortenOutcome(outcome: string | null): string {
  if (!outcome) return '';
  return outcome.replace(/_/g, ' ');
}

function rowFromContactActivity(a: ContactActivityRow): FeedRow {
  const name = nameOf(a.contacts);
  const hasOutcome = !!a.outcome;
  const subBase = a.outcome ? shortenOutcome(a.outcome) : a.notes || 'no notes';
  const sub = subBase.length > 80 ? subBase.slice(0, 77) + '…' : subBase;
  const whenMs = new Date(a.activity_date).getTime();
  const when = formatDistanceToNowStrict(new Date(whenMs), { addSuffix: true });
  const href = a.contact_id ? `/database?contact=${a.contact_id}` : undefined;

  switch (a.activity_type) {
    case 'call':
      return {
        id: `c-${a.id}`,
        icon: hasOutcome ? CheckCircle2 : Phone,
        tone: hasOutcome ? 'green' : 'teal',
        title: hasOutcome ? `Talked with ${name}` : `Dialed ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
    case 'text':
      return {
        id: `c-${a.id}`,
        icon: MessageSquare,
        tone: 'amber',
        title: `Texted ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
    case 'email':
      return {
        id: `c-${a.id}`,
        icon: Mail,
        tone: 'amber',
        title: `Emailed ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
    case 'gift':
      return {
        id: `c-${a.id}`,
        icon: Gift,
        tone: 'teal',
        title: `Sent gift to ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
    case 'meeting':
    case 'meet':
      return {
        id: `c-${a.id}`,
        icon: CheckCircle2,
        tone: 'green',
        title: `Met with ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
    case 'note':
      return {
        id: `c-${a.id}`,
        icon: StickyNote,
        tone: 'blue',
        title: `Note on ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
    default:
      return {
        id: `c-${a.id}`,
        icon: UserPlus,
        tone: 'blue',
        title: `${a.activity_type} · ${name}`,
        sub,
        when,
        whenMs,
        href,
      };
  }
}

function rowFromOppActivity(a: OppActivityRow): FeedRow {
  const opp = a.opportunities;
  const name = nameOf(opp?.contact ?? null);
  const deal = opp?.title || `${name}'s opportunity`;
  const whenMs = new Date(a.activity_date).getTime();
  const when = formatDistanceToNowStrict(new Date(whenMs), { addSuffix: true });
  const subBase = a.description || shortenOutcome(a.outcome) || '';
  const sub = subBase.length > 80 ? subBase.slice(0, 77) + '…' : subBase;
  const href = a.opportunity_id ? `/pipeline?opp=${a.opportunity_id}` : undefined;

  // Opportunity activity_types are looser; the title field usually
  // carries the agent-friendly phrasing already.
  return {
    id: `o-${a.id}`,
    icon: a.activity_type === 'stage_change' ? CheckCircle2 : Activity,
    tone: a.activity_type === 'stage_change' ? 'green' : 'teal',
    title: a.title || `${a.activity_type.replace(/_/g, ' ')} · ${deal}`,
    sub: sub || deal,
    when,
    whenMs,
    href,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────

function useRecentActivity(limit = 5): { rows: FeedRow[]; loading: boolean } {
  const { user } = useAuth();
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [contactRes, oppRes] = await Promise.all([
        supabase
          .from('contact_activities')
          .select('id, activity_type, activity_date, notes, outcome, contact_id, contacts(first_name, last_name)')
          .eq('agent_id', user.id)
          .order('activity_date', { ascending: false })
          .limit(limit + 5),
        supabase
          .from('opportunity_activities')
          .select('id, activity_type, activity_date, title, description, outcome, opportunity_id, opportunities(title, contact:contacts(first_name, last_name))')
          .eq('agent_id', user.id)
          .order('activity_date', { ascending: false })
          .limit(limit + 5),
      ]);
      if (cancelled) return;
      const merged: FeedRow[] = [];
      for (const a of (contactRes.data ?? []) as ContactActivityRow[]) {
        merged.push(rowFromContactActivity(a));
      }
      for (const a of (oppRes.data ?? []) as unknown as OppActivityRow[]) {
        merged.push(rowFromOppActivity(a));
      }
      merged.sort((a, b) => b.whenMs - a.whenMs);
      setRows(merged.slice(0, limit));
      setLoading(false);
    })().catch((err) => {
      console.warn('[useRecentActivity] failed:', err);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, limit]);

  return { rows, loading };
}

// ─── Component ───────────────────────────────────────────────────────

export function RecentActivityFeed({ limit = 5 }: { limit?: number }) {
  const { rows, loading } = useRecentActivity(limit);

  return (
    <section className="bg-card border border-border rounded-[16px] overflow-hidden">
      <div className="px-5 py-4 flex justify-between items-center border-b border-border">
        <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] inline-flex items-center gap-2 text-reop-dark-blue">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Recent activity
        </h3>
        <Link
          to="/spheresync-tasks?tab=history"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[12.5px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft transition"
        >
          View all
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div>
        {loading ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
            Loading recent activity…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
            No activity yet — log your first call from SphereSync.
          </div>
        ) : (
          <ul className="m-0 p-0">
            {rows.map((row) => {
              const Icon = row.icon;
              const inner = (
                <div className="grid grid-cols-[36px_1fr_auto] gap-3 px-5 py-[13px] items-start border-b border-border last:border-b-0 transition hover:bg-[hsl(210_20%_99%)]">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0',
                      DOT_CLASS[row.tone],
                    )}
                  >
                    <Icon className="w-[15px] h-[15px]" />
                  </div>
                  <div className="min-w-0">
                    <b className="block text-[13px] font-semibold mb-0.5 text-reop-dark-blue truncate">
                      {row.title}
                    </b>
                    <span className="text-[11.5px] text-muted-foreground leading-[1.45] line-clamp-1">
                      {row.sub}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap pt-0.5">
                    {row.when}
                  </div>
                </div>
              );
              return row.href ? (
                <Link key={row.id} to={row.href} className="block">
                  {inner}
                </Link>
              ) : (
                <li key={row.id}>{inner}</li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
