import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Layout } from '@/components/layout/Layout';
import { UpgradePrompt } from '@/components/ui/UpgradePrompt';
import { EventProgressDashboard } from '@/components/events/EventProgressDashboard';
import { EventForm } from '@/components/events/EventForm';
import { RSVPManagement } from '@/components/events/RSVPManagement';
import { EmailManagement } from '@/components/events/email/EmailManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, ExternalLink, Edit, Trash2, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { buildAuthRedirectPath } from '@/utils/authRedirect';
import { format } from 'date-fns';

const Events = () => {
  const { hasAccess, currentTier, getRequiredTier } = useFeatureAccess();
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('my-event');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { 
    events, 
    loading, 
    getNextEvent,
    getPreviousQuarterEvent,
    deleteEvent
  } = useEvents();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(buildAuthRedirectPath(), { replace: true });
    } else if (user) {
      document.title = 'Events | Real Estate on Purpose';
    }
  }, [user, authLoading, navigate]);

  // Determine the active event: user-selected > next upcoming > most recent past
  const activeEvent = useMemo(() => {
    if (selectedEventId) {
      return events.find(e => e.id === selectedEventId) || null;
    }
    return getNextEvent() || getPreviousQuarterEvent() || null;
  }, [selectedEventId, events, getNextEvent, getPreviousQuarterEvent]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-64 sm:w-96" />
            </div>
            <Skeleton className="h-10 w-full sm:w-32" />
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  if (!hasAccess('/events')) {
    return (
      <Layout>
        <UpgradePrompt
          featureName="Events"
          requiredTier={getRequiredTier('/events') || 'managed'}
          currentTier={currentTier}
          description="Plan, manage, and track your client appreciation events, seminars, and workshops with RSVP tracking and email invitations."
        />
      </Layout>
    );
  }

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId === selectedEventId ? null : eventId);
  };

  const handleViewRSVPs = (eventId: string) => {
    setSelectedEventId(eventId);
    setActiveTab('rsvps');
  };

  const formatEventDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return new Date(dateStr).toLocaleDateString();
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">Events</span>
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Events that build relationships.</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track preparation progress and manage RSVPs.
            </p>
          </div>
          <Button onClick={() => setShowEventForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="my-event">My Event</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
            <TabsTrigger value="all-events">All Events</TabsTrigger>
          </TabsList>

          {/* My Event Tab - Progress Dashboard */}
          <TabsContent value="my-event" className="mt-4">
            {activeEvent ? (
              <EventProgressDashboard event={activeEvent} />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create an event to start tracking your preparation progress.
                  </p>
                  <Button onClick={() => setShowEventForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Emails Tab */}
          <TabsContent value="emails" className="mt-4">
            {activeEvent ? (
              <EmailManagement
                eventId={activeEvent.id}
                eventTitle={activeEvent.title}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create an event to manage email templates and send invitations.
                  </p>
                  <Button onClick={() => setShowEventForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* RSVPs Tab */}
          <TabsContent value="rsvps" className="mt-4">
            {activeEvent ? (
              <RSVPManagement 
                eventId={activeEvent.id}
                publicSlug={activeEvent.public_slug}
                maxCapacity={activeEvent.max_capacity ?? undefined}
              />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No events available for RSVP management.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* All Events Tab */}
          <TabsContent value="all-events" className="mt-4">
            {events.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Event Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div 
                        key={event.id} 
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedEventId === event.id ? 'ring-2 ring-primary bg-muted/30' : ''
                        }`}
                        onClick={() => handleSelectEvent(event.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{event.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatEventDate(event.event_date)}
                          </p>
                          {event.location && (
                            <p className="text-sm text-muted-foreground">{event.location}</p>
                          )}
                          {event.public_slug && (
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">Published</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/event/${event.public_slug}`, '_blank');
                                }}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Public Page
                              </Button>
                            </div>
                          )}
                          {event.current_rsvp_count !== undefined && event.current_rsvp_count > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {event.current_rsvp_count} RSVP{event.current_rsvp_count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="mr-2">
                            {new Date(event.event_date) < new Date() ? (
                              <Badge variant="secondary">Completed</Badge>
                            ) : (
                              <Badge>Upcoming</Badge>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEvent(event);
                              setShowEventForm(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
                                try {
                                  await deleteEvent(event.id);
                                  if (selectedEventId === event.id) {
                                    setSelectedEventId(null);
                                  }
                                } catch (error: any) {
                                  alert('Failed to delete event: ' + error.message);
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRSVPs(event.id);
                            }}
                          >
                            View RSVPs
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Start by creating your first event.
                  </p>
                  <Button onClick={() => setShowEventForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Event
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {showEventForm && (
          <EventForm 
            event={editingEvent || undefined}
            onClose={() => {
              setShowEventForm(false);
              setEditingEvent(null);
            }} 
          />
        )}
      </div>
    </Layout>
  );
};

export default Events;
