import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { 
  MessageCircle, 
  Phone, 
  CalendarCheck, 
  UserPlus, 
  UserMinus, 
  Zap, 
  TrendingUp, 
  Flame, 
  ArrowRight,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { 
  useSubmitWeeklyCheckIn,
  useWeekSubmission,
  useWeeklyStreak,
  useLast4Weeks,
  type WeeklyCheckInData,
} from '@/hooks/useCoaching';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

const CONVERSATION_TARGET = 25;

const WeeklyCheckInForm = ({ 
  onSubmitSuccess 
}: { 
  onSubmitSuccess: () => void;
}) => {
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  const { data: existingSubmission, isLoading: loadingExisting } = useWeekSubmission(currentWeekNumber, currentYear);
  const submitMutation = useSubmitWeeklyCheckIn();

  const [conversations, setConversations] = useState(0);
  const [activationAttempts, setActivationAttempts] = useState(0);
  const [appointmentsSet, setAppointmentsSet] = useState(0);
  const [contactsAdded, setContactsAdded] = useState(0);
  const [contactsRemoved, setContactsRemoved] = useState(0);
  const [activationDayCompleted, setActivationDayCompleted] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);

  // Pre-populate from existing submission
  useEffect(() => {
    if (existingSubmission) {
      setConversations(existingSubmission.conversations || 0);
      setActivationAttempts(existingSubmission.dials_made || 0);
      setAppointmentsSet(existingSubmission.appointments_set || 0);
      setContactsAdded(existingSubmission.leads_contacted || 0);
      setContactsRemoved(existingSubmission.deals_closed || 0);
      setActivationDayCompleted((existingSubmission.agreements_signed || 0) >= 1);
    }
  }, [existingSubmission]);

  const handleSubmit = () => {
    if (existingSubmission) {
      setShowOverwriteWarning(true);
    } else {
      doSubmit();
    }
  };

  const doSubmit = () => {
    const data: WeeklyCheckInData = {
      week_number: currentWeekNumber,
      year: currentYear,
      conversations,
      activation_attempts: activationAttempts,
      appointments_set: appointmentsSet,
      contacts_added: contactsAdded,
      contacts_removed: contactsRemoved,
      activation_day_completed: activationDayCompleted,
    };
    submitMutation.mutate(data, {
      onSuccess: () => onSubmitSuccess(),
    });
  };

  const progressPercent = Math.min((conversations / CONVERSATION_TARGET) * 100, 100);

  if (loadingExisting) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Weekly Check-In</h1>
          <p className="text-muted-foreground">
            Log your relationship work for the week
          </p>
          {existingSubmission && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
              <Pencil className="h-3 w-3 mr-1" />
              Editing Week {currentWeekNumber}
            </Badge>
          )}
        </div>

        {/* Hero: Conversations */}
        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              How many real estate conversations did you have this week?
            </div>
            <div className="flex justify-center">
              <Input
                type="number"
                min={0}
                value={conversations}
                onChange={(e) => setConversations(parseInt(e.target.value) || 0)}
                className="text-center text-4xl font-bold h-20 w-32 border-2"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {conversations} / {CONVERSATION_TARGET} conversations
                </span>
                <span className="font-medium">
                  {conversations >= CONVERSATION_TARGET ? '🎯 Target hit!' : `${CONVERSATION_TARGET - conversations} to go`}
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
            <p className="text-xs text-muted-foreground">
              A conversation is a real two-way exchange by phone, text, DM, voice note, or in person.
            </p>
          </CardContent>
        </Card>

        {/* Relationship Work Fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">What relationship work happened this week?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Activation Attempts */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Outreach attempts
              </Label>
              <Input
                type="number"
                min={0}
                value={activationAttempts}
                onChange={(e) => setActivationAttempts(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Include calls, texts, DMs, and voice messages. Total outreach attempted.
              </p>
            </div>

            {/* Appointments Set */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                Appointments set
              </Label>
              <Input
                type="number"
                min={0}
                value={appointmentsSet}
                onChange={(e) => setAppointmentsSet(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Buyer consults, seller consults, strategy sessions, or other real estate appointments.
              </p>
            </div>

            {/* Contacts Added */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                Contacts added
              </Label>
              <Input
                type="number"
                min={0}
                value={contactsAdded}
                onChange={(e) => setContactsAdded(parseInt(e.target.value) || 0)}
              />
            </div>

            {/* Contacts Removed */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm">
                <UserMinus className="h-4 w-4 text-muted-foreground" />
                Contacts removed / cleaned up
              </Label>
              <Input
                type="number"
                min={0}
                value={contactsRemoved}
                onChange={(e) => setContactsRemoved(parseInt(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Activation Day */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  Did you complete your Activation Day this week?
                </Label>
              </div>
              <Switch
                checked={activationDayCompleted}
                onCheckedChange={setActivationDayCompleted}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="w-full h-12 text-lg"
          size="lg"
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit Weekly Check-In'}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>

      <AlertDialog open={showOverwriteWarning} onOpenChange={setShowOverwriteWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update this week's check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              You already submitted for Week {currentWeekNumber}. This will update your existing numbers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowOverwriteWarning(false); doSubmit(); }}>
              Update Check-In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const WeeklyScoreboard = ({ onEditClick }: { onEditClick: () => void }) => {
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();

  const { data: submission, isLoading } = useWeekSubmission(currentWeekNumber, currentYear);
  const { data: streak } = useWeeklyStreak();
  const { data: last4Weeks } = useLast4Weeks();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!submission) {
    return null; // shouldn't happen if routed correctly
  }

  const conversations = submission.conversations || 0;
  const activationAttempts = submission.dials_made || 0;
  const appointmentsSet = submission.appointments_set || 0;
  const contactsAdded = submission.leads_contacted || 0;
  const contactsRemoved = submission.deals_closed || 0;
  const activationDayCompleted = (submission.agreements_signed || 0) >= 1;

  const progressPercent = Math.min((conversations / CONVERSATION_TARGET) * 100, 100);
  const activationToConversationRate = activationAttempts > 0
    ? Math.round((conversations / activationAttempts) * 100)
    : 0;
  const conversationToConsultationRate = conversations > 0
    ? Math.round((appointmentsSet / conversations) * 100)
    : 0;

  // Get week start date label for last 4 weeks
  const getWeekLabel = (weekNum: number, year: number) => {
    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
    const firstMonday = new Date(year, 0, 1 + daysToMonday);
    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNum - 2) * 7);
    const month = weekStart.toLocaleString('en-US', { month: 'short' });
    const day = weekStart.getDate();
    return `Week of ${month} ${day}`;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Weekly Scoreboard</h1>
        <p className="text-muted-foreground text-sm">Week {currentWeekNumber}, {currentYear}</p>
      </div>

      {/* Section A: Hero Metric */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Conversations This Week
          </p>
          <div className="text-6xl font-bold text-primary">{conversations}</div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{conversations} / {CONVERSATION_TARGET} this week</span>
              {conversations >= CONVERSATION_TARGET && (
                <span className="text-primary font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Target hit!
                </span>
              )}
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Section B: Relationship Work */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Relationship Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <MetricRow label="Activation Attempts" value={activationAttempts} icon={<Phone className="h-4 w-4" />} />
            <MetricRow label="Conversations" value={conversations} icon={<MessageCircle className="h-4 w-4" />} />
            <MetricRow label="Appointments Set" value={appointmentsSet} icon={<CalendarCheck className="h-4 w-4" />} />
            <MetricRow label="Contacts Added" value={contactsAdded} icon={<UserPlus className="h-4 w-4" />} />
            <MetricRow label="Contacts Removed" value={contactsRemoved} icon={<UserMinus className="h-4 w-4" />} />
          </div>
        </CardContent>
      </Card>

      {/* Section C: Discipline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Discipline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Activation Day Completed
              </span>
              <Badge variant={activationDayCompleted ? "default" : "secondary"}>
                {activationDayCompleted ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Flame className="h-4 w-4" />
                Current Streak
              </span>
              <span className="font-bold text-lg">
                {streak || 0} week{(streak || 0) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section D: Relationship Momentum */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Relationship Momentum
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Activation → Conversation</p>
              <p className="text-2xl font-bold">{activationToConversationRate}%</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Conversation → Consultation</p>
              <p className="text-2xl font-bold">{conversationToConsultationRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section E: Last 4 Weeks */}
      {last4Weeks && last4Weeks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last 4 Weeks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {last4Weeks.map((week, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">
                    {getWeekLabel(week.week_number, week.year)}
                  </span>
                  <span className="font-semibold">
                    {week.conversations || 0} conversations
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Button */}
      <Button variant="outline" onClick={onEditClick} className="w-full">
        <Pencil className="h-4 w-4 mr-2" />
        Edit This Week's Check-In
      </Button>
    </div>
  );
};

const MetricRow = ({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) => (
  <div className="flex items-center justify-between py-1.5 border-b last:border-0">
    <span className="text-sm text-muted-foreground flex items-center gap-2">
      {icon}
      {label}
    </span>
    <span className="font-semibold">{value}</span>
  </div>
);

const WeeklySuccessScoreboard = () => {
  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  const { data: existingSubmission } = useWeekSubmission(currentWeekNumber, currentYear);

  // Show scoreboard if current week has a submission, check-in form otherwise
  const [view, setView] = useState<'checkin' | 'scoreboard'>('checkin');

  useEffect(() => {
    if (existingSubmission) {
      setView('scoreboard');
    }
  }, [existingSubmission]);

  return (
    <Layout>
      <div className="py-4 sm:py-6">
        {view === 'checkin' ? (
          <WeeklyCheckInForm onSubmitSuccess={() => setView('scoreboard')} />
        ) : (
          <WeeklyScoreboard onEditClick={() => setView('checkin')} />
        )}
      </div>
    </Layout>
  );
};

export default WeeklySuccessScoreboard;
