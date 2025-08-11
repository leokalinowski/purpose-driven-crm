import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Users, Calendar, Mail, TrendingUp, CheckCircle, Briefcase, GraduationCap, Pin } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useWidgetPreferences } from '@/hooks/useWidgetPreferences';

const KPI_ORDER: Array<{
  key: keyof ReturnType<typeof useDashboardMetrics>['data']['kpis'];
  title: string;
  icon: React.ComponentType<any>;
  link: string;
}> = [
  { key: 'totalContacts', title: 'Total Leads', icon: Users, link: '/database' },
  { key: 'po2CompletionRate', title: 'PO2 Completion Rate', icon: CheckCircle, link: '/po2-tasks' },
  { key: 'upcomingEvents', title: 'Upcoming Events', icon: Calendar, link: '/events' },
  { key: 'newsletterOpenRate', title: 'Newsletter Open Rate', icon: Mail, link: '/newsletter' },
  { key: 'activeTransactions', title: 'Active Transactions', icon: Briefcase, link: '/transactions' },
  { key: 'coachingSessions', title: 'Coaching Sessions', icon: GraduationCap, link: '/coaching' },
];

export function DashboardCards() {
  const { data, loading } = useDashboardMetrics();
  const { pinned, togglePinned, isPinned } = useWidgetPreferences();

  const items = KPI_ORDER;

  const sorted = [...items].sort((a, b) => {
    const ap = isPinned(a.key as any) ? 0 : 1;
    const bp = isPinned(b.key as any) ? 0 : 1;
    return ap - bp;
  });

  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-6 w-24 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {sorted.map(({ key, title, icon: Icon, link }) => {
        const kpi = data.kpis[key as keyof typeof data.kpis]!;
        const delta = kpi.deltaPct;
        const positive = typeof delta === 'number' ? delta >= 0 : undefined;
        return (
          <Card key={key} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {title}
              </CardTitle>
              <button
                aria-label={isPinned(key as any) ? 'Unpin widget' : 'Pin widget'}
                onClick={() => togglePinned(key as any)}
                className="opacity-70 hover:opacity-100 transition"
              >
                <Pin className={`h-4 w-4 ${isPinned(key as any) ? '' : 'rotate-45'}`} />
              </button>
            </CardHeader>
            <CardContent>
              <Link to={link} className="block" data-kpi={String(key)}>
                <div className="text-2xl font-bold" data-kpi-value>
                  {kpi.value}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2" data-kpi-subtext>
                  {typeof delta === 'number' && (
                    <span className="inline-flex items-center gap-1">
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                      {`${positive ? '+' : ''}${Math.abs(Math.round(delta))}%`}
                    </span>
                  )}
                  <span>{kpi.subtext}</span>
                </p>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
