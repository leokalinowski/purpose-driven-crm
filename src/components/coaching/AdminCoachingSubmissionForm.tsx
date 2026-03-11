import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useAgentsList, useAdminWeekSubmission, useAdminSubmitCoachingForm } from '@/hooks/useAdminCoachingData';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';
import { User, Loader2 } from 'lucide-react';
import type { CoachingFormData } from '@/hooks/useCoaching';

const formSchema = z.object({
  week_number: z.number().min(1).max(52),
  year: z.number().min(2020),
  conversations: z.number().min(0),
  dials_made: z.number().min(0),
  leads_contacted: z.number().min(0),
  contacts_removed: z.number().min(0),
  appointments_set: z.number().min(0),
  appointments_held: z.number().min(0),
  agreements_signed: z.number().min(0),
  offers_made_accepted: z.number().min(0),
  closings: z.number().min(0),
  closing_amount: z.number().min(0),
  challenges: z.string().optional(),
  tasks: z.string().optional(),
  coaching_notes: z.string().optional(),
  must_do_task: z.string().optional(),
});

const AdminCoachingSubmissionForm = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekNumber());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<CoachingFormData | null>(null);

  const { data: agents, isLoading: agentsLoading } = useAgentsList();
  const { data: existingSubmission, isLoading: loadingExisting } = useAdminWeekSubmission(
    selectedAgentId, selectedWeek, selectedYear
  );
  const submitMutation = useAdminSubmitCoachingForm();

  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  const form = useForm<CoachingFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      week_number: currentWeekNumber,
      year: currentYear,
      conversations: 0,
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

  const watchedWeek = form.watch('week_number');
  const watchedYear = form.watch('year');

  useEffect(() => {
    if (watchedWeek !== selectedWeek) setSelectedWeek(watchedWeek);
    if (watchedYear !== selectedYear) setSelectedYear(watchedYear);
  }, [watchedWeek, watchedYear, selectedWeek, selectedYear]);

  useEffect(() => {
    if (existingSubmission) {
      form.reset({
        week_number: existingSubmission.week_number,
        year: existingSubmission.year,
        conversations: existingSubmission.conversations || 0,
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
    } else if (!loadingExisting && selectedAgentId) {
      form.reset({
        week_number: selectedWeek,
        year: selectedYear,
        conversations: 0,
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
  }, [existingSubmission, loadingExisting, selectedWeek, selectedYear, selectedAgentId, form]);

  const handleFormSubmit = (data: CoachingFormData) => {
    if (!selectedAgentId) return;
    if (existingSubmission) {
      setPendingSubmission(data);
      setShowOverwriteWarning(true);
    } else {
      submitMutation.mutate({ agentId: selectedAgentId, formData: data });
    }
  };

  const confirmOverwrite = () => {
    if (pendingSubmission && selectedAgentId) {
      submitMutation.mutate({ agentId: selectedAgentId, formData: pendingSubmission });
    }
    setShowOverwriteWarning(false);
    setPendingSubmission(null);
  };

  const selectedAgent = agents?.find(a => a.id === selectedAgentId);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Submit Check-In for Agent
              </CardTitle>
              <CardDescription>
                Enter weekly SphereSync data on behalf of a team member. Includes transaction fields for admin tracking.
              </CardDescription>
            </div>
            {selectedAgentId && (
              loadingExisting ? (
                <Skeleton className="h-6 w-32" />
              ) : existingSubmission ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                  Editing Week {selectedWeek}
                  <span className="ml-1 text-xs opacity-75">
                    (Updated {format(new Date(existingSubmission.updated_at), 'MMM d, h:mm a')})
                  </span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  New for Week {selectedWeek}
                </Badge>
              )
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              {/* Agent Selection */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                <FormItem>
                  <FormLabel className="text-base font-semibold">Select Agent *</FormLabel>
                  {agentsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {agents?.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name} {agent.email && `(${agent.email})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormItem>
              </div>

              {/* Week/Year */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="week_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Week Number</FormLabel>
                      <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                            <SelectItem key={w} value={w.toString()}>
                              Week {w} {w === currentWeekNumber ? '(Current)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input type="number" min="2020" max="2030" {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || currentYear)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* SphereSync Metrics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">SphereSync™ Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="conversations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conversations (Target: 25)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="dials_made"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activation Attempts</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="appointments_set"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointments Set</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="leads_contacted"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contacts Added</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="agreements_signed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Activation Day (0=No, 1=Yes)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Transaction Metrics (Admin-only) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Transaction Metrics (Admin)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="appointments_held"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Appointments Held</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="offers_made_accepted"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offers Made</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="closings"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel># of Closings</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="closing_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>$ Closed</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Coaching Notes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Coaching Notes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="challenges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Challenges Faced</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What challenges did the agent face?" className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="tasks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tasks for Next Week</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Key tasks for next week" className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="coaching_notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes for Coaching Session</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Notes for the coaching session" className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="must_do_task"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>One Thing You MUST Do</FormLabel>
                        <FormControl>
                          <Textarea placeholder="The one thing that must get done" className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!selectedAgentId || submitMutation.isPending}>
                {submitMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                ) : (
                  <>{existingSubmission ? 'Update' : 'Submit'} for {selectedAgent?.name || 'Agent'}</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={showOverwriteWarning} onOpenChange={setShowOverwriteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Existing Check-In?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAgent?.name} already has a check-in for Week {selectedWeek}, {selectedYear}. 
              This will overwrite the existing data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverwrite}>Yes, Update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminCoachingSubmissionForm;
