import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useAuth } from '@/hooks/useAuth';
import { 
  useSubmitCoachingForm, 
  usePersonalMetrics, 
  useTeamAverages, 
  useAgentCurrentWeekMetrics,
  type CoachingFormData 
} from '@/hooks/useCoaching';
import { getCurrentWeekNumber } from '@/utils/po2Logic';

const formSchema = z.object({
  week_number: z.number().min(1, "Week must be between 1 and 52").max(52, "Week must be between 1 and 52"),
  year: z.number().min(2020, "Year must be valid"),
  week: z.string().optional(),
  database_size: z.number().min(0, "Must be 0 or greater"),
  dials_made: z.number().min(0, "Must be 0 or greater"),
  conversations: z.number().min(0, "Must be 0 or greater"),
  leads_contacted: z.number().min(0, "Must be 0 or greater"),
  appointments_set: z.number().min(0, "Must be 0 or greater"),
  agreements_signed: z.number().min(0, "Must be 0 or greater"),
  offers_made_accepted: z.number().min(0, "Must be 0 or greater"),
  deals_closed: z.number().min(0, "Must be 0 or greater"),
  closings: z.number().min(0, "Must be 0 or greater"),
  challenges: z.string().optional(),
  tasks: z.string().optional(),
  coaching_notes: z.string().optional(),
  must_do_task: z.string().optional(),
});

const WeeklySuccessScoreboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("submit");
  
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  
  const submitMutation = useSubmitCoachingForm();
  const { data: personalMetrics, isLoading: personalLoading } = usePersonalMetrics();
  const { data: teamAverages, isLoading: teamLoading } = useTeamAverages();
  const { data: agentCurrentMetrics } = useAgentCurrentWeekMetrics();

  const form = useForm<CoachingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      week_number: currentWeekNumber,
      year: currentYear,
      week: "",
      database_size: 0,
      dials_made: 0,
      conversations: 0,
      leads_contacted: 0,
      appointments_set: 0,
      agreements_signed: 0,
      offers_made_accepted: 0,
      deals_closed: 0,
      closings: 0,
      challenges: "",
      tasks: "",
      coaching_notes: "",
      must_do_task: "",
    },
  });

  const onSubmit = (data: CoachingFormData) => {
    submitMutation.mutate(data);
  };

  const isAdmin = user?.email && ['admin@realestateonpurpose.com'].includes(user.email);

  // Prepare enhanced chart data for personal metrics
  const personalChartData = personalMetrics?.map(metric => ({
    week: `Week ${metric.week_number}`,
    'Database Size': metric.database_size || 0,
    'Dials Made': metric.dials_made || 0,
    'Conversations': metric.conversations || 0,
    'Leads Contacted': metric.leads_contacted || 0,
    'Appointments Set': metric.appointments_set || 0,
    'Agreements Signed': metric.agreements_signed || 0,
    'Offers Made/Accepted': metric.offers_made_accepted || 0,
    'Deals Closed': metric.deals_closed || 0,
    'Closings': metric.closings || 0,
  })) || [];

  // Prepare chart data for team comparison (admin only)
  const comparisonChartData = isAdmin && teamAverages && agentCurrentMetrics ? [
    {
      metric: 'Database Size',
      'Your Performance': agentCurrentMetrics.database_size || 0,
      'Team Average': teamAverages.avg_database_size || 0,
    },
    {
      metric: 'Dials Made',
      'Your Performance': agentCurrentMetrics.dials_made || 0,
      'Team Average': teamAverages.avg_dials_made || 0,
    },
    {
      metric: 'Conversations',
      'Your Performance': agentCurrentMetrics.conversations || 0,
      'Team Average': teamAverages.avg_conversations || 0,
    },
    {
      metric: 'Leads Contacted',
      'Your Performance': agentCurrentMetrics.leads_contacted || 0,
      'Team Average': teamAverages.avg_leads_contacted || 0,
    },
    {
      metric: 'Appointments Set',
      'Your Performance': agentCurrentMetrics.appointments_set || 0,
      'Team Average': teamAverages.avg_appointments_set || 0,
    },
    {
      metric: 'Agreements Signed',
      'Your Performance': agentCurrentMetrics.agreements_signed || 0,
      'Team Average': teamAverages.avg_agreements_signed || 0,
    },
    {
      metric: 'Offers Made/Accepted',
      'Your Performance': agentCurrentMetrics.offers_made_accepted || 0,
      'Team Average': teamAverages.avg_offers_made_accepted || 0,
    },
    {
      metric: 'Deals Closed',
      'Your Performance': agentCurrentMetrics.deals_closed || 0,
      'Team Average': teamAverages.avg_deals_closed || 0,
    },
    {
      metric: 'Closings',
      'Your Performance': agentCurrentMetrics.closings || 0,
      'Team Average': teamAverages.avg_closings || 0,
    },
  ] : [];

  const chartConfig = {
    "Database Size": {
      label: "Database Size",
      color: "hsl(var(--chart-1))",
    },
    "Dials Made": {
      label: "Dials Made",
      color: "hsl(var(--chart-2))",
    },
    "Conversations": {
      label: "Conversations",
      color: "hsl(var(--chart-3))",
    },
    "Leads Contacted": {
      label: "Leads Contacted",
      color: "hsl(var(--chart-4))",
    },
    "Appointments Set": {
      label: "Appointments Set", 
      color: "hsl(var(--chart-5))",
    },
    "Agreements Signed": {
      label: "Agreements Signed",
      color: "hsl(var(--chart-1))",
    },
    "Offers Made/Accepted": {
      label: "Offers Made/Accepted",
      color: "hsl(var(--chart-2))",
    },
    "Deals Closed": {
      label: "Deals Closed",
      color: "hsl(var(--chart-3))",
    },
    "Closings": {
      label: "Closings",
      color: "hsl(var(--chart-4))",
    },
    "Your Performance": {
      label: "Your Performance",
      color: "hsl(var(--chart-1))",
    },
    "Team Average": {
      label: "Team Average",
      color: "hsl(var(--chart-2))",
    },
  };

  // Calculate YTD totals for dashboard cards
  const currentYearMetrics = personalMetrics?.filter(m => m.year === currentYear) || [];
  const ytdTotals = currentYearMetrics.reduce(
    (acc, metric) => ({
      database_size: Math.max(acc.database_size, metric.database_size || 0),
      dials_made: acc.dials_made + (metric.dials_made || 0),
      conversations: acc.conversations + (metric.conversations || 0),
      leads_contacted: acc.leads_contacted + (metric.leads_contacted || 0),
      appointments_set: acc.appointments_set + (metric.appointments_set || 0),
      agreements_signed: acc.agreements_signed + (metric.agreements_signed || 0),
      offers_made_accepted: acc.offers_made_accepted + (metric.offers_made_accepted || 0),
      deals_closed: acc.deals_closed + (metric.deals_closed || 0),
      closings: acc.closings + (metric.closings || 0),
    }),
    {
      database_size: 0,
      dials_made: 0,
      conversations: 0,
      leads_contacted: 0,
      appointments_set: 0,
      agreements_signed: 0,
      offers_made_accepted: 0,
      deals_closed: 0,
      closings: 0,
    }
  );

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Weekly Success Scoreboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your performance and prepare for Thursday coaching sessions
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit">Submit Weekly Scorecard</TabsTrigger>
            <TabsTrigger value="dashboard">Performance Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Success Scorecard</CardTitle>
                <CardDescription>
                  Submit your weekly metrics and prepare for Thursday coaching session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="week_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Week Number</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select week" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                                  <SelectItem key={week} value={week.toString()}>
                                    Week {week}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="2020" 
                                max="2030" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || currentYear)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="week"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Week Ending (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Activity Metrics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="database_size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Database Size</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="dials_made"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dials Made</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="conversations"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Real Estate Conversations</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Pipeline Metrics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="leads_contacted"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Leads Contacted</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="appointments_set"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appointments Set</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="agreements_signed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Agreements Signed</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Transaction Metrics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="offers_made_accepted"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Offers Made/Accepted</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="deals_closed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deals Closed</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="closings"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Closings</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Coaching Notes & Goals</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="challenges"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Challenges Faced</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Describe any challenges you faced this week..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="tasks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tasks for Next Week</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="List your tasks for next week..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="coaching_notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes for Coaching</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="What do you want to discuss in coaching?"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="must_do_task"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>One Thing You MUST Do</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="What is the ONE critical thing you must accomplish?"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={submitMutation.isPending}
                      className="w-full"
                    >
                      {submitMutation.isPending ? "Submitting..." : "Submit Weekly Scorecard"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {/* YTD Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Database Size</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.database_size}</div>
                  <p className="text-xs text-muted-foreground">Current</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Dials YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.dials_made}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conversations YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.conversations}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Appointments YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.appointments_set}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Closings YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.closings}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6">
              {/* Personal Progress Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Progress Over Time</CardTitle>
                  <CardDescription>
                    Track your weekly performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {personalLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  ) : personalChartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={personalChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="Dials Made" 
                            stroke="hsl(var(--chart-1))" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Conversations" 
                            stroke="hsl(var(--chart-2))" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Appointments Set" 
                            stroke="hsl(var(--chart-3))" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Deals Closed" 
                            stroke="hsl(var(--chart-4))" 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground">No data available. Submit your first weekly scorecard to see your progress.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team Comparison Chart (Admin Only) */}
              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle>Team Performance Comparison</CardTitle>
                    <CardDescription>
                      Compare your current week performance with team averages (anonymized)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {teamLoading ? (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">Loading...</p>
                      </div>
                    ) : comparisonChartData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="metric" />
                            <YAxis />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar 
                              dataKey="Your Performance" 
                              fill="var(--color-your-performance)" 
                            />
                            <Bar 
                              dataKey="Team Average" 
                              fill="var(--color-team-average)" 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">No team data available for comparison.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default WeeklySuccessScoreboard;