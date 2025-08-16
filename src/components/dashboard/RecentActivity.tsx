import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  time: string; // ISO
  status: string;
  link?: string;
}

export function RecentActivity() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      try {
        const [contacts, tasks, events, newsletters, sessions, txs] = await Promise.all([
          supabase.from('contacts').select('id, first_name, last_name, created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('po2_tasks').select('id, completed_at, task_type').eq('agent_id', user.id).order('completed_at', { ascending: false }).limit(5),
          supabase.from('events').select('id, title, created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('newsletter_campaigns').select('id, campaign_name, created_at').eq('created_by', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('coaching_sessions').select('id, session_date, topics_covered').eq('agent_id', user.id).order('session_date', { ascending: false }).limit(5),
          supabase.from('transaction_coordination').select('id, created_at, transaction_stage').eq('responsible_agent', user.id).order('created_at', { ascending: false }).limit(5),
        ]);

        const arr: ActivityItem[] = [];
        for (const c of contacts.data || []) {
          arr.push({ id: `c-${c.id}`, action: 'New lead added', description: `${c.first_name || ''} ${c.last_name}`.trim(), time: c.created_at, status: 'new', link: '/database' });
        }
        for (const t of tasks.data || []) {
          if (t.completed_at) arr.push({ id: `t-${t.id}`, action: 'PO2 task completed', description: t.task_type, time: t.completed_at, status: 'completed', link: '/po2-tasks' });
        }
        for (const e of events.data || []) {
          arr.push({ id: `e-${e.id}`, action: 'Event created', description: e.title, time: e.created_at, status: 'event', link: '/events' });
        }
        for (const n of newsletters.data || []) {
          arr.push({ id: `n-${n.id}`, action: 'Newsletter sent', description: n.campaign_name, time: n.created_at, status: 'sent', link: '/newsletter' });
        }
        for (const s of sessions.data || []) {
          arr.push({ id: `s-${s.id}`, action: 'Coaching session', description: s.topics_covered || 'Session held', time: s.session_date, status: 'coaching', link: '/coaching' });
        }
        for (const tx of txs.data || []) {
          arr.push({ id: `x-${tx.id}`, action: 'Transaction updated', description: tx.transaction_stage, time: tx.created_at, status: 'transaction', link: '/transactions' });
        }

        arr.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        const final = arr.slice(0, 8);
        if (!cancelled) setItems(final);
      } catch (e) {
        console.error('Failed to load recent activity', e);
      }
    }

    load();

    const channel = supabase
      .channel('activity-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'po2_tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_campaigns' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coaching_sessions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_coordination' }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest actions and updates in your CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="max-h-80 overflow-y-auto space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          )}
          {items.map((activity) => (
            <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 sm:space-x-4 pb-3 border-b border-border last:border-b-0 last:pb-0">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-sm font-medium leading-none truncate">
                  {activity.action}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {activity.description}
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Badge variant="secondary" className="text-xs">{activity.status}</Badge>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(activity.time).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
