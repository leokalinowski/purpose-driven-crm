import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface OpportunityActivity {
  id: string;
  opportunity_id: string;
  agent_id: string;
  activity_type: string;
  title: string | null;
  description: string | null;
  outcome: string | null;
  note: string | null;
  activity_date: string;
  created_at: string;
}

/**
 * Unified activity entry that merges `opportunity_activities` and the
 * contact-scoped `contact_activities` for the same person. Lets the Pipeline
 * drawer's Activity tab show ONE timeline — including calls/texts logged via
 * SphereSync or Database, not just opportunity-scoped events.
 *
 * Why this exists: opportunity_activities cross-posts channel events to
 * contact_activities (so Coach + last-touch triggers fire), but the reverse
 * doesn't happen. An agent who logs a call from SphereSync wasn't seeing it
 * on the Pipeline drawer's Activity tab. The merge here makes the agent's
 * activity feed consistent across surfaces.
 */
export interface TimelineActivity {
  id: string;
  /** Where this row originated. UI renders a small chip when source='contact'. */
  source: 'opportunity' | 'contact';
  activity_type: string;
  activity_date: string;
  title: string | null;
  note: string | null;
  outcome: string | null;
}

export function useOpportunityActivities(opportunityId: string | null) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<OpportunityActivity[]>([]);
  const [timeline, setTimeline] = useState<TimelineActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!opportunityId) {
      setActivities([]);
      setTimeline([]);
      return;
    }
    setLoading(true);
    try {
      // 1) Opportunity-scoped activities (always required).
      const oppRes = await supabase
        .from('opportunity_activities')
        .select('id, opportunity_id, agent_id, activity_type, title, description, outcome, note, activity_date, created_at')
        .eq('opportunity_id', opportunityId)
        .order('activity_date', { ascending: false })
        .limit(50);
      if (oppRes.error) throw oppRes.error;
      const oppActs = (oppRes.data || []) as OpportunityActivity[];
      setActivities(oppActs);

      // 2) Look up the linked contact_id so we can fold in contact-scoped
      //    activities. If the opportunity was deleted concurrently, just bail
      //    cleanly with the opportunity-only list.
      const linkRes = await supabase
        .from('opportunities')
        .select('contact_id')
        .eq('id', opportunityId)
        .maybeSingle();
      const contactId = linkRes.data?.contact_id ?? null;

      // 3) Contact-scoped activities for the same person (limit 50). We DO
      //    pull entries that originated as opportunity activities and were
      //    cross-posted to contact_activities — those are filtered out below
      //    via id-set dedupe so the timeline doesn't double-count.
      let contactActs: Array<{
        id: string;
        activity_type: string;
        activity_date: string;
        notes: string | null;
        outcome: string | null;
      }> = [];
      if (contactId) {
        const contactRes = await supabase
          .from('contact_activities')
          .select('id, activity_type, activity_date, notes, outcome')
          .eq('contact_id', contactId)
          .order('activity_date', { ascending: false })
          .limit(50);
        if (contactRes.error) {
          console.warn('[useOpportunityActivities] contact_activities fetch failed (non-fatal):', contactRes.error.message);
        } else {
          contactActs = contactRes.data ?? [];
        }
      }

      // 4) Build the merged timeline. Cross-posted contact entries (same
      //    activity_type at the same activity_date as an opportunity entry)
      //    are deduped — keep the opportunity copy because it has more
      //    fields (title/description). Window: ±2 minutes on the timestamp
      //    to absorb minor clock skew between the original insert and the
      //    cross-post.
      const oppTimeline: TimelineActivity[] = oppActs.map(o => ({
        id: o.id,
        source: 'opportunity' as const,
        activity_type: o.activity_type,
        activity_date: o.activity_date,
        title: o.title,
        note: o.note,
        outcome: o.outcome,
      }));

      const oppKeys = new Set(
        oppActs.map(o => `${o.activity_type}::${Math.floor(new Date(o.activity_date).getTime() / 120_000)}`),
      );

      const contactTimeline: TimelineActivity[] = contactActs
        .filter(c => {
          const key = `${c.activity_type}::${Math.floor(new Date(c.activity_date).getTime() / 120_000)}`;
          return !oppKeys.has(key);
        })
        .map(c => ({
          id: c.id,
          source: 'contact' as const,
          activity_type: c.activity_type,
          activity_date: c.activity_date,
          title: null,
          note: c.notes,
          outcome: c.outcome,
        }));

      const merged = [...oppTimeline, ...contactTimeline].sort(
        (a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime(),
      );
      setTimeline(merged);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  const logActivity = useCallback(async (data: {
    activity_type: string;
    title?: string;
    description?: string;
    outcome?: string;
    note?: string;
    activity_date?: string;
  }) => {
    if (!opportunityId || !user?.id) throw new Error('Missing opportunityId or user');
    const activityDate = data.activity_date ?? new Date().toISOString();
    const { error } = await supabase.from('opportunity_activities').insert({
      opportunity_id: opportunityId,
      agent_id: user.id,
      activity_type: data.activity_type,
      title: data.title ?? null,
      description: data.description ?? null,
      outcome: data.outcome ?? null,
      note: data.note ?? null,
      activity_date: activityDate,
    });
    if (error) throw error;
    await fetchActivities();

    // Re-score this opportunity immediately after any activity — fire and forget
    supabase.functions.invoke('pipeline-score-opportunities', {
      body: { opportunity_id: opportunityId, agent_id: user.id },
    }).catch(e => console.warn('Re-score after activity failed (non-fatal):', e));

    // Mirror channel-typed activities (call/text/email) into contact_activities
    // so the channel-last-touch trigger fires and Coach sees the fresh contact-level signal.
    if (['call', 'text', 'email'].includes(data.activity_type)) {
      supabase
        .from('opportunities')
        .select('contact_id')
        .eq('id', opportunityId)
        .maybeSingle()
        .then(({ data: opp }) => {
          if (!opp?.contact_id) return;
          return supabase.from('contact_activities').insert({
            contact_id: opp.contact_id,
            agent_id: user.id,
            activity_type: data.activity_type,
            activity_date: activityDate,
            notes: data.note ?? data.outcome ?? null,
          });
        })
        .then((res) => {
          if (res?.error) console.warn('Contact activity mirror failed (non-fatal):', res.error.message);
        })
        .catch(e => console.warn('Contact activity mirror failed (non-fatal):', e));
    }
  }, [opportunityId, user?.id, fetchActivities]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  return { activities, timeline, loading, logActivity, refresh: fetchActivities };
}
