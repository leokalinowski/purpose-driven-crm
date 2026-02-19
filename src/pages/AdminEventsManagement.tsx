import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  Users, 
  Search, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Download, 
  Eye,
  CheckCircle2,
  Clock,
  TrendingUp,
  MapPin,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Info,
  ListChecks,
  Mail
} from 'lucide-react';
import { format, startOfToday } from 'date-fns';
import { EventForm } from '@/components/events/EventForm';
import { RSVPManagement } from '@/components/events/RSVPManagement';
import { EmailManagement } from '@/components/events/email/EmailManagement';
import { AdminEventTasks } from '@/components/admin/AdminEventTasks';

interface EventWithAgent {
  id: string;
  title: string;
  event_date: string;
  location?: string;
  description?: string;
  theme?: string;
  agent_id: string;
  is_published: boolean;
  public_slug?: string;
  max_capacity?: number;
  current_rsvp_count?: number;
  attendance_count?: number;
  leads_generated?: number;
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    team_name?: string;
    brokerage?: string;
  };
}

interface EventStats {
  total: number;
  published: number;
  upcoming: number;
  past: number;
  totalRSVPs: number;
  totalCapacity: number;
  avgAttendance: number;
}

type TaskStatsMap = Record<string, { total: number; completed: number }>;

const AdminEventsManagement = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [events, setEvents] = useState<EventWithAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'past' | 'published' | 'unpublished'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [agents, setAgents] = useState<Array<{ user_id: string; name: string }>>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventWithAgent | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventWithAgent | null | undefined>(undefined);
  const [deletingEvent, setDeletingEvent] = useState<EventWithAgent | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStatsMap>({});
  const [detailTab, setDetailTab] = useState('overview');
  const [stats, setStats] = useState<EventStats>({
    total: 0,
    published: 0,
    upcoming: 0,
    past: 0,
    totalRSVPs: 0,
    totalCapacity: 0,
    avgAttendance: 0,
  });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin && user) {
      fetchEvents();
      fetchAgents();
      fetchTaskStats();
    }
  }, [isAdmin, user]);

  const fetchAgents = async () => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['agent', 'admin']);

      if (rolesError) throw rolesError;

      const userIds = rolesData?.map(r => r.user_id) || [];

      if (userIds.length === 0) {
        setAgents([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (error) throw error;

      setAgents((data || []).map(a => ({
        user_id: a.user_id,
        name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Unknown'
      })));
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const fetchTaskStats = async () => {
    try {
      const { data, error } = await supabase
        .from('clickup_tasks')
        .select('event_id, completed_at');

      if (error) throw error;

      const map: TaskStatsMap = {};
      (data || []).forEach(row => {
        if (!map[row.event_id]) map[row.event_id] = { total: 0, completed: 0 };
        map[row.event_id].total++;
        if (row.completed_at) map[row.event_id].completed++;
      });
      setTaskStats(map);
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (eventsError) throw eventsError;

      const agentIds = [...new Set((eventsData || []).map(e => e.agent_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};

      if (agentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email, team_name, brokerage')
          .in('user_id', agentIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = p;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const eventsWithAgents = (eventsData || []).map(event => ({
        ...event,
        profiles: profilesMap[event.agent_id] || null,
      })) as EventWithAgent[];

      setEvents(eventsWithAgents);
      calculateStats(eventsWithAgents);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (eventsList: EventWithAgent[]) => {
    const now = startOfToday();
    const published = eventsList.filter(e => e.is_published).length;
    const upcoming = eventsList.filter(e => new Date(e.event_date) >= now).length;
    const past = eventsList.filter(e => new Date(e.event_date) < now).length;
    const totalRSVPs = eventsList.reduce((sum, e) => sum + (e.current_rsvp_count || 0), 0);
    const totalCapacity = eventsList.reduce((sum, e) => sum + (e.max_capacity || 0), 0);
    const avgAttendance = past > 0 
      ? eventsList.filter(e => new Date(e.event_date) < now).reduce((sum, e) => sum + (e.attendance_count || 0), 0) / past
      : 0;

    setStats({
      total: eventsList.length,
      published,
      upcoming,
      past,
      totalRSVPs,
      totalCapacity,
      avgAttendance: Math.round(avgAttendance),
    });
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'upcoming' && new Date(event.event_date) >= startOfToday()) ||
      (statusFilter === 'past' && new Date(event.event_date) < startOfToday()) ||
      (statusFilter === 'published' && event.is_published) ||
      (statusFilter === 'unpublished' && !event.is_published);

    const matchesAgent = agentFilter === 'all' || event.agent_id === agentFilter;

    return matchesSearch && matchesStatus && matchesAgent;
  });

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', deletingEvent.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event deleted successfully',
      });

      setDeletingEvent(null);
      if (selectedEvent?.id === deletingEvent.id) setSelectedEvent(null);
      fetchEvents();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event',
        variant: 'destructive',
      });
    }
  };

  const exportEvents = () => {
    const csv = [
      ['Title', 'Date', 'Location', 'Agent', 'Published', 'RSVPs', 'Capacity', 'Attendance', 'Leads'].join(','),
      ...filteredEvents.map(e => [
        `"${e.title}"`,
        e.event_date,
        `"${e.location || ''}"`,
        `"${e.profiles?.first_name || ''} ${e.profiles?.last_name || ''}"`.trim(),
        e.is_published ? 'Yes' : 'No',
        e.current_rsvp_count || 0,
        e.max_capacity || 'Unlimited',
        e.attendance_count || 0,
        e.leads_generated || 0,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: 'Events data exported to CSV',
    });
  };

  const getEventStatus = (event: EventWithAgent) => {
    const eventDate = new Date(event.event_date);
    const now = startOfToday();
    
    if (eventDate < now) {
      return { label: 'Past', variant: 'secondary' as const, icon: Clock };
    } else if (eventDate.toDateString() === now.toDateString()) {
      return { label: 'Today', variant: 'default' as const, icon: Calendar };
    } else {
      return { label: 'Upcoming', variant: 'default' as const, icon: Calendar };
    }
  };

  const handleRowClick = (event: EventWithAgent) => {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
    } else {
      setSelectedEvent(event);
      setDetailTab('overview');
    }
  };

  const getTaskProgressPct = (eventId: string) => {
    const s = taskStats[eventId];
    if (!s || s.total === 0) return null;
    return Math.round((s.completed / s.total) * 100);
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Events Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage all events across all agents, monitor RSVPs, and track performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setEditingEvent(null)} variant="default">
              <Calendar className="h-4 w-4 mr-2" />
              Create Event
            </Button>
            <Button onClick={exportEvents} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{stats.published} published</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcoming}</div>
              <p className="text-xs text-muted-foreground">{stats.past} past events</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total RSVPs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRSVPs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalCapacity > 0 ? `${stats.totalRSVPs}/${stats.totalCapacity} capacity` : 'No capacity limits'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgAttendance}</div>
              <p className="text-xs text-muted-foreground">Average per past event</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events, locations, agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="past">Past</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="unpublished">Unpublished</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Agent</label>
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.user_id} value={agent.user_id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Events ({filteredEvents.length})</CardTitle>
            <CardDescription>Click an event row to view details, RSVPs, tasks, and emails</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="text-muted-foreground">Loading events...</div>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>RSVPs</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                      const status = getEventStatus(event);
                      const agentName = event.profiles 
                        ? `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim() || 'Unknown'
                        : 'Unknown';
                      const isSelected = selectedEvent?.id === event.id;
                      const taskPct = getTaskProgressPct(event.id);
                      const taskStat = taskStats[event.id];

                      return (
                        <>
                          <TableRow
                            key={event.id}
                            className={cn(
                              "cursor-pointer transition-colors",
                              isSelected && "bg-primary/5 border-l-2 border-l-primary"
                            )}
                            onClick={() => handleRowClick(event)}
                          >
                            <TableCell className="w-8 px-2">
                              {isSelected ? (
                                <ChevronDown className="h-4 w-4 text-primary" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{event.title}</div>
                                {event.theme && (
                                  <div className="text-sm text-muted-foreground">{event.theme}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {(() => {
                                  const dateStr = event.event_date.split('T')[0];
                                  const [year, month, day] = dateStr.split('-');
                                  return format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), 'MMM d, yyyy');
                                })()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {(() => {
                                  const timeStr = event.event_date.split('T')[1];
                                  if (timeStr) {
                                    const [hours, minutes] = timeStr.split(':');
                                    const hour24 = parseInt(hours);
                                    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                                    const ampm = hour24 >= 12 ? 'PM' : 'AM';
                                    return `${hour12}:${minutes} ${ampm}`;
                                  }
                                  return '';
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{agentName}</div>
                              {event.profiles?.team_name && (
                                <div className="text-sm text-muted-foreground">
                                  {event.profiles.team_name}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {event.location ? (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{event.location}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{event.current_rsvp_count || 0}</span>
                                {event.max_capacity && (
                                  <span className="text-muted-foreground">/ {event.max_capacity}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {taskPct !== null ? (
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <Progress value={taskPct} className="h-2 flex-1" />
                                  <span className={cn(
                                    "text-xs font-medium whitespace-nowrap",
                                    taskPct >= 75 ? "text-green-600" : taskPct >= 40 ? "text-amber-600" : "text-destructive"
                                  )}>
                                    {taskPct}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant}>
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {event.is_published ? (
                                <Badge variant="default" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Published
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Draft
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                {event.is_published && event.public_slug && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(`/event/${event.public_slug}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingEvent(event as EventWithAgent)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingEvent(event)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Detail Panel */}
                          {isSelected && (
                            <TableRow key={`${event.id}-detail`}>
                              <TableCell colSpan={10} className="p-0 border-l-2 border-l-primary bg-muted/30">
                                <div className="p-6">
                                  <Tabs value={detailTab} onValueChange={setDetailTab}>
                                    <TabsList>
                                      <TabsTrigger value="overview" className="gap-1.5">
                                        <Info className="h-4 w-4" />
                                        Overview
                                      </TabsTrigger>
                                      <TabsTrigger value="rsvps" className="gap-1.5">
                                        <Users className="h-4 w-4" />
                                        RSVPs
                                      </TabsTrigger>
                                      <TabsTrigger value="tasks" className="gap-1.5">
                                        <ListChecks className="h-4 w-4" />
                                        ClickUp Tasks
                                      </TabsTrigger>
                                      <TabsTrigger value="emails" className="gap-1.5">
                                        <Mail className="h-4 w-4" />
                                        Emails
                                      </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="overview" className="mt-4">
                                      <Card>
                                        <CardContent className="pt-6">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                              <h3 className="text-lg font-semibold">{event.title}</h3>
                                              {event.description && (
                                                <p className="text-sm text-muted-foreground">{event.description}</p>
                                              )}
                                              <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                                  <span>{format(new Date(event.event_date), 'EEEE, MMMM d, yyyy h:mm a')}</span>
                                                </div>
                                                {event.location && (
                                                  <div className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                                    <span>{event.location}</span>
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                  <Users className="h-4 w-4 text-muted-foreground" />
                                                  <span>Agent: {agentName}</span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="space-y-3">
                                              <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded-lg bg-background border">
                                                  <p className="text-xs text-muted-foreground">RSVPs</p>
                                                  <p className="text-xl font-bold">{event.current_rsvp_count || 0}{event.max_capacity ? ` / ${event.max_capacity}` : ''}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border">
                                                  <p className="text-xs text-muted-foreground">Tasks</p>
                                                  <p className="text-xl font-bold">
                                                    {taskStat ? `${taskStat.completed}/${taskStat.total}` : '—'}
                                                  </p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border">
                                                  <p className="text-xs text-muted-foreground">Attendance</p>
                                                  <p className="text-xl font-bold">{event.attendance_count || 0}</p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-background border">
                                                  <p className="text-xs text-muted-foreground">Leads</p>
                                                  <p className="text-xl font-bold">{event.leads_generated || 0}</p>
                                                </div>
                                              </div>
                                              {event.is_published && event.public_slug && (
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="w-full"
                                                  onClick={() => window.open(`/event/${event.public_slug}`, '_blank')}
                                                >
                                                  <ExternalLink className="h-4 w-4 mr-2" />
                                                  View Public Page
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </TabsContent>

                                    <TabsContent value="rsvps" className="mt-4">
                                      <RSVPManagement
                                        eventId={event.id}
                                        publicSlug={event.public_slug}
                                      />
                                    </TabsContent>

                                    <TabsContent value="tasks" className="mt-4">
                                      <AdminEventTasks
                                        events={[{ id: event.id, title: event.title, agent_id: event.agent_id }]}
                                        agents={agents}
                                      />
                                    </TabsContent>

                                    <TabsContent value="emails" className="mt-4">
                                      <EmailManagement
                                        eventId={event.id}
                                        eventTitle={event.title}
                                      />
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Event Dialog */}
        {(editingEvent !== undefined) && (
          <EventForm
            event={editingEvent || undefined}
            onClose={() => {
              setEditingEvent(undefined);
              fetchEvents();
            }}
            isAdminMode={true}
            adminAgentId={editingEvent?.agent_id}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingEvent} onOpenChange={() => setDeletingEvent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Event?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{deletingEvent?.title}". This action cannot be undone.
                All RSVPs and associated data will also be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteEvent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default AdminEventsManagement;
