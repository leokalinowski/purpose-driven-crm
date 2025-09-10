import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { Layout } from '@/components/layout/Layout';
import { EventCard } from '@/components/events/EventCard';
import { TaskManagement } from '@/components/events/TaskManagement';
import { EventForm } from '@/components/events/EventForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const Events = () => {
  const [showEventForm, setShowEventForm] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { 
    events, 
    tasks, 
    loading, 
    getPreviousQuarterEvent, 
    getNextEvent 
  } = useEvents();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      document.title = 'Events | Real Estate on Purpose';
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const previousEvent = getPreviousQuarterEvent();
  const nextEvent = getNextEvent();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground">
              Manage your events and track preparation tasks.
            </p>
          </div>
          <Button onClick={() => setShowEventForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>

        {/* Events Overview */}
        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem value="previous">
            <AccordionTrigger>Previous Quarter Event</AccordionTrigger>
            <AccordionContent>
              {previousEvent ? (
                <EventCard event={previousEvent} type="previous" />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>Previous Quarter Event</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      No events found from the previous quarter.
                    </p>
                  </CardContent>
                </Card>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="next">
            <AccordionTrigger>Next Quarter Event</AccordionTrigger>
            <AccordionContent>
              {nextEvent ? (
                <EventCard event={nextEvent} type="next" />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5" />
                      <span>Next Event</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      No upcoming events scheduled.
                    </p>
                    <Button className="mt-4" onClick={() => setShowEventForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Event
                    </Button>
                  </CardContent>
                </Card>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Task Management - Now shows all events with selector */}
        <div className="mb-8">
          <TaskManagement 
            eventId={nextEvent?.id} 
            tasks={tasks} 
          />
        </div>

        {/* All Events Timeline */}
        {events.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Event Timeline</h2>
            <Card>
              <CardHeader>
                <CardTitle>All Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {events.map((event) => (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{event.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(event.event_date).toLocaleDateString()}
                        </p>
                        {event.location && (
                          <p className="text-sm text-muted-foreground">
                            {event.location}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {new Date(event.event_date) < new Date() ? (
                          <span className="text-sm text-green-600">Completed</span>
                        ) : (
                          <span className="text-sm text-blue-600">Upcoming</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {events.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start by creating your first event to track progress and manage tasks.
              </p>
              <Button onClick={() => setShowEventForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Event
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Event Form Modal */}
        {showEventForm && (
          <EventForm onClose={() => setShowEventForm(false)} />
        )}
      </div>
    </Layout>
  );
};

export default Events;