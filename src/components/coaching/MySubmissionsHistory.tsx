import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, Target, MessageSquare, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCoachingSubmissions, type CoachingSubmission } from '@/hooks/useCoaching';

const SubmissionCard = ({ submission }: { submission: CoachingSubmission }) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasNotes = submission.challenges || submission.tasks || submission.coaching_notes || submission.must_do_task;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-3">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Week {submission.week_number}, {submission.year}
                </CardTitle>
                {hasNotes && (
                  <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Notes
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Attempts: {submission.dials_made || 0}</span>
                  <span>Leads: {submission.leads_contacted || 0}</span>
                  <span>Closings: {submission.closings || 0}</span>
                </div>
                <Button variant="ghost" size="sm">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricItem label="Attempts Made" value={submission.dials_made || 0} />
              <MetricItem label="Leads Contacted" value={submission.leads_contacted || 0} />
              <MetricItem label="Appointments Set" value={submission.appointments_set || 0} />
              <MetricItem label="Appointments Held" value={submission.appointments_held || 0} />
              <MetricItem label="Agreements Signed" value={submission.agreements_signed || 0} />
              <MetricItem label="Offers Made" value={submission.offers_made_accepted || 0} />
              <MetricItem label="# of Closings" value={submission.closings || 0} />
              <MetricItem label="$ Closed" value={`$${(submission.closing_amount || 0).toLocaleString()}`} />
            </div>

            {/* Coaching Notes Section */}
            {hasNotes && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Coaching Notes & Goals
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {submission.challenges && (
                    <NoteCard 
                      title="Challenges Faced" 
                      content={submission.challenges} 
                      icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
                    />
                  )}
                  {submission.tasks && (
                    <NoteCard 
                      title="Tasks for Next Week" 
                      content={submission.tasks}
                      icon={<Target className="h-4 w-4 text-blue-500" />}
                    />
                  )}
                  {submission.coaching_notes && (
                    <NoteCard 
                      title="Notes for Coaching" 
                      content={submission.coaching_notes}
                      icon={<MessageSquare className="h-4 w-4 text-green-500" />}
                    />
                  )}
                  {submission.must_do_task && (
                    <NoteCard 
                      title="One Thing You MUST Do" 
                      content={submission.must_do_task}
                      icon={<Target className="h-4 w-4 text-red-500" />}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const MetricItem = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-muted/50 rounded-md p-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

const NoteCard = ({ title, content, icon }: { title: string; content: string; icon: React.ReactNode }) => (
  <div className="bg-muted/30 border rounded-md p-3">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <p className="text-sm font-medium">{title}</p>
    </div>
    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
  </div>
);

export const MySubmissionsHistory = () => {
  const { data: submissions, isLoading } = useCoachingSubmissions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Weekly Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Weekly Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            No submissions yet. Submit your first weekly scorecard to see your history here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Weekly Submissions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Click on any week to see full details including your notes and goals
        </p>
      </CardHeader>
      <CardContent>
        {submissions.map((submission) => (
          <SubmissionCard key={submission.id} submission={submission} />
        ))}
      </CardContent>
    </Card>
  );
};
