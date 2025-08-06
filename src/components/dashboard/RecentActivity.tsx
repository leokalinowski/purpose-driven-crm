import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const recentActivities = [
  {
    id: 1,
    action: 'New lead added',
    description: 'John Smith from website contact form',
    time: '2 hours ago',
    status: 'new'
  },
  {
    id: 2,
    action: 'DTD2 task completed',
    description: 'Follow-up call with Maria Garcia',
    time: '4 hours ago',
    status: 'completed'
  },
  {
    id: 3,
    action: 'Event scheduled',
    description: 'Open house at 123 Main St',
    time: '6 hours ago',
    status: 'scheduled'
  },
  {
    id: 4,
    action: 'Newsletter sent',
    description: 'Monthly market update to 1,200 subscribers',
    time: '1 day ago',
    status: 'sent'
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest actions and updates in your CRM
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between space-x-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {activity.action}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">{activity.status}</Badge>
                <p className="text-xs text-muted-foreground">
                  {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}