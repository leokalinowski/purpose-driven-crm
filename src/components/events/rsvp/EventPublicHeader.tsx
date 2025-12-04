import { Calendar, MapPin, Clock, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';

interface EventPublicHeaderProps {
  title: string;
  eventDate: string;
  location?: string;
  description?: string;
  headerImageUrl?: string;
  brandColor?: string;
  agentName?: string;
  teamName?: string;
  brokerage?: string;
  agentLogo?: string;
  agentHeadshot?: string;
}

export const EventPublicHeader = ({
  title,
  eventDate,
  location,
  description,
  headerImageUrl,
  brandColor,
  agentName,
  teamName,
  brokerage,
  agentLogo,
  agentHeadshot,
}: EventPublicHeaderProps) => {
  const primaryColor = brandColor || '#2563eb';

  return (
    <div className="space-y-6">
      {/* Header Image */}
      {headerImageUrl && (
        <div className="w-full h-64 md:h-96 rounded-lg overflow-hidden">
          <img
            src={headerImageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Event Title */}
      <div className="text-center space-y-4">
        {(agentLogo || agentHeadshot) && (
          <div className="flex justify-center mb-4">
            {agentLogo ? (
              <img 
                src={agentLogo} 
                alt={`${agentName || 'Agent'} logo`}
                className="h-24 w-auto object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : agentHeadshot ? (
              <img 
                src={agentHeadshot} 
                alt={agentName || 'Agent'}
                className="h-24 w-24 rounded-full object-cover border-4 shadow-lg"
                style={{ borderColor: primaryColor }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : null}
          </div>
        )}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {agentName && (
          <p className="text-lg text-muted-foreground">
            Hosted by {agentName}
            {teamName && ` • ${teamName}`}
            {brokerage && ` • ${brokerage}`}
          </p>
        )}
      </div>

      {/* Event Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-full p-2"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Calendar className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                <p className="font-semibold">
                  {format(new Date(eventDate), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(eventDate), 'h:mm a')}
                </p>
              </div>
            </div>

            {location && (
              <div className="flex items-start gap-3">
                <div
                  className="rounded-full p-2"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="font-semibold">{location}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div
                className="rounded-full p-2"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <Users className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Event Type</p>
                <p className="font-semibold">Public Event</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {description && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-3">About This Event</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

