import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSocialPosts, type SocialPost } from '@/hooks/useSocialScheduler';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface SocialCalendarProps {
  agentId?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: SocialPost;
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-600',
  linkedin: 'bg-blue-700',
  twitter: 'bg-slate-900',
  tiktok: 'bg-slate-900',
};

export function SocialCalendar({ agentId }: SocialCalendarProps) {
  const { data: posts = [], isLoading } = useSocialPosts(agentId);

  const events: CalendarEvent[] = useMemo(() => {
    return posts.map((post) => {
      const startDate = new Date(post.schedule_time);
      const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 minutes duration

      return {
        id: post.id,
        title: `${post.platform}: ${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}`,
        start: startDate,
        end: endDate,
        resource: post,
      };
    });
  }, [posts]);

  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const post = event.resource;
    const platformColor = PLATFORM_COLORS[post.platform] || 'bg-gray-600';
    
    return (
      <div className="p-1 text-xs">
        <Badge 
          variant="secondary" 
          className={`${platformColor} text-white mb-1 text-xs px-1`}
        >
          {post.platform}
        </Badge>
        <div className="truncate" title={post.content}>
          {post.content}
        </div>
        <Badge 
          variant="outline" 
          className={`text-xs mt-1 ${
            post.status === 'posted' ? 'bg-green-100 text-green-800' :
            post.status === 'failed' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}
        >
          {post.status}
        </Badge>
      </div>
    );
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const post = event.resource;
    const baseColor = PLATFORM_COLORS[post.platform] || '#6b7280';
    
    return {
      style: {
        backgroundColor: post.status === 'posted' ? '#10b981' : 
                       post.status === 'failed' ? '#ef4444' : baseColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Content Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="text-muted-foreground">Loading calendar...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Calendar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[600px]">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            components={{
              event: EventComponent,
            }}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day']}
            defaultView="month"
            popup
            selectable
            className="rounded-md border"
            style={{ height: '100%' }}
          />
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="text-sm font-medium">Status:</div>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Scheduled</Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800">Posted</Badge>
          <Badge variant="secondary" className="bg-red-100 text-red-800">Failed</Badge>
        </div>
      </CardContent>
    </Card>
  );
}