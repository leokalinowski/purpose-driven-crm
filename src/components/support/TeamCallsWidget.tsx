import { useState, useEffect } from 'react';
import { Video, ExternalLink, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Update these with your actual Zoom/Meet links
const ZOOM_LINK = 'https://zoom.us/j/YOUR_MEETING_ID';

const SCHEDULE = [
  { day: 2, dayName: 'Tuesday', hour: 15, minute: 0, label: '3:00 PM' },
  { day: 4, dayName: 'Thursday', hour: 11, minute: 0, label: '11:00 AM' },
] as const;

function isLiveNow(dayOfWeek: number, hour: number, minute: number) {
  const now = new Date();
  if (now.getDay() !== dayOfWeek) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = hour * 60 + minute;
  return nowMinutes >= startMinutes && nowMinutes < startMinutes + 60;
}

function getNextOccurrence(dayOfWeek: number, hour: number, minute: number) {
  const now = new Date();
  const current = now.getDay();
  let daysUntil = (dayOfWeek - current + 7) % 7;
  if (daysUntil === 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= hour * 60 + minute + 60) daysUntil = 7;
  }
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil} days`;
}

export function TeamCallsWidget() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Video className="h-5 w-5" />
          Weekly Team Calls
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Join our recurring onboarding &amp; support calls
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCHEDULE.map((slot) => {
            const live = isLiveNow(slot.day, slot.hour, slot.minute);
            const next = getNextOccurrence(slot.day, slot.hour, slot.minute);

            return (
              <div
                key={slot.day}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {slot.dayName}s at {slot.label}
                    </span>
                  </div>
                  {live && (
                    <Badge className="bg-green-600 text-white gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      Live Now
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {live ? 'The call is happening right now!' : `Next call: ${next}`}
                </p>

                <Button asChild size="sm" variant={live ? 'default' : 'outline'}>
                  <a href={ZOOM_LINK} target="_blank" rel="noopener noreferrer">
                    Join Call
                    <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
