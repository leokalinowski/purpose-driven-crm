/**
 * EventPublicPage — guest-facing RSVP page at /event/:slug.
 *
 * Phase 2 of the Events comprehensive sweep. This is the URL the agent
 * shares with their sphere; it has to feel like *their* page, not a
 * generic SaaS form. Rewrite focuses:
 *
 *   - Replace `bg-gray-50` and `${primaryColor}08` chrome with proper
 *     design tokens (bg-background, bg-card, border-border) so light
 *     and dark themes both work.
 *   - Inline Lucide icons instead of raw <svg>.
 *   - Tighter mobile layout (the previous layout had giant circular icon
 *     badges that ate most of the contact card on a phone).
 *   - Keep the agent's brand color for true brand moments (RSVP form
 *     accent, contact card accents) but tokenize everything structural.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useRSVP } from '@/hooks/useRSVP';
import { EventPublicHeader } from '@/components/events/rsvp/EventPublicHeader';
import { RSVPForm } from '@/components/events/rsvp/RSVPForm';
import { RSVPConfirmation } from '@/components/events/rsvp/RSVPConfirmation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle, Phone, Mail, Building2, Globe, Users,
} from 'lucide-react';

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
  const { getEventBySlug } = useRSVP();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [rsvpData, setRsvpData] = useState<{ guest_count?: number; email?: string; status?: string } | null>(null);

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
      } catch (err: any) {
        setError(err.message || 'Event not found');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [slug, getEventBySlug]);

  const handleRSVPSuccess = () => {
    setRsvpSubmitted(true);
    setRsvpData(null);
    // Refresh event so the count + at-capacity badge updates if relevant.
    if (slug) {
      getEventBySlug(slug).then((eventData) => setEvent(eventData as EventData));
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
          <Skeleton className="aspect-[16/7] w-full rounded-2xl" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────
  if (error || !event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'This event link is no longer active. The event may have been removed or the URL is incorrect.'}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const agentName = event.profiles && (event.profiles.first_name || event.profiles.last_name)
    ? `${event.profiles.first_name || ''} ${event.profiles.last_name || ''}`.trim()
    : undefined;

  // Agent brand color — single source of truth used by the header + the
  // contact-card accent dots. Defaults to the app primary if the agent
  // hasn't customized.
  const primaryColor = event.profiles?.primary_color || event.brand_color || 'hsl(var(--primary))';
  const eventDate = parseISO(event.event_date);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-10 max-w-3xl space-y-6">
        {/* Hero card */}
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

        {/* RSVP form / confirmation */}
        {!rsvpSubmitted ? (
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="text-xl font-medium tracking-tight mb-1">RSVP for this event</h2>
              <p className="text-sm text-muted-foreground">
                Confirm your attendance — {format(eventDate, 'EEE, MMM d')}
              </p>
            </div>
            <RSVPForm
              eventId={event.id}
              maxCapacity={event.max_capacity}
              currentCount={event.current_rsvp_count}
              onSuccess={handleRSVPSuccess}
            />
          </section>
        ) : (
          <RSVPConfirmation
            eventTitle={event.title}
            eventDate={event.event_date}
            location={event.location}
            guestCount={rsvpData?.guest_count || 1}
            email={rsvpData?.email || ''}
            status={(rsvpData?.status as 'confirmed' | 'waitlist') || 'confirmed'}
          />
        )}

        {/* Compact host contact block — only shown when there's at least one
            useful field. Drops the previous oversized circular icon badges
            in favor of inline Lucide icons + tight rows. */}
        {event.profiles && (agentName || event.profiles.phone_number || event.profiles.email || event.profiles.website) && (
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Get in touch with the host
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              {event.profiles.phone_number && (
                <ContactRow
                  icon={Phone}
                  label="Phone"
                  primaryColor={primaryColor}
                  primary={
                    <a href={`tel:${event.profiles.phone_number}`} className="font-semibold hover:underline">
                      {event.profiles.phone_number}
                    </a>
                  }
                  secondary={event.profiles.office_number ? (
                    <span className="text-xs text-muted-foreground">
                      Office:{' '}
                      <a href={`tel:${event.profiles.office_number}`} className="hover:underline">
                        {event.profiles.office_number}
                      </a>
                    </span>
                  ) : null}
                />
              )}
              {event.profiles.email && (
                <ContactRow
                  icon={Mail}
                  label="Email"
                  primaryColor={primaryColor}
                  primary={
                    <a href={`mailto:${event.profiles.email}`} className="font-semibold hover:underline break-all">
                      {event.profiles.email}
                    </a>
                  }
                />
              )}
              {(event.profiles.brokerage || event.profiles.team_name) && (
                <ContactRow
                  icon={event.profiles.brokerage ? Building2 : Users}
                  label="Brokerage"
                  primaryColor={primaryColor}
                  primary={event.profiles.brokerage ? <span className="font-semibold">{event.profiles.brokerage}</span> : null}
                  secondary={event.profiles.team_name ? (
                    <span className="text-xs text-muted-foreground">{event.profiles.team_name}</span>
                  ) : null}
                />
              )}
              {event.profiles.website && (
                <ContactRow
                  icon={Globe}
                  label="Website"
                  primaryColor={primaryColor}
                  primary={
                    <a
                      href={event.profiles.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline break-all"
                    >
                      {event.profiles.website.replace(/^https?:\/\//, '')}
                    </a>
                  }
                />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default EventPublicPage;

// ── Helpers ────────────────────────────────────────────────────────────

function ContactRow({
  icon: Icon, label, primary, secondary, primaryColor,
}: {
  icon: typeof Phone;
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  primaryColor: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 12%, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color: primaryColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm">{primary}</div>
        {secondary && <div className="mt-0.5">{secondary}</div>}
      </div>
    </div>
  );
}
