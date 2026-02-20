import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ImageIcon, ExternalLink, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ThumbnailGeneratorProps {
  userId: string;
  agentName: string;
}

interface WorkflowRun {
  id: string;
  status: string;
  output: any;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface WorkflowStep {
  step_name: string;
  status: string;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export const ThumbnailGenerator = ({ userId, agentName }: ThumbnailGeneratorProps) => {
  const [taskId, setTaskId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeRun, setActiveRun] = useState<WorkflowRun | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [polling, setPolling] = useState(false);
  const { toast } = useToast();

  const pollRun = useCallback(async (runId: string) => {
    const { data: run } = await supabase
      .from('workflow_runs')
      .select('id, status, output, error_message, created_at, started_at, finished_at')
      .eq('id', runId)
      .single();

    if (run) {
      setActiveRun(run as WorkflowRun);
    }

    const { data: runSteps } = await supabase
      .from('workflow_run_steps')
      .select('step_name, status, error_message, started_at, finished_at')
      .eq('run_id', runId)
      .order('started_at', { ascending: true });

    if (runSteps) {
      setSteps(runSteps as WorkflowStep[]);
    }

    return run?.status;
  }, []);

  useEffect(() => {
    if (!polling || !activeRun) return;

    const interval = setInterval(async () => {
      const status = await pollRun(activeRun.id);
      if (status && !['queued', 'running'].includes(status)) {
        setPolling(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [polling, activeRun, pollRun]);

  const handleGenerate = async () => {
    if (!taskId.trim()) {
      toast({ title: 'Enter a ClickUp Task ID', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    setActiveRun(null);
    setSteps([]);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clickup-generate-thumbnail-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ task_id: taskId.trim() }),
        }
      );

      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(result.error || 'Failed to queue thumbnail generation');
      }

      toast({ title: 'Thumbnail generation queued', description: `Task ${taskId} has been queued for processing.` });

      // Find the workflow run to poll
      await new Promise(r => setTimeout(r, 1000));
      const { data: runs } = await supabase
        .from('workflow_runs')
        .select('id, status, output, error_message, created_at, started_at, finished_at')
        .eq('idempotency_key', `generate-thumbnail:${taskId.trim()}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (runs && runs.length > 0) {
        setActiveRun(runs[0] as WorkflowRun);
        setPolling(true);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'running': return 'secondary';
      case 'queued': return 'outline';
      case 'skipped': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Thumbnail Generator
        </CardTitle>
        <CardDescription>
          Generate thumbnails for {agentName} from a ClickUp task
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="clickup_task_id" className="sr-only">ClickUp Task ID</Label>
            <Input
              id="clickup_task_id"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="Enter ClickUp Task ID..."
              disabled={submitting}
            />
          </div>
          <Button onClick={handleGenerate} disabled={submitting || !taskId.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            Generate
          </Button>
        </div>

        {activeRun && (
          <div className="space-y-3 border rounded-md p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Run Status:</span>
                <Badge variant={statusColor(activeRun.status) as any}>
                  {activeRun.status}
                </Badge>
              </div>
              {['queued', 'running'].includes(activeRun.status) && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {activeRun.status === 'failed' && (
                <Button size="sm" variant="outline" onClick={handleGenerate}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
            </div>

            {activeRun.error_message && (
              <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
                {activeRun.error_message}
              </p>
            )}

            {steps.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Steps</p>
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-mono">{step.step_name}</span>
                    <Badge variant={statusColor(step.status) as any} className="text-[10px] px-1.5 py-0">
                      {step.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {activeRun.status === 'success' && activeRun.output && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">Generated Thumbnails</p>
                {activeRun.output.title && (
                  <p className="text-sm text-muted-foreground">Title: <strong>{activeRun.output.title}</strong></p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {activeRun.output.thumb_16x9_url && (
                    <a href={activeRun.output.thumb_16x9_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={activeRun.output.thumb_16x9_url} alt="16:9 Thumbnail" className="rounded border w-full aspect-video object-cover" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        16:9 <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  )}
                  {activeRun.output.thumb_9x16_url && (
                    <a href={activeRun.output.thumb_9x16_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={activeRun.output.thumb_9x16_url} alt="9:16 Thumbnail" className="rounded border w-full aspect-[9/16] object-cover" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        9:16 <ExternalLink className="h-3 w-3" />
                      </span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
