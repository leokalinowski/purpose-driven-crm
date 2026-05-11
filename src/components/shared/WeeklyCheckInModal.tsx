import { useEffect, useState } from 'react';
import {
  X,
  CheckSquare,
  TrendingUp,
  AlertTriangle,
  Phone,
  Users,
  Briefcase,
  Calendar,
  Gift,
  UserPlus,
  GraduationCap,
  Send,
  Zap,
  BarChart2,
  Sparkles,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSubmitCoachingForm, useWeeklyStreak, useWeekSubmission } from '@/hooks/useCoaching';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

type Metric = {
  key: 'calls' | 'appts' | 'pres' | 'contracts' | 'closings' | 'referrals' | 'newContacts' | 'events';
  label: string;
  goal: number;
};

const metrics: Metric[] = [
  { key: 'calls', label: 'Calls made', goal: 20 },
  { key: 'appts', label: 'Appointments set', goal: 3 },
  { key: 'pres', label: 'Presentations', goal: 1 },
  { key: 'contracts', label: 'Contracts signed', goal: 1 },
  { key: 'closings', label: 'Closings', goal: 1 },
  { key: 'referrals', label: 'Referrals received', goal: 1 },
  { key: 'newContacts', label: 'New contacts added', goal: 3 },
  { key: 'events', label: 'Events attended', goal: 0 },
];

type RatingGroup = 'energy' | 'focus' | 'confidence';
const ratingGroups: { key: RatingGroup; label: string; sub: string; initial: number }[] = [
  {
    key: 'energy',
    label: 'Overall energy',
    sub: 'How did your physical and mental energy feel this week?',
    initial: 3,
  },
  {
    key: 'focus',
    label: 'Focus & productivity',
    sub: 'How well did you stay on task and prioritize the right activities?',
    initial: 4,
  },
  {
    key: 'confidence',
    label: 'Confidence & motivation',
    sub: 'How confident did you feel about your pipeline and direction this week?',
    initial: 4,
  },
];

const ratingTone = (n: number, selected: boolean): string => {
  if (!selected) return 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary hover:bg-reop-teal-soft';
  if (n <= 2) return 'border-[hsl(0_72%_50%)] bg-[hsl(0_72%_50%)] text-white';
  if (n === 3) return 'border-[hsl(35_80%_50%)] bg-[hsl(35_80%_50%)] text-white';
  if (n === 4) return 'border-primary bg-primary text-white';
  return 'border-reop-green bg-reop-green text-white';
};

const focusOptions: { key: string; icon: LucideIcon; label: string; default?: boolean }[] = [
  { key: 'calling', icon: Phone, label: 'Calling cadence', default: true },
  { key: 'sphere', icon: Users, label: 'Sphere outreach' },
  { key: 'pipeline', icon: Briefcase, label: 'Pipeline opportunities', default: true },
  { key: 'event', icon: Calendar, label: 'Event prep' },
  { key: 'delight', icon: Gift, label: 'Delight & gifts' },
  { key: 'listing', icon: TrendingUp, label: 'Listing leads' },
  { key: 'newcontacts', icon: UserPlus, label: 'New contacts' },
  { key: 'training', icon: GraduationCap, label: 'Skills / training' },
];

