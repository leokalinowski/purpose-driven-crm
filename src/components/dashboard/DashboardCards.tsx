import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Mail, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

export function DashboardCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,234</div>
          <p className="text-xs text-muted-foreground">
            +20% from last month
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Event Tasks Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">75%</div>
          <p className="text-xs text-muted-foreground">
            Next event preparation
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">3</div>
          <p className="text-xs text-muted-foreground">
            Next 7 days
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Newsletter Open Rate</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">24.5%</div>
          <p className="text-xs text-muted-foreground">
            Latest campaign
          </p>
        </CardContent>
      </Card>
    </div>
  );
}