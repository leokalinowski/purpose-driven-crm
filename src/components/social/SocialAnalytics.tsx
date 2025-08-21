import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSocialAnalytics, useRefreshAnalytics, type SocialAnalytics } from '@/hooks/useSocialScheduler';

interface SocialAnalyticsProps {
  agentId?: string;
}

const PLATFORM_COLORS = {
  facebook: '#1877f2',
  instagram: '#e4405f',
  linkedin: '#0077b5',
  twitter: '#1da1f2',
  tiktok: '#000000',
};

const COLORS = ['#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#8884d8'];

export function SocialAnalytics({ agentId }: SocialAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('30');
  const startDate = format(subDays(new Date(), parseInt(timeRange)), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');

  const { data: analytics = [], isLoading, refetch } = useSocialAnalytics(agentId, startDate, endDate);
  const refreshAnalytics = useRefreshAnalytics();

  const handleRefresh = () => {
    refreshAnalytics.mutate(agentId);
  };

  // Group analytics by platform and date
  const platformData = analytics.reduce((acc, item) => {
    if (!acc[item.platform]) {
      acc[item.platform] = [];
    }
    acc[item.platform].push(item);
    return acc;
  }, {} as Record<string, SocialAnalytics[]>);

  // Calculate totals by platform
  const platformTotals = Object.entries(platformData).map(([platform, data]) => {
    const totals = data.reduce(
      (sum, item) => ({
        followers: Math.max(sum.followers, item.followers),
        engagement: sum.engagement + item.likes + item.comments + item.shares,
        reach: sum.reach + item.reach,
        impressions: sum.impressions + item.impressions,
      }),
      { followers: 0, engagement: 0, reach: 0, impressions: 0 }
    );

    return {
      platform,
      ...totals,
      fill: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#8884d8',
    };
  });

  // Prepare time series data
  const timeSeriesData = analytics.reduce((acc, item) => {
    const date = item.metric_date;
    const existing = acc.find(d => d.date === date);
    
    if (existing) {
      existing.followers += item.followers;
      existing.engagement += item.likes + item.comments + item.shares;
      existing.reach += item.reach;
      existing.impressions += item.impressions;
    } else {
      acc.push({
        date,
        followers: item.followers,
        engagement: item.likes + item.comments + item.shares,
        reach: item.reach,
        impressions: item.impressions,
      });
    }
    
    return acc;
  }, [] as any[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalMetrics = {
    followers: platformTotals.reduce((sum, p) => sum + p.followers, 0),
    engagement: platformTotals.reduce((sum, p) => sum + p.engagement, 0),
    reach: platformTotals.reduce((sum, p) => sum + p.reach, 0),
    impressions: platformTotals.reduce((sum, p) => sum + p.impressions, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Social Media Analytics</h3>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshAnalytics.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${refreshAnalytics.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Followers</CardDescription>
            <CardTitle className="text-2xl">{totalMetrics.followers.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Engagement</CardDescription>
            <CardTitle className="text-2xl">{totalMetrics.engagement.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Reach</CardDescription>
            <CardTitle className="text-2xl">{totalMetrics.reach.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Impressions</CardDescription>
            <CardTitle className="text-2xl">{totalMetrics.impressions.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="platforms">By Platform</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Followers Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                    formatter={(value: number) => [value.toLocaleString(), 'Followers']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="followers" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                    formatter={(value: number) => [value.toLocaleString(), 'Engagement']}
                  />
                  <Bar dataKey="engagement" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Followers by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformTotals}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ platform, followers }) => `${platform}: ${followers.toLocaleString()}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="followers"
                    >
                      {platformTotals.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Followers']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={platformTotals} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="platform" type="category" />
                    <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Engagement']} />
                    <Bar dataKey="engagement" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}