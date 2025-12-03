import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRSVP } from '@/hooks/useRSVP';
import { EventPublicHeader } from '@/components/events/rsvp/EventPublicHeader';
import { RSVPForm } from '@/components/events/rsvp/RSVPForm';
import { RSVPConfirmation } from '@/components/events/rsvp/RSVPConfirmation';
import { RSVPStats } from '@/components/events/rsvp/RSVPStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface EventData {
  id: string;
  title: string;
  event_date: string;
  location?: string;
  description?: string;
  header_image_url?: string;
  brand_color?: string;
  max_capacity?: number;
  current_rsvp_count?: number;
  is_published: boolean;
  profiles?: {
    first_name?: string;
    last_name?: string;
    team_name?: string;
    brokerage?: string;
    phone_number?: string;
    office_number?: string;
    office_address?: string;
    website?: string;
    state_licenses?: string[];
    primary_color?: string;
    secondary_color?: string;
    headshot_url?: string;
    logo_colored_url?: string;
    logo_white_url?: string;
  };
}

const EventPublicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getEventBySlug, submitRSVP } = useRSVP();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [rsvpData, setRsvpData] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!slug) {
      setError('Invalid event link');
      setLoading(false);
      return;
    }

    const fetchEvent = async () => {
      try {
        const eventData = await getEventBySlug(slug);
        setEvent(eventData as EventData);
        setShowStats(true);
      } catch (err: any) {
        setError(err.message || 'Event not found');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug, getEventBySlug]);

  const handleRSVPSuccess = (rsvp: any) => {
    setRsvpSubmitted(true);
    setRsvpData(rsvp);
    // Refresh event data to update RSVP count
    if (slug) {
      getEventBySlug(slug).then((eventData) => {
        setEvent(eventData as EventData);
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-12 w-3/4 mx-auto" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Event not found. This event may have been removed or the link is incorrect.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const agentName = event.profiles && (event.profiles.first_name || event.profiles.last_name)
    ? `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim()
    : undefined;
  
  // Use agent branding colors (from profiles) or event brand color, or default
  const primaryColor = event.profiles?.primary_color || event.brand_color || '#2563eb';
  const secondaryColor = event.profiles?.secondary_color || '#764ba2';

  return (
    <div className="min-h-screen" style={{ backgroundColor: event.profiles?.primary_color ? `${primaryColor}08` : '#f5f7fa' }}>
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="space-y-8">
          {/* Event Header */}
          <EventPublicHeader
            title={event.title}
            eventDate={event.event_date}
            location={event.location}
            description={event.description}
            headerImageUrl={event.header_image_url}
            brandColor={primaryColor}
            agentName={agentName}
            teamName={event.profiles?.team_name}
            brokerage={event.profiles?.brokerage}
            agentLogo={event.profiles?.logo_colored_url}
            agentHeadshot={event.profiles?.headshot_url}
          />

          {/* RSVP Stats (if available) */}
          {showStats && event.max_capacity !== undefined && (
            <RSVPStats
              total={event.current_rsvp_count || 0}
              confirmed={event.current_rsvp_count || 0}
              waitlist={0}
              checkedIn={0}
              maxCapacity={event.max_capacity}
            />
          )}

          {/* RSVP Section */}
          {!rsvpSubmitted ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">RSVP for This Event</CardTitle>
                <p className="text-muted-foreground">
                  Please fill out the form below to confirm your attendance.
                </p>
              </CardHeader>
              <CardContent>
                <RSVPForm
                  eventId={event.id}
                  maxCapacity={event.max_capacity}
                  currentCount={event.current_rsvp_count}
                  onSuccess={handleRSVPSuccess}
                />
              </CardContent>
            </Card>
          ) : (
            <RSVPConfirmation
              eventTitle={event.title}
              eventDate={event.event_date}
              location={event.location}
              guestCount={rsvpData?.guest_count || 1}
              email={rsvpData?.email || ''}
              status={rsvpData?.status || 'confirmed'}
            />
          )}

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Questions?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                If you have any questions about this event, please contact{' '}
                {agentName || 'the event organizer'}.
                {event.profiles?.phone_number && (
                  <> You can reach them at {event.profiles.phone_number}.</>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EventPublicPage;

