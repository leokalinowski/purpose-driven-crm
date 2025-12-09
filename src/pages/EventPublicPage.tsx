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
import { AlertCircle, MapPin, Users } from 'lucide-react';

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
    email?: string;
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
                  onSuccess={() => handleRSVPSuccess(null)}
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

          {/* Agent Contact Information */}
          {event.profiles && (agentName || event.profiles.phone_number || event.profiles.email || event.profiles.office_address) && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Get in touch with {agentName || 'the event organizer'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.profiles.phone_number && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-full p-2" style={{ backgroundColor: `${primaryColor}20` }}>
                        <svg className="h-5 w-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone</p>
                        <a href={`tel:${event.profiles.phone_number}`} className="font-semibold hover:underline">
                          {event.profiles.phone_number}
                        </a>
                        {event.profiles.office_number && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Office: <a href={`tel:${event.profiles.office_number}`} className="hover:underline">{event.profiles.office_number}</a>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {event.profiles.email && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-full p-2" style={{ backgroundColor: `${primaryColor}20` }}>
                        <svg className="h-5 w-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <a href={`mailto:${event.profiles.email}`} className="font-semibold hover:underline break-all">
                          {event.profiles.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {event.profiles.office_address && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-full p-2" style={{ backgroundColor: `${primaryColor}20` }}>
                        <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Office Address</p>
                        <p className="font-semibold whitespace-pre-line">{event.profiles.office_address}</p>
                      </div>
                    </div>
                  )}

                  {(event.profiles.brokerage || event.profiles.team_name) && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-full p-2" style={{ backgroundColor: `${primaryColor}20` }}>
                        <Users className="h-5 w-5" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Brokerage & Team</p>
                        {event.profiles.brokerage && (
                          <p className="font-semibold">{event.profiles.brokerage}</p>
                        )}
                        {event.profiles.team_name && (
                          <p className="text-sm text-muted-foreground">{event.profiles.team_name}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {event.profiles.website && (
                    <div className="flex items-start gap-3">
                      <div className="rounded-full p-2" style={{ backgroundColor: `${primaryColor}20` }}>
                        <svg className="h-5 w-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Website</p>
                        <a href={event.profiles.website} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline break-all">
                          {event.profiles.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPublicPage;

