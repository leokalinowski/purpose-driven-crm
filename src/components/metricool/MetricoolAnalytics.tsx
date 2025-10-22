import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, TrendingUp, Users, MessageSquare, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MetricoolAnalyticsProps {
  agentId?: string;
}

// Placeholder data - in real implementation, this would come from Metricool API
const mockMetricoolData = [
  { date: '2024-01-01', followers: 1250, engagement: 45, posts: 3, impressions: 2500 },
  { date: '2024-01-02', followers: 1280, engagement: 52, posts: 2, impressions: 2800 },
  { date: '2024-01-03', followers: 1320, engagement: 38, posts: 1, impressions: 2100 },
  { date: '2024-01-04', followers: 1350, engagement: 67, posts: 4, impressions: 3200 },
  { date: '2024-01-05', followers: 1380, engagement: 41, posts: 2, impressions: 2600 },
  { date: '2024-01-06', followers: 1420, engagement: 55, posts: 3, impressions: 2900 },
  { date: '2024-01-07', followers: 1450, engagement: 49, posts: 2, impressions: 2700 },
];

export function MetricoolAnalytics({ agentId }: MetricoolAnalyticsProps) {
  const [timeRange, setTimeRange] = useState('7');

  // Filter data based on time range
  const filteredData = mockMetricoolData.slice(-parseInt(timeRange));

  const totalFollowers = filteredData[filteredData.length - 1]?.followers || 0;
  const totalEngagement = filteredData.reduce((sum, item) => sum + item.engagement, 0);
  const totalPosts = filteredData.reduce((sum, item) => sum + item.posts, 0);
  const avgEngagement = totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0;

  const followerGrowth = filteredData.length > 1
    ? filteredData[filteredData.length - 1].followers - filteredData[0].followers
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Metricool Analytics</h2>
          <p className="text-muted-foreground">Track your social media performance across platforms</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Followers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFollowers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {followerGrowth > 0 ? '+' : ''}{followerGrowth} from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Engagement</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement}%</div>
            <p className="text-xs text-muted-foreground">Per post engagement rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPosts}</div>
            <p className="text-xs text-muted-foreground">Posts in selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredData.length > 1
                ? (filteredData[filteredData.length - 1].engagement > filteredData[0].engagement ? '+' : '')
                  + Math.round(((filteredData[filteredData.length - 1].engagement - filteredData[0].engagement) / filteredData[0].engagement) * 100) + '%'
                : '0%'
              }
            </div>
            <p className="text-xs text-muted-foreground">Compared to start of period</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="followers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="followers">Followers Growth</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="posts">Posting Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="followers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Follower Growth</CardTitle>
              <CardDescription>Track how your follower count changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Rate</CardTitle>
              <CardDescription>Monitor engagement performance across your posts</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Bar dataKey="engagement" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Posting Activity</CardTitle>
              <CardDescription>Track your content posting frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  />
                  <Bar dataKey="posts" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Note about data source */}
      <Alert>
        <AlertDescription>
          This analytics dashboard displays sample data. To show real Metricool analytics,
          you'll need to implement the Metricool API integration and data fetching logic.
        </AlertDescription>
      </Alert>
    </div>
  );
}
