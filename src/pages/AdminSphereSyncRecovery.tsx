import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { 
  RefreshCw, 
  Send, 
  PlayCircle, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Eye,
  History,
  Users,
  Mail
} from 'lucide-react';
import { getCurrentWeekTasks } from '@/utils/sphereSyncLogic';

interface RunLog {
  id: string;
  run_type: string;
  source: string;
  scheduled_at: string | null;
  started_at: string;
  finished_at: string | null;
  target_week_number: number;
  target_year: number;
  force_regenerate: boolean;
  force_send: boolean;
  dry_run: boolean;
  status: string;
  agents_processed: number;
  agents_skipped: number;
  tasks_created: number;
  emails_sent: number;
  emails_skipped: number;
  emails_failed: number;
  error_message: string | null;
  agent_results: any[];
}

interface Agent {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function AdminSphereSyncRecovery() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  
  const currentWeek = getCurrentWeekTasks();
  
  const [weekNumber, setWeekNumber] = useState(currentWeek.weekNumber);
  const [year, setYear] = useState(currentWeek.isoYear);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [forceSend, setForceSend] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [agents, setAgents] = useState<Agent[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  
  const [lastResult, setLastResult] = useState<any>(null);
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!roleLoading && !isAdmin) {
      navigate('/');
    }
  }, [authLoading, roleLoading, user, isAdmin, navigate]);

  useEffect(() => {
    document.title = 'SphereSync Recovery - Admin';
    loadAgents();
    loadRunLogs();
  }, []);

  const loadAgents = async () => {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['agent', 'admin']);

    if (userRoles) {
      const agentIds = userRoles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', agentIds);
      
      if (profiles) {
        setAgents(profiles as Agent[]);
      }
    }
  };

  const loadRunLogs = async () => {
    setIsLoadingLogs(true);
    const { data, error } = await supabase
      .from('spheresync_run_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('Failed to load run logs:', error);
    } else {
      setRunLogs((data || []) as unknown as RunLog[]);
    }
    setIsLoadingLogs(false);
  };

  const handleGenerateTasks = async () => {
    setIsGenerating(true);
    setLastResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('spheresync-generate-tasks', {
        body: {
          mode: selectedAgent === 'all' ? 'global' : 'single',
          agentId: selectedAgent === 'all' ? null : selectedAgent,
          week_number: weekNumber,
          year: year,
          force_regenerate: forceRegenerate,
          source: 'admin_recovery'
        }
      });

      if (error) throw error;

      setLastResult({ type: 'generate', ...data });
      toast({
        title: 'Task Generation Complete',
        description: data.message || `Generated ${data.summary?.total_tasks_generated || 0} tasks`
      });
      loadRunLogs();
    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive'
      });
      setLastResult({ type: 'generate', success: false, error: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDryRun = async () => {
    setIsDryRunning(true);
    setLastResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('spheresync-email-function', {
        body: {
          week_number: weekNumber,
          year: year,
          agent_id: selectedAgent === 'all' ? null : selectedAgent,
          dry_run: true,
          force: forceSend,
          source: 'admin_recovery'
        }
      });

      if (error) throw error;

      setLastResult({ type: 'dry_run', ...data });
      toast({
        title: 'Dry Run Complete',
        description: `Would send ${data.agents_would_send || 0} emails, skip ${data.agents_would_skip || 0}`
      });
    } catch (error: any) {
      toast({
        title: 'Dry Run Failed',
        description: error.message,
        variant: 'destructive'
      });
      setLastResult({ type: 'dry_run', success: false, error: error.message });
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleSendEmails = async () => {
    setIsSending(true);
    setLastResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('spheresync-email-function', {
        body: {
          week_number: weekNumber,
          year: year,
          agent_id: selectedAgent === 'all' ? null : selectedAgent,
          force: forceSend,
          source: 'admin_recovery'
        }
      });

      if (error) throw error;

      setLastResult({ type: 'email', ...data });
      toast({
        title: 'Emails Sent',
        description: data.message || `Sent ${data.emails_sent || 0} emails`
      });
      loadRunLogs();
    } catch (error: any) {
      toast({
        title: 'Email Send Failed',
        description: error.message,
        variant: 'destructive'
      });
      setLastResult({ type: 'email', success: false, error: error.message });
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <Layout>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px]" />
        </div>
      </Layout>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SphereSync Recovery</h1>
            <p className="text-muted-foreground">
              Diagnose and recover from missed SphereSync task generation or email sends
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            Current: Week {currentWeek.weekNumber} / {currentWeek.isoYear}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Controls Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Recovery Actions
              </CardTitle>
              <CardDescription>
                Generate tasks or send emails for a specific week
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="week">Week Number</Label>
                  <Input
                    id="week"
                    type="number"
                    min={1}
                    max={52}
                    value={weekNumber}
                    onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    min={2024}
                    max={2030}
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value) || 2025)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent">Target Agent</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.user_id} value={agent.user_id}>
                        {agent.first_name} {agent.last_name} ({agent.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="force-regenerate" className="font-medium">Force Regenerate</Label>
                    <p className="text-sm text-muted-foreground">Delete existing tasks and recreate</p>
                  </div>
                  <Switch
                    id="force-regenerate"
                    checked={forceRegenerate}
                    onCheckedChange={setForceRegenerate}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="force-send" className="font-medium">Force Send</Label>
                    <p className="text-sm text-muted-foreground">Bypass "already sent" check</p>
                  </div>
                  <Switch
                    id="force-send"
                    checked={forceSend}
                    onCheckedChange={setForceSend}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleGenerateTasks}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="mr-2 h-4 w-4" />
                  )}
                  Generate Tasks
                </Button>

                <Button
                  onClick={handleDryRun}
                  disabled={isDryRunning}
                  variant="outline"
                  className="w-full"
                >
                  {isDryRunning ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Dry Run (Preview Emails)
                </Button>

                <Button
                  onClick={handleSendEmails}
                  disabled={isSending}
                  variant="default"
                  className="w-full"
                >
                  {isSending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Emails
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Result Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {lastResult?.success === true && <CheckCircle className="h-5 w-5 text-green-500" />}
                {lastResult?.success === false && <XCircle className="h-5 w-5 text-red-500" />}
                {!lastResult && <AlertTriangle className="h-5 w-5 text-muted-foreground" />}
                Last Action Result
              </CardTitle>
              <CardDescription>
                {lastResult ? `${lastResult.type} - ${new Date().toLocaleTimeString()}` : 'No action performed yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!lastResult ? (
                <p className="text-muted-foreground text-center py-8">
                  Run an action to see results here
                </p>
              ) : (
                <div className="space-y-4">
                  {lastResult.error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
                      <p className="font-medium">Error</p>
                      <p className="text-sm">{lastResult.error}</p>
                    </div>
                  )}

                  {lastResult.summary && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Agents Processed</p>
                        <p className="text-2xl font-bold">{lastResult.summary.agents_processed || 0}</p>
                      </div>
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Tasks Generated</p>
                        <p className="text-2xl font-bold">{lastResult.summary.total_tasks_generated || 0}</p>
                      </div>
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Agents Skipped</p>
                        <p className="text-2xl font-bold">{lastResult.summary.agents_skipped || 0}</p>
                      </div>
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Agents Failed</p>
                        <p className="text-2xl font-bold">{lastResult.summary.agents_failed || 0}</p>
                      </div>
                    </div>
                  )}

                  {lastResult.type === 'email' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-500/10 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Sent</p>
                        <p className="text-2xl font-bold text-green-600">{lastResult.emails_sent || 0}</p>
                      </div>
                      <div className="bg-yellow-500/10 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Skipped</p>
                        <p className="text-2xl font-bold text-yellow-600">{lastResult.emails_skipped || 0}</p>
                      </div>
                      <div className="bg-red-500/10 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{lastResult.emails_failed || 0}</p>
                      </div>
                    </div>
                  )}

                  {lastResult.type === 'dry_run' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-500/10 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Would Send</p>
                        <p className="text-2xl font-bold text-blue-600">{lastResult.agents_would_send || 0}</p>
                      </div>
                      <div className="bg-yellow-500/10 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Would Skip</p>
                        <p className="text-2xl font-bold text-yellow-600">{lastResult.agents_would_skip || 0}</p>
                      </div>
                      <div className="bg-orange-500/10 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">Missing Email</p>
                        <p className="text-2xl font-bold text-orange-600">{lastResult.agents_missing_email || 0}</p>
                      </div>
                    </div>
                  )}

                  {lastResult.results && lastResult.results.length > 0 && (
                    <div className="mt-4">
                      <p className="font-medium mb-2">Agent Details</p>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {lastResult.results.slice(0, 10).map((result: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                            <span>{result.agent_name}</span>
                            <div className="flex items-center gap-2">
                              {result.tasks_generated !== undefined && (
                                <Badge variant="secondary">{result.tasks_generated} tasks</Badge>
                              )}
                              {result.task_count !== undefined && (
                                <Badge variant="secondary">{result.task_count} tasks</Badge>
                              )}
                              {result.skipped && (
                                <Badge variant="outline">Skipped</Badge>
                              )}
                              {result.would_skip && (
                                <Badge variant="outline">Would Skip</Badge>
                              )}
                              {result.error && (
                                <Badge variant="destructive">Error</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                        {lastResult.results.length > 10 && (
                          <p className="text-sm text-muted-foreground text-center">
                            ... and {lastResult.results.length - 10} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Run History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Run History
              </CardTitle>
              <CardDescription>
                Recent task generation and email runs
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadRunLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : runLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No run history yet
              </p>
            ) : (
              <div className="space-y-2">
                {runLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {log.run_type === 'generate' ? (
                        <Users className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Mail className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <p className="font-medium">
                          {log.run_type === 'generate' ? 'Task Generation' : 'Email Send'} - 
                          Week {log.target_week_number}/{log.target_year}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.started_at).toLocaleString()} • {log.source}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.run_type === 'generate' && (
                        <Badge variant="secondary">
                          {log.tasks_created} tasks
                        </Badge>
                      )}
                      {log.run_type === 'email' && (
                        <>
                          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                            {log.emails_sent} sent
                          </Badge>
                          {log.emails_skipped > 0 && (
                            <Badge variant="outline">
                              {log.emails_skipped} skipped
                            </Badge>
                          )}
                        </>
                      )}
                      {log.status === 'completed' && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {log.status === 'failed' && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {log.status === 'running' && (
                        <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
