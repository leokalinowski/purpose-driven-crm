import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface ClickUpTask {
  id: string;
  clickup_task_id: string;
  task_name: string;
  status: string | null;
  due_date: string | null;
  responsible_person: string | null;
  completed_at: string | null;
}

export function ClickUpTasks({ eventId }: { eventId: string }) {
  const [tasks, setTasks] = useState<ClickUpTask[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from('clickup_tasks')
      .select('*')
      .eq('event_id', eventId)
      .order('due_date', { ascending: true });
    if (!error) setTasks((data || []) as ClickUpTask[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('clickup-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clickup_tasks', filter: `event_id=eq.${eventId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (!tasks.length) return null;

  const badgeFor = (t: ClickUpTask) => {
    if (t.completed_at) return <Badge variant="default">Completed</Badge>;
    if (t.due_date && new Date(t.due_date) < new Date()) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <div className="space-y-3">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium">{t.task_name}</h4>
              {badgeFor(t)}
            </div>
            {t.responsible_person && (
              <p className="text-sm text-muted-foreground">Responsible: {t.responsible_person}</p>
            )}
            {t.due_date && (
              <p className="text-sm text-muted-foreground">Due: {new Date(t.due_date).toLocaleDateString()}</p>
            )}
            {t.status && (
              <p className="text-xs text-muted-foreground">Status: {t.status}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
