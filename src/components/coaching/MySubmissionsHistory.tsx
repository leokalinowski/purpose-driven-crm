import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calendar, MessageCircle, Phone, CalendarCheck, UserPlus, UserMinus, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCoachingSubmissions, type CoachingSubmission } from '@/hooks/useCoaching';

const CONVERSATION_TARGET = 25;

const SubmissionCard = ({ submission }: { submission: CoachingSubmission }) => {
  const [isOpen, setIsOpen] = useState(false);
  const conversations = submission.conversations || 0;
  const activationAttempts = submission.dials_made || 0;
  const contactsAdded = submission.leads_contacted || 0;
  const contactsRemoved = submission.deals_closed || 0;
  const activationDay = (submission.agreements_signed || 0) >= 1;

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
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {conversations}/{CONVERSATION_TARGET} convos
                  </span>
                  <span>Attempts: {activationAttempts}</span>
                  <span>Appts: {submission.appointments_set || 0}</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricItem label="Conversations" value={conversations} icon={<MessageCircle className="h-3 w-3" />} />
              <MetricItem label="Activation Attempts" value={activationAttempts} icon={<Phone className="h-3 w-3" />} />
              <MetricItem label="Appointments Set" value={submission.appointments_set || 0} icon={<CalendarCheck className="h-3 w-3" />} />
              <MetricItem label="Contacts Added" value={contactsAdded} icon={<UserPlus className="h-3 w-3" />} />
              <MetricItem label="Contacts Removed" value={contactsRemoved} icon={<UserMinus className="h-3 w-3" />} />
              <MetricItem label="Activation Day" value={activationDay ? 'Yes' : 'No'} icon={<Zap className="h-3 w-3" />} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const MetricItem = ({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) => (
  <div className="bg-muted/50 rounded-md p-2">
    <p className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</p>
    <p className="font-semibold">{value}</p>
  </div>
);

export const MySubmissionsHistory = () => {
  const { data: submissions, isLoading } = useCoachingSubmissions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Weekly Check-Ins</CardTitle>
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
          <CardTitle>My Weekly Check-Ins</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            No check-ins yet. Submit your first weekly check-in to see your history here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Weekly Check-Ins</CardTitle>
        <p className="text-sm text-muted-foreground">
          Click on any week to see full details
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
