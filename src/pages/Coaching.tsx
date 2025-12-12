import React, { useState, useEffect } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/useAuth';
import { 
  useSubmitCoachingForm, 
  usePersonalMetrics, 
  useTeamAverages, 
  useAgentCurrentWeekMetrics,
  useWeekSubmission,
  type CoachingFormData 
} from '@/hooks/useCoaching';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';
import { MySubmissionsHistory } from '@/components/coaching/MySubmissionsHistory';
import { format } from 'date-fns';

const formSchema = z.object({
  week_number: z.number().min(1, "Week must be between 1 and 52").max(52, "Week must be between 1 and 52"),
  year: z.number().min(2020, "Year must be valid"),
  dials_made: z.number().min(0, "Must be 0 or greater"),
  leads_contacted: z.number().min(0, "Must be 0 or greater"),
  appointments_set: z.number().min(0, "Must be 0 or greater"),
  appointments_held: z.number().min(0, "Must be 0 or greater"),
  agreements_signed: z.number().min(0, "Must be 0 or greater"),
  offers_made_accepted: z.number().min(0, "Must be 0 or greater"),
  closings: z.number().min(0, "Must be 0 or greater"),
  closing_amount: z.number().min(0, "Must be 0 or greater"),
  challenges: z.string().optional(),
  tasks: z.string().optional(),
  coaching_notes: z.string().optional(),
  must_do_task: z.string().optional(),
});

const WeeklySuccessScoreboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("submit");
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<CoachingFormData | null>(null);
  
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  
  // Track selected week/year for fetching existing submission
  const [selectedWeek, setSelectedWeek] = useState(currentWeekNumber);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  const submitMutation = useSubmitCoachingForm();
  const { data: personalMetrics, isLoading: personalLoading } = usePersonalMetrics();
  const { data: teamAverages, isLoading: teamLoading } = useTeamAverages();
  const { data: agentCurrentMetrics } = useAgentCurrentWeekMetrics();
  const { data: existingSubmission, isLoading: loadingExisting } = useWeekSubmission(selectedWeek, selectedYear);

  const form = useForm<CoachingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      week_number: currentWeekNumber,
      year: currentYear,
      dials_made: 0,
      leads_contacted: 0,
      appointments_set: 0,
      appointments_held: 0,
      agreements_signed: 0,
      offers_made_accepted: 0,
      closings: 0,
      closing_amount: 0,
      challenges: "",
      tasks: "",
      coaching_notes: "",
      must_do_task: "",
    },
  });

  // Watch for week/year changes in form
  const watchedWeek = form.watch('week_number');
  const watchedYear = form.watch('year');

  // Update selected week/year when form values change
  useEffect(() => {
    if (watchedWeek !== selectedWeek) {
      setSelectedWeek(watchedWeek);
    }
    if (watchedYear !== selectedYear) {
      setSelectedYear(watchedYear);
    }
  }, [watchedWeek, watchedYear, selectedWeek, selectedYear]);

  // Pre-populate form when existing submission is loaded
  useEffect(() => {
    if (existingSubmission) {
      form.reset({
        week_number: existingSubmission.week_number,
        year: existingSubmission.year,
        dials_made: existingSubmission.dials_made || 0,
        leads_contacted: existingSubmission.leads_contacted || 0,
        appointments_set: existingSubmission.appointments_set || 0,
        appointments_held: existingSubmission.appointments_held || 0,
        agreements_signed: existingSubmission.agreements_signed || 0,
        offers_made_accepted: existingSubmission.offers_made_accepted || 0,
        closings: existingSubmission.closings || 0,
        closing_amount: existingSubmission.closing_amount || 0,
        challenges: existingSubmission.challenges || "",
        tasks: existingSubmission.tasks || "",
        coaching_notes: existingSubmission.coaching_notes || "",
        must_do_task: existingSubmission.must_do_task || "",
      });
    } else if (!loadingExisting) {
      // Reset to empty values for new week (but keep week/year)
      form.reset({
        week_number: selectedWeek,
        year: selectedYear,
        dials_made: 0,
        leads_contacted: 0,
        appointments_set: 0,
        appointments_held: 0,
        agreements_signed: 0,
        offers_made_accepted: 0,
        closings: 0,
        closing_amount: 0,
        challenges: "",
        tasks: "",
        coaching_notes: "",
        must_do_task: "",
      });
    }
  }, [existingSubmission, loadingExisting, selectedWeek, selectedYear, form]);

  const handleFormSubmit = (data: CoachingFormData) => {
    // Show warning if updating existing submission
    if (existingSubmission) {
      setPendingSubmission(data);
      setShowOverwriteWarning(true);
    } else {
      submitMutation.mutate(data);
    }
  };

  const confirmOverwrite = () => {
    if (pendingSubmission) {
      submitMutation.mutate(pendingSubmission);
    }
    setShowOverwriteWarning(false);
    setPendingSubmission(null);
  };

  // Prepare enhanced chart data for personal metrics
  const personalChartData = personalMetrics?.map(metric => ({
    week: `Week ${metric.week_number}`,
    'Attempts Made': metric.dials_made || 0,
    'Leads Contacted': metric.leads_contacted || 0,
    'Appointments Set': metric.appointments_set || 0,
    'Appointments Held': metric.appointments_held || 0,
    'Agreements Signed': metric.agreements_signed || 0,
    'Offers Made': metric.offers_made_accepted || 0,
    '# of Closings': metric.closings || 0,
    '$ Closed': metric.closing_amount || 0,
  })) || [];

  // Prepare chart data for team comparison
  const comparisonChartData = teamAverages && agentCurrentMetrics ? [
    {
      metric: 'Attempts Made',
      'Your Performance': agentCurrentMetrics.dials_made || 0,
      'Team Average': teamAverages.avg_dials_made || 0,
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
      metric: 'Appointments Held',
      'Your Performance': agentCurrentMetrics.appointments_held || 0,
      'Team Average': teamAverages.avg_appointments_held || 0,
    },
    {
      metric: 'Agreements Signed',
      'Your Performance': agentCurrentMetrics.agreements_signed || 0,
      'Team Average': teamAverages.avg_agreements_signed || 0,
    },
    {
      metric: 'Offers Made',
      'Your Performance': agentCurrentMetrics.offers_made_accepted || 0,
      'Team Average': teamAverages.avg_offers_made_accepted || 0,
    },
    {
      metric: '# of Closings',
      'Your Performance': agentCurrentMetrics.closings || 0,
      'Team Average': teamAverages.avg_closings || 0,
    },
    {
      metric: '$ Closed',
      'Your Performance': agentCurrentMetrics.closing_amount || 0,
      'Team Average': teamAverages.avg_closing_amount || 0,
    },
  ] : [];

  const chartConfig = {
    "Attempts Made": {
      label: "Attempts Made",
      color: "hsl(var(--chart-1))",
    },
    "Leads Contacted": {
      label: "Leads Contacted",
      color: "hsl(var(--chart-2))",
    },
    "Appointments Set": {
      label: "Appointments Set", 
      color: "hsl(var(--chart-3))",
    },
    "Appointments Held": {
      label: "Appointments Held",
      color: "hsl(var(--chart-4))",
    },
    "Agreements Signed": {
      label: "Agreements Signed",
      color: "hsl(var(--chart-5))",
    },
    "Offers Made": {
      label: "Offers Made",
      color: "hsl(var(--chart-1))",
    },
    "# of Closings": {
      label: "# of Closings",
      color: "hsl(var(--chart-2))",
    },
    "$ Closed": {
      label: "$ Closed",
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

  // Calculate YTD totals for dashboard cards
  const currentYearMetrics = personalMetrics?.filter(m => m.year === currentYear) || [];
  const ytdTotals = currentYearMetrics.reduce(
    (acc, metric) => ({
      database_size: Math.max(acc.database_size, metric.database_size || 0),
      attempts_made: acc.attempts_made + (metric.dials_made || 0),
      leads_contacted: acc.leads_contacted + (metric.leads_contacted || 0),
      appointments_set: acc.appointments_set + (metric.appointments_set || 0),
      appointments_held: acc.appointments_held + (metric.appointments_held || 0),
      agreements_signed: acc.agreements_signed + (metric.agreements_signed || 0),
      offers_made: acc.offers_made + (metric.offers_made_accepted || 0),
      closings: acc.closings + (metric.closings || 0),
      closing_amount: acc.closing_amount + (metric.closing_amount || 0),
    }),
    {
      database_size: 0,
      attempts_made: 0,
      leads_contacted: 0,
      appointments_set: 0,
      appointments_held: 0,
      agreements_signed: 0,
      offers_made: 0,
      closings: 0,
      closing_amount: 0,
    }
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Weekly Success Scoreboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Track your performance and prepare for Thursday coaching sessions
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit">Success Scoreboard</TabsTrigger>
            <TabsTrigger value="dashboard">Performance Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Weekly Success Scorecard</CardTitle>
                    <CardDescription>
                      Submit your weekly metrics and prepare for Thursday coaching session
                    </CardDescription>
                  </div>
                  {loadingExisting ? (
                    <Skeleton className="h-6 w-32" />
                  ) : existingSubmission ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                      Editing Week {selectedWeek} submission
                      <span className="ml-1 text-xs opacity-75">
                        (Updated {format(new Date(existingSubmission.updated_at), 'MMM d, h:mm a')})
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      New submission for Week {selectedWeek}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Activity Metrics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="dials_made"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Attempts Made</FormLabel>
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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Pipeline Metrics</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          name="appointments_held"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Appointments Held</FormLabel>
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
                              <FormLabel>Offers Made</FormLabel>
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
                              <FormLabel># of Closings</FormLabel>
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
                          name="closing_amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>$ Closed (Amount)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  {...field} 
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
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
                  <CardTitle className="text-sm">Attempts YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.attempts_made}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Leads Contacted YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.leads_contacted}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Appointments Held YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.appointments_held}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Agreements YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.agreements_signed}</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Offers Made YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ytdTotals.offers_made}</div>
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
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">$ Closed YTD</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${ytdTotals.closing_amount.toLocaleString()}</div>
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
                    <div className="space-y-4">
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : personalChartData.length > 0 ? (
                     <ChartContainer config={chartConfig} className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={personalChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="Attempts Made" 
                            stroke="hsl(var(--chart-1))" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Leads Contacted" 
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
                            dataKey="Appointments Held" 
                            stroke="hsl(var(--chart-4))" 
                            strokeWidth={2}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Agreements Signed" 
                            stroke="hsl(var(--chart-5))" 
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

              {/* My Weekly Submissions History */}
              <MySubmissionsHistory />

              {/* Team Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance Comparison</CardTitle>
                  <CardDescription>
                    Compare your current week performance with team averages (anonymized)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {teamLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-64 w-full" />
                    </div>
                  ) : comparisonChartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-80">
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
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Overwrite Warning Dialog */}
      <AlertDialog open={showOverwriteWarning} onOpenChange={setShowOverwriteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Existing Submission?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a submission for Week {selectedWeek}, {selectedYear}. 
              Submitting now will replace your existing data including any notes you previously saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSubmission(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverwrite}>Update Submission</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default WeeklySuccessScoreboard;