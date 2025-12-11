import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  Mail, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye, 
  Send, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Download,
  ArrowUpDown
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EmailLog {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  agent_id: string | null;
  subject: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'complained' | 'unsubscribed';
  resend_email_id: string | null;
  error_message: string | null;
  metadata: any;
  sent_at: string | null;
  created_at: string;
  retry_count: number;
  last_retry_at: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

const AdminEmailLogs = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Filters
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    successRate: 0
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!roleLoading && !isAdmin) {
      navigate('/');
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const fetchEmailLogs = async () => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      console.log('Fetching email logs...');

      // Step 1: Fetch email logs without join
      let query = supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (emailTypeFilter !== 'all') {
        query = query.eq('email_type', emailTypeFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`recipient_email.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%,recipient_name.ilike.%${searchQuery}%`);
      }

      if (dateRange.start) {
        query = query.gte('created_at', dateRange.start + 'T00:00:00');
      }

      if (dateRange.end) {
        query = query.lte('created_at', dateRange.end + 'T23:59:59');
      }

      const { data: logsData, error: logsError, count } = await query;

      if (logsError) {
        console.error('Error fetching email logs:', logsError);
        if (logsError.message?.includes('permission denied') || logsError.message?.includes('policy')) {
          toast({
            title: 'Permission Error',
            description: 'You may not have permission to view email logs.',
            variant: 'destructive'
          });
        }
        throw logsError;
      }

      // Step 2: Fetch profiles for agent_ids
      const agentIds = [...new Set((logsData || []).map(log => log.agent_id).filter(Boolean))];
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {};
      
      if (agentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', agentIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name, email: p.email };
            return acc;
          }, {} as Record<string, { first_name: string | null; last_name: string | null; email: string | null }>);
        }
      }

      // Step 3: Merge results
      const enrichedLogs: EmailLog[] = (logsData || []).map(log => ({
        ...log,
        status: log.status as EmailLog['status'],
        profiles: log.agent_id ? profilesMap[log.agent_id] || null : null
      }));

      console.log('Query successful. Count:', count);
      setEmailLogs(enrichedLogs);
      setTotalCount(count || 0);

      // Calculate stats with same filters
      let statsQuery = supabase
        .from('email_logs')
        .select('status');

      if (emailTypeFilter !== 'all') {
        statsQuery = statsQuery.eq('email_type', emailTypeFilter);
      }
      
      if (statusFilter !== 'all') {
        statsQuery = statsQuery.eq('status', statusFilter);
      }
      
      if (dateRange.start) {
        statsQuery = statsQuery.gte('created_at', dateRange.start + 'T00:00:00');
      }
      
      if (dateRange.end) {
        statsQuery = statsQuery.lte('created_at', dateRange.end + 'T23:59:59');
      }

      const { data: statsData, error: statsError } = await statsQuery;
      
      if (statsError) {
        console.error('Error fetching stats:', statsError);
      } else if (statsData) {
        const total = statsData.length;
        // Success includes: sent, delivered, opened, clicked
        const successStatuses = ['sent', 'delivered', 'opened', 'clicked'];
        const delivered = statsData.filter((s: { status: string }) => successStatuses.includes(s.status)).length;
        // Failed includes: failed, bounced, complained
        const failedStatuses = ['failed', 'bounced', 'complained'];
        const failed = statsData.filter((s: { status: string }) => failedStatuses.includes(s.status)).length;
        const pending = statsData.filter((s: { status: string }) => s.status === 'pending').length;
        const successRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0';

        setStats({
          total,
          sent: delivered,
          failed,
          pending,
          successRate: parseFloat(successRate)
        });
      }

    } catch (error: any) {
      console.error('Error fetching email logs:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch email logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchEmailLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, page, emailTypeFilter, statusFilter, dateRange.start, dateRange.end, searchQuery]);

  const getStatusBadge = (status: string) => {
    const variants = {
      sent: 'default',
      delivered: 'default',
      opened: 'default',
      clicked: 'default',
      failed: 'destructive',
      pending: 'secondary',
      bounced: 'destructive',
      complained: 'destructive',
      unsubscribed: 'outline'
    } as const;

    const icons = {
      sent: <CheckCircle2 className="h-3 w-3 mr-1" />,
      delivered: <CheckCircle2 className="h-3 w-3 mr-1" />,
      opened: <Eye className="h-3 w-3 mr-1" />,
      clicked: <Send className="h-3 w-3 mr-1" />,
      failed: <AlertCircle className="h-3 w-3 mr-1" />,
      pending: <Clock className="h-3 w-3 mr-1" />,
      bounced: <AlertCircle className="h-3 w-3 mr-1" />,
      complained: <AlertCircle className="h-3 w-3 mr-1" />,
      unsubscribed: <AlertCircle className="h-3 w-3 mr-1" />
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'} className="flex items-center gap-1">
        {icons[status as keyof typeof icons]}
        {status}
      </Badge>
    );
  };

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      spheresync_reminder: 'SphereSync Reminder',
      success_scoreboard_reminder: 'Success Scoreboard Reminder',
      event_confirmation: 'Event Confirmation',
      event_reminder_7day: 'Event Reminder (7 days)',
      event_reminder_1day: 'Event Reminder (1 day)',
      event_thank_you: 'Event Thank You',
      event_no_show: 'Event No Show',
      newsletter: 'Newsletter',
      team_invitation: 'Team Invitation',
      general: 'General'
    };
    return labels[type] || type;
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Type', 'Recipient', 'Subject', 'Status', 'Agent', 'Error'];
    const rows = emailLogs.map(log => [
      log.created_at,
      getEmailTypeLabel(log.email_type),
      log.recipient_email,
      log.subject,
      log.status,
      log.profiles ? `${log.profiles.first_name} ${log.profiles.last_name}` : 'N/A',
      log.error_message || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImportHistory = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-resend-history');
      if (error) throw error;
      
      toast({
        title: "Import Complete",
        description: `Fetched: ${data.stats?.fetched || 0}, Imported: ${data.stats?.imported || 0}, Skipped: ${data.stats?.skipped || 0}`,
      });
      
      fetchEmailLogs();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || 'Failed to import email history from Resend',
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-9 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Email Communication Logs</h1>
            <p className="text-muted-foreground">
              Track and monitor all email communications sent from the system
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleImportHistory} variant="outline" size="sm" disabled={importing}>
              {importing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {importing ? 'Importing...' : 'Import History'}
            </Button>
            <Button onClick={fetchEmailLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Last 7 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sent}</div>
              <p className="text-xs text-muted-foreground">
                Sent, delivered, opened, clicked
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                Delivery failures
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                Delivery success rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Email Type</Label>
                <Select value={emailTypeFilter} onValueChange={setEmailTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="spheresync_reminder">SphereSync Reminder</SelectItem>
                    <SelectItem value="success_scoreboard_reminder">Success Scoreboard Reminder</SelectItem>
                    <SelectItem value="event_confirmation">Event Confirmation</SelectItem>
                    <SelectItem value="event_reminder_7day">Event Reminder (7 days)</SelectItem>
                    <SelectItem value="event_reminder_1day">Event Reminder (1 day)</SelectItem>
                    <SelectItem value="event_thank_you">Event Thank You</SelectItem>
                    <SelectItem value="event_no_show">Event No Show</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="team_invitation">Team Invitation</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="clicked">Clicked</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="complained">Complained</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Start</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date End</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by recipient, subject, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Email Logs</CardTitle>
            <CardDescription>
              Showing {emailLogs.length} of {totalCount} emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No email logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    emailLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {log.sent_at 
                            ? formatDistanceToNow(new Date(log.sent_at), { addSuffix: true })
                            : formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getEmailTypeLabel(log.email_type)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.recipient_email}</div>
                            {log.recipient_name && (
                              <div className="text-xs text-muted-foreground">{log.recipient_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate">{log.subject}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell>
                          {log.profiles 
                            ? `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() || log.profiles.email
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(log);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(totalCount / pageSize)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                    disabled={page >= Math.ceil(totalCount / pageSize)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Log Details</DialogTitle>
              <DialogDescription>
                Detailed information about this email communication
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <Tabs defaultValue="details">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="metadata">Metadata</TabsTrigger>
                    {selectedLog.error_message && (
                      <TabsTrigger value="error">Error</TabsTrigger>
                    )}
                  </TabsList>
                  <TabsContent value="details" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">Email Type</Label>
                        <div className="font-medium">{getEmailTypeLabel(selectedLog.email_type)}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div>{getStatusBadge(selectedLog.status)}</div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Recipient Email</Label>
                        <div className="font-medium">{selectedLog.recipient_email}</div>
                      </div>
                      {selectedLog.recipient_name && (
                        <div>
                          <Label className="text-muted-foreground">Recipient Name</Label>
                          <div className="font-medium">{selectedLog.recipient_name}</div>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground">Subject</Label>
                        <div className="font-medium">{selectedLog.subject}</div>
                      </div>
                      {selectedLog.profiles && (
                        <div>
                          <Label className="text-muted-foreground">Agent</Label>
                          <div className="font-medium">
                            {`${selectedLog.profiles.first_name || ''} ${selectedLog.profiles.last_name || ''}`.trim() || selectedLog.profiles.email}
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground">Created At</Label>
                        <div>{format(new Date(selectedLog.created_at), 'PPpp')}</div>
                      </div>
                      {selectedLog.sent_at && (
                        <div>
                          <Label className="text-muted-foreground">Sent At</Label>
                          <div>{format(new Date(selectedLog.sent_at), 'PPpp')}</div>
                        </div>
                      )}
                      {selectedLog.resend_email_id && (
                        <div>
                          <Label className="text-muted-foreground">Resend Email ID</Label>
                          <div className="font-mono text-sm">{selectedLog.resend_email_id}</div>
                        </div>
                      )}
                      {selectedLog.retry_count > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Retry Count</Label>
                          <div>{selectedLog.retry_count}</div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="metadata">
                    <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </TabsContent>
                  {selectedLog.error_message && (
                    <TabsContent value="error">
                      <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                        <pre className="text-sm whitespace-pre-wrap">{selectedLog.error_message}</pre>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AdminEmailLogs;

