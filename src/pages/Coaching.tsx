import React, { useState } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarIcon } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useAuth } from '@/hooks/useAuth';
import { 
  useSubmitCoachingForm, 
  usePersonalMetrics, 
  useTeamAverages, 
  useAgentCurrentWeekMetrics,
  getLastSunday,
  type CoachingFormData 
} from '@/hooks/useCoaching';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  week_ending: z.date({
    required_error: "Please select a week ending date.",
  }),
  leads_contacted: z.number().min(0, "Must be 0 or greater"),
  appointments_set: z.number().min(0, "Must be 0 or greater"),
  deals_closed: z.number().min(0, "Must be 0 or greater"),
  challenges: z.string().optional(),
  tasks: z.string().optional(),
});

const Coaching = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("submit");
  
  const submitMutation = useSubmitCoachingForm();
  const { data: personalMetrics, isLoading: personalLoading } = usePersonalMetrics();
  const { data: teamAverages, isLoading: teamLoading } = useTeamAverages();
  const { data: agentCurrentMetrics } = useAgentCurrentWeekMetrics();

  const form = useForm<CoachingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      week_ending: getLastSunday(),
      leads_contacted: 0,
      appointments_set: 0,
      deals_closed: 0,
      challenges: "",
      tasks: "",
    },
  });

  const onSubmit = (data: CoachingFormData) => {
    submitMutation.mutate(data);
  };

  const isAdmin = user?.email && ['admin@realestateonpurpose.com'].includes(user.email);

  // Prepare chart data for personal metrics
  const personalChartData = personalMetrics?.map(metric => ({
    week: format(new Date(metric.week_ending), 'MMM dd'),
    'Leads Contacted': metric.leads_contacted,
    'Appointments Set': metric.appointments_set,
    'Deals Closed': metric.deals_closed,
  })) || [];

  // Prepare chart data for team comparison (admin only)
  const comparisonChartData = isAdmin && teamAverages && agentCurrentMetrics ? [
    {
      metric: 'Leads Contacted',
      'Your Performance': agentCurrentMetrics.leads_contacted,
      'Team Average': teamAverages.avg_leads_contacted,
    },
    {
      metric: 'Appointments Set', 
      'Your Performance': agentCurrentMetrics.appointments_set,
      'Team Average': teamAverages.avg_appointments_set,
    },
    {
      metric: 'Deals Closed',
      'Your Performance': agentCurrentMetrics.deals_closed,
      'Team Average': teamAverages.avg_deals_closed,
    },
  ] : [];

  const chartConfig = {
    "Leads Contacted": {
      label: "Leads Contacted",
      color: "hsl(var(--chart-1))",
    },
    "Appointments Set": {
      label: "Appointments Set", 
      color: "hsl(var(--chart-2))",
    },
    "Deals Closed": {
      label: "Deals Closed",
      color: "hsl(var(--chart-3))",
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

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Coaching</h1>
          <p className="text-muted-foreground mt-2">
            Submit your weekly performance and track your progress
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit">Submit Weekly Form</TabsTrigger>
            <TabsTrigger value="dashboard">Performance Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Performance Submission</CardTitle>
                <CardDescription>
                  Submit your weekly performance metrics and reflections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="week_ending"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Week Ending</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-[240px] pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                    </div>

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
                          <FormLabel>Actionable Tasks</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="List actionable tasks for next week..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={submitMutation.isPending}
                      className="w-full"
                    >
                      {submitMutation.isPending ? "Submitting..." : "Submit Performance"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
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
                            dataKey="Leads Contacted" 
                            stroke="var(--color-leads-contacted)" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Appointments Set" 
                            stroke="var(--color-appointments-set)" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Deals Closed" 
                            stroke="var(--color-deals-closed)" 
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground">No data available. Submit your first weekly form to see your progress.</p>
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
                      Compare your current week performance with team averages
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

export default Coaching;