function weekRangeLabel(weekNumber: number, year: number): string {
  const startOfYear = new Date(year, 0, 1);
  const start = new Date(startOfYear.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)}–${fmt(end)}`;
}

type Props = {
  open: boolean;
  agentName?: string;
  onClose: () => void;
};

export function WeeklyCheckInModal({ open, agentName = 'there', onClose }: Props) {
  const currentWeek = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  const prevWeek = currentWeek > 1 ? currentWeek - 1 : 52;
  const prevYear = currentWeek > 1 ? currentYear : currentYear - 1;

  const submitForm = useSubmitCoachingForm();
  const { data: streak = 0 } = useWeeklyStreak();
  const { data: thisWeek } = useWeekSubmission(currentWeek, currentYear);
  const { data: lastWeek } = useWeekSubmission(prevWeek, prevYear);

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(metrics.map((m) => [m.key, 0])),
  );
  const [wins, setWins] = useState('');
  const [challenges, setChallenges] = useState('');
  const [ratings, setRatings] = useState<Record<RatingGroup, number>>({
    energy: 3,
    focus: 3,
    confidence: 3,
  });
  const [focuses, setFocuses] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(focusOptions.map((f) => [f.key, !!f.default])),
  );
  const [otherNotes, setOtherNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Hydrate from existing submission so editing this week's check-in works
  useEffect(() => {
    if (!open) return;
    if (!thisWeek) return;
    setValues({
      calls: thisWeek.dials_made || 0,
      appts: thisWeek.appointments_set || 0,
      pres: thisWeek.appointments_held || 0,
      contracts: thisWeek.agreements_signed || 0,
      closings: thisWeek.closings || 0,
      referrals: thisWeek.offers_made_accepted || 0,
      newContacts: thisWeek.conversations || 0,
      events: 0,
    });
    if (thisWeek.tasks) setWins(thisWeek.tasks);
    if (thisWeek.challenges) setChallenges(thisWeek.challenges);
  }, [open, thisWeek]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const step = (key: string, delta: number) =>
    setValues((v) => ({ ...v, [key]: Math.max(0, (v[key] || 0) + delta) }));

  const ctx = (m: Metric, val: number) => {
    if (m.goal === 0) return { text: '—', cls: 'text-muted-foreground' };
    if (val >= m.goal) return { text: 'On goal', cls: 'text-[hsl(142_55%_28%)] font-semibold' };
    return {
      text: `${m.goal - val} below goal`,
      cls: 'text-[hsl(35_80%_38%)] font-semibold',
    };
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const focusList = Object.entries(focuses)
        .filter(([, on]) => on)
        .map(([k]) => focusOptions.find((f) => f.key === k)?.label || k)
        .join(', ');
      const coachingNotes = [
        `Energy ${ratings.energy}/5 · Focus ${ratings.focus}/5 · Confidence ${ratings.confidence}/5`,
        focusList ? `Focus next week: ${focusList}` : null,
        otherNotes.trim() ? `Notes: ${otherNotes.trim()}` : null,
        values.events > 0 ? `Events attended: ${values.events}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await submitForm.mutateAsync({
        week_number: currentWeek,
        year: currentYear,
        dials_made: values.calls || 0,
        conversations: values.newContacts || 0,
        leads_contacted: values.referrals || 0,
        appointments_set: values.appts || 0,
        appointments_held: values.pres || 0,
        agreements_signed: values.contracts || 0,
        offers_made_accepted: values.referrals || 0,
        closings: values.closings || 0,
        closing_amount: 0,
        challenges: challenges.trim() || undefined,
        tasks: wins.trim() || undefined,
        coaching_notes: coachingNotes || undefined,
      });
      onClose();
      toast.success("Check-in submitted — your Coach is generating this week's narrative.", {
        icon: <CheckCircle2 className="w-4 h-4 text-reop-green" />,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const lastWeekRows = lastWeek
    ? [
        { k: 'Calls', goal: 20, val: lastWeek.dials_made || 0 },
        { k: 'Appointments', goal: 3, val: lastWeek.appointments_set || 0 },
        { k: 'Contracts', goal: 1, val: lastWeek.agreements_signed || 0 },
        { k: 'New contacts', goal: 3, val: lastWeek.conversations || 0 },
        { k: 'Referrals', goal: 1, val: lastWeek.offers_made_accepted || 0 },
      ].map((row) => {
        const pct = row.goal === 0 ? 0 : Math.min(100, Math.round((row.val / row.goal) * 100));
        return {
          k: row.k,
          v: `${row.val} / ${row.goal}`,
          pct,
          ok: row.val >= row.goal,
        };
      })
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[300] overflow-y-auto bg-black/40 px-4 py-6 md:py-10"
    >
      <div className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[16px] bg-background shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-3.5">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.07em] text-primary">
            <CheckSquare className="h-3.5 w-3.5" />
            Weekly Check-In
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-6 md:px-8 md:py-8">
          <section className="relative mb-7 overflow-hidden rounded-[14px] bg-gradient-to-br from-reop-dark-blue to-[hsl(210_47%_18%)] px-9 py-8 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full"
              style={{ background: 'radial-gradient(circle, hsl(184 100% 50% / 0.22), transparent 70%)' }}
            />
            <div className="absolute right-9 top-7 hidden rounded-[10px] border border-white/20 bg-white/10 px-4 py-2.5 text-center backdrop-blur-sm sm:block">
              <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-[hsl(184_60%_80%)]">Week {currentWeek}</div>
              <div className="text-base font-semibold">{weekRangeLabel(currentWeek, currentYear)}</div>
            </div>
            <div className="relative">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-[hsl(184_60%_80%)]">
                <CheckSquare className="h-[13px] w-[13px]" />
                Weekly Check-In
              </div>
              <h2 className="mb-2.5 text-[clamp(1.5rem,2vw+0.5rem,2rem)] font-medium leading-[1.15] tracking-[-0.035em]">
                How did your week go, {agentName}?
              </h2>
              <p className="max-w-[560px] text-sm leading-[1.65] text-[hsl(210_30%_82%)]">
                Five minutes, once a week. Your numbers feed the Scoreboard, sharpen the Coach's signals,
                and keep your momentum visible.
              </p>
            </div>
          </section>

          <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
            <div>
              <FormSection
                num={1}
                title="This week's activity"
                desc={`Enter your actual numbers for the week of ${weekRangeLabel(currentWeek, currentYear)}. These feed your Scoreboard and help the Coach calibrate your call list.`}
              >
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {metrics.map((m) => {
                    const val = values[m.key];
                    const c = ctx(m, val);
                    return (
                      <div key={m.key} className="flex flex-col gap-1.5">
                        <label className="flex items-center justify-between text-[12px] font-semibold text-reop-dark-blue">
                          {m.label}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Goal: {m.goal}
                          </span>
                        </label>
                        <div className="relative">
                          <button
                            onClick={() => step(m.key, -1)}
                            className="absolute left-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-[hsl(210_20%_97%)] text-base font-semibold text-reop-dark-blue hover:border-primary hover:bg-reop-teal-soft hover:text-primary"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={val}
                            onChange={(e) =>
                              setValues((v) => ({ ...v, [m.key]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                            className={cn(
                              'h-12 w-full rounded-lg border bg-card text-center text-[22px] font-semibold text-reop-dark-blue outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_hsl(184_100%_34%/0.12)]',
                              val > 0 ? 'border-reop-green' : 'border-border',
                            )}
                            style={{ MozAppearance: 'textfield' as React.CSSProperties['MozAppearance'] }}
                          />
                          <button
                            onClick={() => step(m.key, 1)}
                            className="absolute right-1.5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-[hsl(210_20%_97%)] text-base font-semibold text-reop-dark-blue hover:border-primary hover:bg-reop-teal-soft hover:text-primary"
                          >
                            +
                          </button>
                        </div>
                        <span className={cn('text-center text-[11px]', c.cls)}>{c.text}</span>
                      </div>
                    );
                  })}
                </div>
              </FormSection>

              <FormSection
                num={2}
                title="Wins & challenges"
                desc="Your Coach reads these to personalize your weekly narrative. Be honest — the challenges are as useful as the wins."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-reop-dark-blue">
                      <TrendingUp className="h-[13px] w-[13px]" />
                      This week's wins
                    </label>
                    <textarea
                      value={wins}
                      onChange={(e) => setWins(e.target.value)}
                      placeholder="What went well? A great conversation, a referral received, a contract signed…"
                      className="min-h-[90px] resize-none rounded-lg border border-border bg-card px-3.5 py-3 text-sm leading-[1.6] text-reop-dark-blue outline-none focus:border-primary focus:shadow-[0_0_0_3px_hsl(184_100%_34%/0.12)]"
                    />
                    <span className="text-[11.5px] text-muted-foreground">What drove those results?</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-reop-dark-blue">
                      <AlertTriangle className="h-[13px] w-[13px]" />
                      This week's challenges
                    </label>
                    <textarea
                      value={challenges}
                      onChange={(e) => setChallenges(e.target.value)}
                      placeholder="What was harder than expected? What got in your way?"
                      className="min-h-[90px] resize-none rounded-lg border border-border bg-card px-3.5 py-3 text-sm leading-[1.6] text-reop-dark-blue outline-none focus:border-primary focus:shadow-[0_0_0_3px_hsl(184_100%_34%/0.12)]"
                    />
                    <span className="text-[11.5px] text-muted-foreground">What would you do differently?</span>
                  </div>
                </div>
              </FormSection>

              <FormSection
                num={3}
                title="Energy & focus"
                desc="Rate your week on a 1–5 scale. Your Coach uses these trends to spot burnout patterns before they become a problem."
              >
                <div className="flex flex-col gap-3.5">
                  {ratingGroups.map((g) => (
                    <div
                      key={g.key}
                      className="grid items-center gap-4 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="text-sm font-medium text-reop-dark-blue">
                        {g.label}
                        <small className="mt-0.5 block text-[12px] font-normal text-muted-foreground">
                          {g.sub}
                        </small>
                      </div>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => {
                          const selected = ratings[g.key] === n;
                          return (
                            <button
                              key={n}
                              onClick={() => setRatings((r) => ({ ...r, [g.key]: n }))}
                              className={cn(
                                'h-9 w-9 rounded-lg border-[1.5px] text-[13px] font-semibold transition-colors',
                                ratingTone(n, selected),
                              )}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </FormSection>

              <FormSection
                num={4}
                title="Focus for next week"
                desc="Pick your top 1–2 priorities. The Coach will surface matching contacts and tasks in your SphereSync list."
              >
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {focusOptions.map((f) => {
                    const selected = focuses[f.key];
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.key}
                        onClick={() =>
                          setFocuses((s) => ({ ...s, [f.key]: !s[f.key] }))
                        }
                        className={cn(
                          'flex items-center gap-2.5 rounded-[10px] border-[1.5px] bg-card px-3.5 py-3 text-left transition-colors hover:border-primary hover:bg-reop-teal-soft',
                          selected ? 'border-primary bg-reop-teal-soft' : 'border-border',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px]',
                            selected
                              ? 'bg-primary text-white'
                              : 'bg-[hsl(210_20%_95%)] text-muted-foreground',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[13px] font-medium text-reop-dark-blue">
                          {f.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <label className="mb-1.5 block text-[12px] font-semibold text-reop-dark-blue">
                    Anything else on your mind going into next week?
                  </label>
                  <textarea
                    value={otherNotes}
                    onChange={(e) => setOtherNotes(e.target.value)}
                    placeholder="Optional — your Coach reads this for context…"
                    className="min-h-[72px] w-full resize-none rounded-lg border border-border bg-card px-3.5 py-3 text-sm leading-[1.6] text-reop-dark-blue outline-none focus:border-primary focus:shadow-[0_0_0_3px_hsl(184_100%_34%/0.12)]"
                  />
                </div>
              </FormSection>

              <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border bg-card px-7 py-5">
                <div>
                  <b className="mb-1 block text-base font-semibold text-reop-dark-blue">
                    Ready to submit?
                  </b>
                  <p className="text-[13px] leading-[1.5] text-muted-foreground">
                    Your Scoreboard updates immediately. The Coach generates your weekly narrative within
                    a few minutes. You'll see it on the Dashboard.
                  </p>
                </div>
                <div className="flex flex-shrink-0 gap-2.5">
                  <button
                    onClick={onClose}
                    disabled={submitting}
                    className="h-10 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-reop-dark-blue hover:bg-muted disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? 'Submitting…' : thisWeek ? 'Update check-in →' : 'Submit Weekly Check-In →'}
                  </button>
                </div>
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <Panel title="Check-In Streak" icon={Zap}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[36px] font-semibold tracking-[-0.02em] text-primary">{streak}</span>
                  <span className="text-sm text-muted-foreground">
                    {streak === 1 ? 'week in a row' : 'weeks in a row'}
                  </span>
                </div>
                <div className="mb-3.5 mt-1 text-[12.5px] text-muted-foreground">
                  {streak === 0
                    ? 'Submit this week to start your streak.'
                    : "Don't break it — submit before Sunday midnight."}
                </div>
                {streak > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: Math.min(streak, 12) }).map((_, i) => (
                      <div
                        key={i}
                        className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-primary text-[10px] font-semibold text-white"
                      >
                        ✓
                      </div>
                    ))}
                    <div className="flex h-6 w-6 items-center justify-center rounded-[5px] border-2 border-primary bg-card text-[10px] font-semibold text-primary">
                      →
                    </div>
                  </div>
                )}
              </Panel>

              <Panel title="Last Week's Numbers" icon={BarChart2} subtitle={weekRangeLabel(prevWeek, prevYear)}>
                {lastWeekRows ? (
                  <div className="flex flex-col">
                    {lastWeekRows.map((row, i) => (
                      <div
                        key={row.k}
                        className={cn(
                          'flex flex-col gap-1.5 py-2.5',
                          i < lastWeekRows.length - 1 && 'border-b border-border',
                        )}
                      >
                        <div className="flex justify-between text-[12.5px]">
                          <span className="text-muted-foreground">{row.k}</span>
                          <span
                            className={cn(
                              'font-semibold',
                              row.ok ? 'text-[hsl(142_55%_28%)]' : 'text-[hsl(35_80%_38%)]',
                            )}
                          >
                            {row.v}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-[3px] bg-[hsl(210_20%_92%)]">
                          <span
                            className={cn(
                              'block h-full rounded-[3px]',
                              row.ok ? 'bg-primary' : 'bg-[hsl(35_80%_55%)]',
                            )}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 text-[12.5px] text-muted-foreground">
                    No check-in submitted last week.
                  </div>
                )}
              </Panel>

              <div className="rounded-xl border border-[hsl(184_50%_85%)] bg-[hsl(184_100%_97%)] px-5 py-4">
                <div className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-primary">
                  <Sparkles className="h-[13px] w-[13px]" />
                  How this gets used
                </div>
                <p className="text-[13px] leading-[1.65] text-reop-dark-blue">
                  Your numbers feed the Scoreboard immediately. The Coach uses this week's check-in
                  alongside your activity log to refresh tomorrow's call list and surface trends on
                  your Dashboard.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({
  num,
  title,
  desc,
  children,
}: {
  num: number;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-reop-teal-soft text-[12px] font-bold text-primary">
          {num}
        </div>
        <div>
          <h3 className="mb-0.5 text-base font-semibold text-reop-dark-blue">{title}</h3>
          <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  subtitle,
  children,
}: {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold tracking-[-0.01em] text-reop-dark-blue">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </h3>
        {subtitle && <span className="text-[11.5px] text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
