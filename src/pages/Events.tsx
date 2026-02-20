import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useContacts } from '@/hooks/useContacts';
import { Layout } from '@/components/layout/Layout';
import { EventProgressDashboard } from '@/components/events/EventProgressDashboard';
import { EventForm } from '@/components/events/EventForm';
import { RSVPManagement } from '@/components/events/RSVPManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, ExternalLink, Edit, Trash2, Users, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Events = () => {
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    events, 
    loading, 
    getNextEvent,
    deleteEvent
  } = useEvents();
  const { contacts } = useContacts();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      document.title = 'Events | Real Estate on Purpose';
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  const nextEvent = getNextEvent();
  const eligibleContactCount = contacts.filter(c => !c.dnc && c.email).length;

  const handleSendInvitations = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event?.public_slug) {
      toast({ title: 'Event not published', description: 'Publish the event first to create a public RSVP page.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Send invitation emails to ${eligibleContactCount} contacts in your database?\n\nContacts on the DNC list or without email will be skipped. Already-invited contacts won't receive duplicates.`)) return;

    setSendingInvites(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-event-invitation', { body: { eventId } });
      if (error) throw error;
      toast({ title: 'Invitations sent!', description: data?.message || `Sent ${data?.sent} emails.` });
    } catch (err: any) {
      toast({ title: 'Error sending invitations', description: err.message, variant: 'destructive' });
    } finally {
      setSendingInvites(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground">
              Track your event preparation progress and manage RSVPs.
            </p>
          </div>
          <Button onClick={() => setShowEventForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>

        <Tabs defaultValue="my-event" className="w-full">
          <TabsList>
            <TabsTrigger value="my-event">My Event</TabsTrigger>
            <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
            <TabsTrigger value="all-events">All Events</TabsTrigger>
          </TabsList>

          {/* My Event Tab - Progress Dashboard */}
          <TabsContent value="my-event" className="mt-4">
            {nextEvent ? (
              <div className="space-y-4">
                {nextEvent.public_slug && (
                  <Card>
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <h4 className="font-medium">Invite Your Database</h4>
                        <p className="text-sm text-muted-foreground">
                          Send invitation emails to {eligibleContactCount} eligible contacts
                        </p>
                      </div>
                      <Button
                        onClick={() => handleSendInvitations(nextEvent.id)}
                        disabled={sendingInvites || eligibleContactCount === 0}
                      >
                        {sendingInvites ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                        {sendingInvites ? 'Sending...' : 'Invite Database'}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <EventProgressDashboard event={nextEvent} />
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Upcoming Events</h3>
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

          {/* RSVPs Tab */}
          <TabsContent value="rsvps" className="mt-4">
            {(selectedEventId || nextEvent?.id) ? (
              <RSVPManagement 
                eventId={selectedEventId || nextEvent?.id || ''}
                publicSlug={events.find(e => e.id === (selectedEventId || nextEvent?.id))?.public_slug}
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
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.event_date).toLocaleDateString()}
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
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-4">
                            {new Date(event.event_date) < new Date() ? (
                              <span className="text-sm text-green-600">Completed</span>
                            ) : (
                              <span className="text-sm text-blue-600">Upcoming</span>
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
                              setSelectedEventId(event.id === selectedEventId ? null : event.id);
                            }}
                          >
                            {selectedEventId === event.id ? 'Hide RSVPs' : 'View RSVPs'}
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
