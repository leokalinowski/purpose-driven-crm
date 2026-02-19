import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Users, TrendingUp, Star } from 'lucide-react';
import { Event } from '@/hooks/useEvents';

interface EventCardProps {
  event: Event;
  type: 'previous' | 'next';
}

export const EventCard = ({ event, type }: EventCardProps) => {
  const isPrevious = type === 'previous';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">
            {isPrevious ? 'Previous Quarter Event' : 'Next Event'}
          </CardTitle>
          <Badge variant={isPrevious ? 'secondary' : 'default'}>
            {isPrevious ? 'Completed' : 'Upcoming'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{event.title}</h3>
          {event.theme && (
            <p className="text-sm text-muted-foreground">Theme: {event.theme}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {(() => {
                const [datePart] = event.event_date.split('T');
                const [y, m, d] = datePart.split('-').map(Number);
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                return `${months[m-1]} ${d}, ${y}`;
              })()}
            </span>
          </div>

          {event.location && (
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{event.location}</span>
            </div>
          )}
        </div>

        {event.speakers && event.speakers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Speakers</h4>
            <div className="flex flex-wrap gap-1">
              {event.speakers.map((speaker, index) => (
                <Badge key={index} variant="outline">
                  {speaker}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {isPrevious && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t">
            {event.attendance_count !== undefined && (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{event.attendance_count}</p>
                  <p className="text-xs text-muted-foreground">Attended</p>
                </div>
              </div>
            )}

            {event.invited_count !== undefined && (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{event.invited_count}</p>
                  <p className="text-xs text-muted-foreground">Invited</p>
                </div>
              </div>
            )}

            {event.leads_generated !== undefined && (
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{event.leads_generated}</p>
                  <p className="text-xs text-muted-foreground">Leads Generated</p>
                </div>
              </div>
            )}
          </div>
        )}

        {event.feedback_summary && (
          <div className="pt-4 border-t">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Feedback Summary</h4>
            </div>
            <p className="text-sm text-muted-foreground">{event.feedback_summary}</p>
          </div>
        )}

        {event.registration_info && !isPrevious && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Registration Information</h4>
            <p className="text-sm text-muted-foreground">{event.registration_info}</p>
          </div>
        )}

        {event.description && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground">{event.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};