import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Phone, Mail, Share, Calendar, Zap, Users, MessageCircle, UserPlus, UserMinus, CalendarCheck } from 'lucide-react';
import type { BlockOneTouchpoints } from '@/hooks/useDashboardBlocks';

interface Props {
  data: BlockOneTouchpoints;
}

export function WeeklyTouchpoints({ data }: Props) {
  const { totalTouchpoints, uniqueContactsTouched, breakdown, scoreboard } = data;
  const total = Math.max(totalTouchpoints, 1);
  const convoPct = Math.min(100, Math.round((scoreboard.conversations / 25) * 100));

  const channels = [
    { label: 'SphereSync', value: breakdown.spheresync, icon: Phone, color: 'bg-primary' },
    { label: 'Events', value: breakdown.events, icon: Calendar, color: 'bg-chart-2' },
    { label: 'Newsletter', value: breakdown.newsletter, icon: Mail, color: 'bg-chart-3' },
    { label: 'Social', value: breakdown.social, icon: Share, color: 'bg-chart-4' },
  ];

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" />
          This Week's Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hero: Conversations toward 25 */}
        {scoreboard.submitted && (
          <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center justify-center gap-2 mb-1">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Conversations This Week</span>
            </div>
            <div className="text-4xl font-bold text-primary">{scoreboard.conversations}</div>
            <div className="text-sm text-muted-foreground mt-1">{scoreboard.conversations} / 25 conversations</div>
            <Progress value={convoPct} className="h-2 mt-2 max-w-xs mx-auto" />
          </div>
        )}

        {/* Scoreboard Metrics Grid */}
        {scoreboard.submitted && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <Phone className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{scoreboard.activationAttempts}</div>
              <p className="text-xs text-muted-foreground">Sphere Activations</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <MessageCircle className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{scoreboard.conversations}</div>
              <p className="text-xs text-muted-foreground">Relationships</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <CalendarCheck className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{scoreboard.appointmentsSet}</div>
              <p className="text-xs text-muted-foreground">Opportunities</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <UserPlus className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{scoreboard.contactsAdded}</div>
              <p className="text-xs text-muted-foreground">DB Growth</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <UserMinus className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{scoreboard.contactsRemoved}</div>
              <p className="text-xs text-muted-foreground">DB Hygiene</p>
            </div>
          </div>
        )}

        {/* System touchpoints */}
        <div>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{totalTouchpoints}</div>
              <p className="text-sm text-muted-foreground mt-1">Total Touchpoints</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary flex items-center justify-center gap-2">
                <Users className="h-7 w-7" />
                {uniqueContactsTouched}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Contacts Touched</p>
            </div>
          </div>

          {/* Breakdown bar */}
          <div className="w-full h-4 rounded-full bg-muted flex overflow-hidden mb-3">
            {channels.map(ch => (
              ch.value > 0 && (
                <div
                  key={ch.label}
                  className={`${ch.color} h-full transition-all`}
                  style={{ width: `${(ch.value / total) * 100}%` }}
                />
              )
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            {channels.map(ch => (
              <div key={ch.label} className="flex items-center gap-1.5">
                <ch.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{ch.label}</span>
                <span className="font-semibold">{ch.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
