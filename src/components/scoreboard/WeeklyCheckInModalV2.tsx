/**
 * WeeklyCheckInModalV2 — fast, focused weekly check-in.
 *
 * Replaces the old `/coaching` page + the inline "InlineCheckInCard" with
 * a 4-section modal matching `design/checkin.html`:
 *
 *   1. Activity numbers — metric grid with +/- steppers and "vs goal" context.
 *   2. Wins & challenges — two textareas, side-by-side.
 *   3. Energy & focus — three 1-5 rating scales (energy, focus, confidence).
 *   4. Focus for next week — multi-select tags + free-form notes/must-do.
 *
 * Right rail shows: streak dots (last 12 weeks), last week's snapshot, YTD
 * summary. Submission goes through the existing useSubmitCoachingForm
 * mutation so the rest of the app (Scoreboard, AI Coach, weekly nudges)
 * picks up the new fields without changes.
 *
 * Triggered from the Scoreboard hero's "Submit weekly check-in" button.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart2, Briefcase, Calendar, CheckCircle, CheckSquare, Gift, GraduationCap,
  Loader2, Minus, Phone, Plus, Send, Sparkles, TrendingUp, UserPlus, Users, Zap, X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useCoachingSubmissions, useSubmitCoachingForm, useWeeklyStreak, useLast4Weeks,
  type CoachingSubmission,
} from '@/hooks/useCoaching';
import { useCoachingGoals } from '@/hooks/useCoachingGoals';
import { getCurrentWeekNumber } from '@/utils/sphereSyncLogic';

interface Props {
  open: boolean;
  onClose: () => void;
  agentFirstName?: string;
}

// ── Metric defs ────────────────────────────────────────────────────────

type MetricKey =
  | 'dials_made'
  | 'conversations'
  | 'appointments_set'
  | 'agreements_signed'
  | 'closings'
  | 'closing_amount';

interface MetricDef {
  key: MetricKey;
  label: string;
  /** Optional default weekly goal hint. Overridden by annual÷52 when present. */
  defaultGoal?: number;
  prefix?: string;
  step?: number;
}

const METRICS: MetricDef[] = [
  { key: 'dials_made',        label: 'Dials',         defaultGoal: 50,  step: 1 },
  { key: 'conversations',     label: 'Conversations', defaultGoal: 20,  step: 1 },
  { key: 'appointments_set',  label: 'Appointments',  defaultGoal: 3,   step: 1 },
  { key: 'agreements_signed', label: 'Agreements',    defaultGoal: 1,   step: 1 },
  { key: 'closings',          label: 'Closings',      defaultGoal: 0,   step: 1 },
  { key: 'closing_amount',    label: 'GCI ($)',       prefix: '$',     step: 100 },
];

// ── Focus area tags ────────────────────────────────────────────────────

const FOCUS_AREAS = [
  { key: 'calling_cadence', label: 'Calling cadence', Icon: Phone },
  { key: 'sphere_outreach', label: 'Sphere outreach', Icon: Users },
  { key: 'pipeline_deals',  label: 'Pipeline opportunities',  Icon: Briefcase },
  { key: 'event_prep',      label: 'Event prep',      Icon: Calendar },
  { key: 'delight_gifts',   label: 'Delight & gifts', Icon: Gift },
  { key: 'listing_leads',   label: 'Listing leads',   Icon: TrendingUp },
  { key: 'new_contacts',    label: 'New contacts',    Icon: UserPlus },
  { key: 'skills_training', label: 'Skills / training', Icon: GraduationCap },
];

type MetricDraft = Record<MetricKey, string>;
const EMPTY_METRICS: MetricDraft = {
  dials_made: '', conversations: '', appointments_set: '',
  agreements_signed: '', closings: '', closing_amount: '',
};

interface RatingDraft {
  energy: number | null;
  focus: number | null;
  confidence: number | null;
}
const EMPTY_RATINGS: RatingDraft = { energy: null, focus: null, confidence: null };

// ── Helpers ────────────────────────────────────────────────────────────

function weekRangeLabel(weekNumber: number, year: number): string {
  // ISO-week ranges (Mon → Sun). UTC-based to stay consistent with the
  // edge-fn nudge cron's isoWeek() function.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Mon);
  start.setUTCDate(week1Mon.getUTCDate() + (weekNumber - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)}–${fmt(end)}`;
}

// ── Component ──────────────────────────────────────────────────────────

export function WeeklyCheckInModalV2({ open, onClose, agentFirstName }: Props) {
  const submit = useSubmitCoachingForm();
  const { data: submissions = [] } = useCoachingSubmissions();
  const { data: streak = 0 } = useWeeklyStreak();
  const { data: last4 = [] } = useLast4Weeks();
  const { goals } = useCoachingGoals();

  const currentWeek = getCurrentWeekNumber();
  const currentYear = new Date().getFullYear();
  const thisWeekSub = useMemo<CoachingSubmission | null>(
    () => submissions.find((s) => s.week_number === currentWeek && s.year === currentYear) ?? null,
    [submissions, currentWeek, currentYear],
  );

  const [metrics, setMetrics] = useState<MetricDraft>(EMPTY_METRICS);
  const [ratings, setRatings] = useState<RatingDraft>(EMPTY_RATINGS);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [challenges, setChallenges] = useState('');
  const [wins, setWins] = useState('');
  const [mustDoTask, setMustDoTask] = useState('');
  const [coachingNotes, setCoachingNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // Hydrate from existing submission when modal opens.
  useEffect(() => {
    if (!open) return;
    if (thisWeekSub) {
      setMetrics({
        dials_made: thisWeekSub.dials_made ? String(thisWeekSub.dials_made) : '',
        conversations: thisWeekSub.conversations ? String(thisWeekSub.conversations) : '',
        appointments_set: thisWeekSub.appointments_set ? String(thisWeekSub.appointments_set) : '',
        agreements_signed: thisWeekSub.agreements_signed ? String(thisWeekSub.agreements_signed) : '',
        closings: thisWeekSub.closings ? String(thisWeekSub.closings) : '',
        closing_amount: thisWeekSub.closing_amount ? String(thisWeekSub.closing_amount) : '',
      });
      setRatings({
        energy: thisWeekSub.energy_rating ?? null,
        focus: thisWeekSub.focus_rating ?? null,
        confidence: thisWeekSub.confidence_rating ?? null,
      });
      setFocusAreas(thisWeekSub.focus_areas ?? []);
      setChallenges(thisWeekSub.challenges ?? '');
      setWins(thisWeekSub.tasks ?? ''); // re-using `tasks` for wins per existing schema mapping
      setMustDoTask(thisWeekSub.must_do_task ?? '');
      setCoachingNotes(thisWeekSub.coaching_notes ?? '');
    } else {
      setMetrics(EMPTY_METRICS);
      setRatings(EMPTY_RATINGS);
      setFocusAreas([]);
      setChallenges(''); setWins(''); setMustDoTask(''); setCoachingNotes('');
    }
    setErr(null);
  }, [open, thisWeekSub]);

  // Derived weekly goals from annual goals when set, else fall back to the
  // metric def's default. Drives the "Goal: 50" line + "6 below goal" hints.
  const weeklyGoals = useMemo(() => {
    const fromAnnual = (annual: number | null | undefined) =>
      annual != null && annual > 0 ? Math.round(annual / 52) : null;
    return {
      dials_made:        null,
      conversations:     fromAnnual(goals.annual_conversations_goal),
      appointments_set:  null,
      agreements_signed: null,
      closings:          fromAnnual(goals.annual_closings_goal),
      closing_amount:    fromAnnual(goals.annual_gci_goal),
    } as Record<MetricKey, number | null>;
  }, [goals]);

  function step(key: MetricKey, delta: number) {
    setErr(null);
    setMetrics((prev) => {
      const stepSize = METRICS.find((m) => m.key === key)?.step ?? 1;
      const curr = Number(prev[key] || 0);
      const next = Math.max(0, curr + delta * stepSize);
      return { ...prev, [key]: String(next) };
    });
  }

  function setMetric(key: MetricKey, raw: string) {
    setErr(null);
    setMetrics((prev) => ({ ...prev, [key]: raw.replace(/[^0-9.]/g, '') }));
  }

  function toggleFocus(key: string) {
    setFocusAreas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function contextFor(key: MetricKey): { text: string; tone: 'ok' | 'warn' | 'mute' } {
    const val = Number(metrics[key] || 0);
    const goalEff = weeklyGoals[key] ?? METRICS.find((m) => m.key === key)?.defaultGoal ?? 0;
    if (!goalEff) return { text: val > 0 ? `${val} logged` : '—', tone: 'mute' };
    if (val >= goalEff) return { text: `On goal (${goalEff})`, tone: 'ok' };
    const gap = goalEff - val;
    return { text: val === 0 ? `Goal ${goalEff}` : `${gap} below goal`, tone: 'warn' };
  }

  const filledCount = (Object.keys(metrics) as MetricKey[]).filter((k) => metrics[k] !== '').length;
  const reflectionFilled = !!(mustDoTask.trim() || challenges.trim() || wins.trim() || coachingNotes.trim());

  async function handleSubmit() {
    setErr(null);
    if (filledCount === 0 && !reflectionFilled && ratings.energy == null && ratings.focus == null && ratings.confidence == null) {
      setErr('Add at least one number, rating, or note — even a quiet week needs a paper trail.');
      return;
    }
    try {
      await submit.mutateAsync({
        week_number: currentWeek,
        year: currentYear,
        conversations: Number(metrics.conversations || 0),
        dials_made: Number(metrics.dials_made || 0),
        leads_contacted: 0,
        appointments_set: Number(metrics.appointments_set || 0),
        appointments_held: 0,
        agreements_signed: Number(metrics.agreements_signed || 0),
        offers_made_accepted: 0,
        closings: Number(metrics.closings || 0),
        closing_amount: Number(metrics.closing_amount || 0),
        tasks: wins.trim() || undefined,
        challenges: challenges.trim() || undefined,
        coaching_notes: coachingNotes.trim() || undefined,
        must_do_task: mustDoTask.trim() || undefined,
        energy_rating: ratings.energy,
        focus_rating: ratings.focus,
        confidence_rating: ratings.confidence,
        focus_areas: focusAreas.length > 0 ? focusAreas : null,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Submission failed');
    }
  }

  // ── Right-rail: last 12 weeks streak dots ──
  const streakDots = useMemo(() => {
    const submittedKeys = new Set(submissions.map((s) => `${s.year}-${s.week_number}`));
    const out: Array<{ key: string; state: 'done' | 'current' | 'missed' }> = [];
    for (let i = 11; i >= 0; i--) {
      const w = currentWeek - i;
      const y = w > 0 ? currentYear : currentYear - 1;
      const wn = w > 0 ? w : w + 52;
      const key = `${y}-${wn}`;
      if (i === 0) out.push({ key, state: submittedKeys.has(key) ? 'done' : 'current' });
      else out.push({ key, state: submittedKeys.has(key) ? 'done' : 'missed' });
    }
    return out;
  }, [submissions, currentWeek, currentYear]);

  const lastWeekSub = useMemo<CoachingSubmission | null>(() => {
    const w = currentWeek - 1 > 0 ? currentWeek - 1 : 52;
    const y = currentWeek - 1 > 0 ? currentYear : currentYear - 1;
    return submissions.find((s) => s.week_number === w && s.year === y) ?? null;
  }, [submissions, currentWeek, currentYear]);

  const ytdTotals = useMemo(() => {
    const ytd = submissions.filter((s) => s.year === currentYear);
    return ytd.reduce(
      (a, s) => ({
        dials: a.dials + (s.dials_made || 0),
        convos: a.convos + (s.conversations || 0),
        appts: a.appts + (s.appointments_set || 0),
        closings: a.closings + (s.closings || 0),
        gci: a.gci + Number(s.closing_amount || 0),
        weeks: a.weeks + 1,
      }),
      { dials: 0, convos: 0, appts: 0, closings: 0, gci: 0, weeks: 0 },
    );
  }, [submissions, currentYear]);

  const ratingScale: Array<{ v: number; tone: 'low' | 'mid' | 'good' | 'great' }> = [
    { v: 1, tone: 'low' }, { v: 2, tone: 'low' }, { v: 3, tone: 'mid' },
    { v: 4, tone: 'good' }, { v: 5, tone: 'great' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[1100px] max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Hero */}
        <div
          className="relative overflow-hidden rounded-t-lg text-white px-7 py-7"
          style={{ background: 'linear-gradient(135deg, hsl(var(--reop-dark-blue)), hsl(210 47% 18%))' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(184 100% 50% / 0.22), transparent 70%)' }}
          />
          <div className="absolute top-5 right-5 hidden sm:block rounded-lg border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm text-center">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: 'hsl(184 60% 80%)' }}>Week</div>
            <div className="text-sm font-semibold">{weekRangeLabel(currentWeek, currentYear)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 sm:hidden text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em]" style={{ color: 'hsl(184 60% 80%)' }}>
              <CheckSquare className="w-3.5 h-3.5" />
              Weekly Check-In
            </div>
            <DialogTitle asChild>
              <h2 className="text-[clamp(1.4rem,1.8vw+0.5rem,1.85rem)] font-medium tracking-[-0.035em] leading-[1.15] text-balance mt-2">
                How did your week go{agentFirstName ? `, ${agentFirstName}` : ''}?
              </h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="text-[14px] mt-2 max-w-[560px] leading-[1.6]" style={{ color: 'hsl(210 30% 82%)' }}>
                Five minutes, once a week. Your numbers feed the Scoreboard, sharpen the Coach's signals, and keep your momentum visible.
              </p>
            </DialogDescription>
          </div>
        </div>

        {/* Body */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-5 p-6">
          {/* ── FORM COLUMN ── */}
          <div className="space-y-5 min-w-0">

            {/* Section 1: Numbers */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <SectionHead num={1} done={filledCount > 0} title="This week's activity" desc={`Enter your actual numbers for ${weekRangeLabel(currentWeek, currentYear)}. These feed your Scoreboard and help the Coach calibrate your call list.`} />
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {METRICS.map((m) => {
                    const ctx = contextFor(m.key);
                    const goalEff = weeklyGoals[m.key] ?? m.defaultGoal ?? 0;
                    return (
                      <div key={m.key} className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-semibold text-reop-dark-blue flex justify-between items-center">
                          {m.label}
                          {goalEff > 0 && (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              Goal: {m.prefix ?? ''}{goalEff}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => step(m.key, -1)}
                            aria-label={`Decrement ${m.label}`}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md border border-border bg-[hsl(210_20%_97%)] flex items-center justify-center text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition z-10"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={metrics[m.key]}
                            onChange={(e) => setMetric(m.key, e.target.value)}
                            placeholder="0"
                            className={cn(
                              'w-full h-12 px-12 rounded-lg border bg-card text-[22px] font-semibold text-center text-reop-dark-blue tabular-nums focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition',
                              metrics[m.key] && Number(metrics[m.key]) > 0
                                ? 'border-reop-green'
                                : 'border-border',
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => step(m.key, 1)}
                            aria-label={`Increment ${m.label}`}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md border border-border bg-[hsl(210_20%_97%)] flex items-center justify-center text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition z-10"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span
                          className={cn(
                            'text-[11px] text-center',
                            ctx.tone === 'ok' && 'text-[hsl(142_55%_28%)] font-semibold',
                            ctx.tone === 'warn' && 'text-[hsl(35_80%_38%)] font-semibold',
                            ctx.tone === 'mute' && 'text-muted-foreground',
                          )}
                        >
                          {ctx.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Section 2: Wins & challenges */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <SectionHead num={2} done={!!(wins.trim() || challenges.trim())} title="Wins & challenges" desc="Your Coach reads these to personalize your weekly narrative. Be honest — the challenges are as useful as the wins." />
              <div className="p-5 grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-reop-dark-blue flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> This week's wins
                  </label>
                  <textarea
                    value={wins}
                    onChange={(e) => setWins(e.target.value)}
                    rows={3}
                    placeholder="What went well? A great conversation, a referral, a contract signed…"
                    className="border border-border rounded-lg px-3 py-2.5 text-sm resize-none min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition leading-[1.6]"
                  />
                  <span className="text-[11.5px] text-muted-foreground">What drove those results?</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-reop-dark-blue flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> This week's challenges
                  </label>
                  <textarea
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    rows={3}
                    placeholder="What was harder than expected? What got in your way?"
                    className="border border-border rounded-lg px-3 py-2.5 text-sm resize-none min-h-[90px] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition leading-[1.6]"
                  />
                  <span className="text-[11.5px] text-muted-foreground">What would you do differently?</span>
                </div>
              </div>
            </section>

            {/* Section 3: Ratings */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <SectionHead num={3} done={ratings.energy != null || ratings.focus != null || ratings.confidence != null} title="Energy & focus" desc="Rate your week on a 1–5 scale. Your Coach uses these trends to spot burnout patterns before they become a problem." />
              <div className="p-5 space-y-3.5">
                <RatingRow
                  label="Overall energy"
                  sub="How did your physical and mental energy feel this week?"
                  value={ratings.energy}
                  onChange={(v) => setRatings((r) => ({ ...r, energy: v }))}
                  scale={ratingScale}
                />
                <RatingRow
                  label="Focus & productivity"
                  sub="How well did you stay on task and prioritize the right activities?"
                  value={ratings.focus}
                  onChange={(v) => setRatings((r) => ({ ...r, focus: v }))}
                  scale={ratingScale}
                />
                <RatingRow
                  label="Confidence & motivation"
                  sub="How confident did you feel about your pipeline and direction this week?"
                  value={ratings.confidence}
                  onChange={(v) => setRatings((r) => ({ ...r, confidence: v }))}
                  scale={ratingScale}
                />
              </div>
            </section>

            {/* Section 4: Focus for next week */}
            <section className="bg-card border border-border rounded-xl overflow-hidden">
              <SectionHead num={4} done={focusAreas.length > 0 || !!mustDoTask.trim()} title="Focus for next week" desc="Pick your top 1–2 priorities. The Coach surfaces matching contacts and tasks in your SphereSync list." />
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {FOCUS_AREAS.map(({ key, label, Icon }) => {
                    const selected = focusAreas.includes(key);
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => toggleFocus(key)}
                        aria-pressed={selected}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-[1.5px] bg-card text-left transition',
                          selected
                            ? 'border-primary bg-reop-teal-soft'
                            : 'border-border hover:border-primary hover:bg-reop-teal-soft/40',
                        )}
                      >
                        <span className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                          selected ? 'bg-primary text-white' : 'bg-[hsl(210_20%_95%)] text-muted-foreground',
                        )}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[13px] font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <label className="text-[12px] font-semibold text-reop-dark-blue flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-3 h-3 text-primary" /> Must-do task this week (pinned to your scoreboard)
                  </label>
                  <input
                    type="text"
                    value={mustDoTask}
                    onChange={(e) => setMustDoTask(e.target.value)}
                    maxLength={140}
                    placeholder="e.g. Call the 5 hottest leads by Thursday."
                    className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="mt-3">
                  <label className="text-[12px] font-semibold text-reop-dark-blue block mb-1.5">
                    Anything else on your mind going into next week?
                  </label>
                  <textarea
                    value={coachingNotes}
                    onChange={(e) => setCoachingNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional — your Coach reads this for context."
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition leading-[1.6]"
                  />
                </div>
              </div>
            </section>

            {/* Submit zone */}
            <div className="bg-card border border-border rounded-xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-base font-semibold">Ready to submit?</div>
                <p className="text-[13px] text-muted-foreground leading-[1.5] mt-1 max-w-[440px]">
                  Your Scoreboard updates immediately. The Coach generates your weekly narrative within a few minutes.
                </p>
                {err && (
                  <p className="text-[12px] text-rose-700 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {err}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" onClick={onClose} disabled={submit.isPending}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={submit.isPending} size="lg" className="gap-1.5">
                  {submit.isPending
                    ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</>)
                    : (<><Send className="w-3.5 h-3.5" /> {thisWeekSub ? 'Save changes' : 'Submit check-in'}</>)}
                </Button>
              </div>
            </div>
          </div>

          {/* ── RIGHT RAIL ── */}
          <aside className="space-y-4 hidden lg:block">
            {/* Streak */}
            <div className="bg-card border border-border rounded-xl px-5 py-4">
              <h3 className="text-[13px] font-semibold flex items-center gap-1.5 mb-2">
                <Zap className="w-4 h-4 text-primary" /> Check-in streak
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-semibold text-primary leading-none tracking-[-0.02em]">{streak}</span>
                <span className="text-[13px] text-muted-foreground">weeks in a row</span>
              </div>
              <div className="text-[12px] text-muted-foreground mt-1 mb-3">
                Don't break it — submit before Sunday midnight.
              </div>
              <div className="flex gap-1 flex-wrap">
                {streakDots.map((d) => (
                  <span
                    key={d.key}
                    title={d.key}
                    className={cn(
                      'w-5 h-5 rounded-[5px] flex items-center justify-center text-[9px] font-semibold',
                      d.state === 'done' && 'bg-primary text-white',
                      d.state === 'current' && 'bg-white border-2 border-primary text-primary',
                      d.state === 'missed' && 'bg-[hsl(0_50%_94%)] text-[hsl(0_60%_60%)]',
                    )}
                  >
                    {d.state === 'done' ? '✓' : d.state === 'current' ? '→' : '·'}
                  </span>
                ))}
              </div>
            </div>

            {/* Last week */}
            <div className="bg-card border border-border rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-primary" /> Last week's numbers
                </h3>
                {lastWeekSub && (
                  <span className="text-[11px] text-muted-foreground">
                    {weekRangeLabel(lastWeekSub.week_number, lastWeekSub.year)}
                  </span>
                )}
              </div>
              {lastWeekSub ? (
                <div className="space-y-2">
                  <PrevRow k="Dials" v={lastWeekSub.dials_made || 0} goal={null} />
                  <PrevRow k="Conversations" v={lastWeekSub.conversations || 0} goal={weeklyGoals.conversations} />
                  <PrevRow k="Appointments" v={lastWeekSub.appointments_set || 0} goal={null} />
                  <PrevRow k="Agreements" v={lastWeekSub.agreements_signed || 0} goal={null} />
                  <PrevRow k="Closings" v={lastWeekSub.closings || 0} goal={weeklyGoals.closings} />
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground py-2">
                  No check-in last week. Submit this one to start a fresh streak.
                </p>
              )}
            </div>

            {/* YTD */}
            <div className="bg-card border border-border rounded-xl px-5 py-4">
              <h3 className="text-[13px] font-semibold flex items-center gap-1.5 mb-2">
                <Calendar className="w-4 h-4 text-primary" /> {currentYear} year-to-date
              </h3>
              <YtdRow k="Dials" v={ytdTotals.dials} />
              <YtdRow k="Conversations" v={ytdTotals.convos} />
              <YtdRow k="Appointments" v={ytdTotals.appts} />
              <YtdRow k="Closings" v={ytdTotals.closings} />
              <YtdRow k="GCI" v={`$${Math.round(ytdTotals.gci).toLocaleString()}`} />
              <YtdRow k="Check-ins submitted" v={`${ytdTotals.weeks} / ${currentWeek}`} last />
            </div>

            {/* Coach hint */}
            <div className="rounded-xl border border-primary/30 bg-reop-teal-soft px-5 py-4">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-primary mb-1.5">
                <Sparkles className="w-3 h-3" /> From your Coach
              </div>
              <p className="text-[12.5px] leading-[1.6] text-reop-dark-blue">
                {streak === 0
                  ? 'First check-in is the hardest. Honest numbers — even quiet ones — give the Coach signal to work with.'
                  : streak < 4
                    ? 'Three weeks in. The pattern is forming. Keep submitting and the weekly narrative starts paying off.'
                    : `${streak} weeks deep. You're building the muscle most agents skip — keep the calls honest and the numbers will follow.`}
              </p>
              <div className="mt-2 text-[11.5px] text-muted-foreground">
                — Your narrative posts to the Hub after you submit.
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionHead({ num, done, title, desc }: { num: number; done: boolean; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0',
        done ? 'bg-reop-green text-white' : 'bg-reop-teal-soft text-primary',
      )}>
        {done ? <CheckCircle className="w-3.5 h-3.5" /> : num}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-snug">{title}</h3>
        <p className="text-[12.5px] text-muted-foreground leading-[1.5] mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function RatingRow({
  label, sub, value, onChange, scale,
}: {
  label: string;
  sub: string;
  value: number | null;
  onChange: (v: number) => void;
  scale: Array<{ v: number; tone: 'low' | 'mid' | 'good' | 'great' }>;
}) {
  return (
    <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-center">
      <div>
        <div className="text-[13.5px] font-medium">{label}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
      <div className="flex gap-1.5">
        {scale.map(({ v, tone }) => {
          const selected = value === v;
          return (
            <button
              type="button"
              key={v}
              onClick={() => onChange(v)}
              aria-pressed={selected}
              className={cn(
                'w-9 h-9 rounded-lg border-[1.5px] bg-card text-[13px] font-semibold text-muted-foreground font-inherit transition',
                !selected && 'border-border hover:border-primary hover:text-primary hover:bg-reop-teal-soft',
                selected && tone === 'low' && 'bg-[hsl(0_72%_50%)] border-[hsl(0_72%_50%)] text-white',
                selected && tone === 'mid' && 'bg-[hsl(35_80%_50%)] border-[hsl(35_80%_50%)] text-white',
                selected && tone === 'good' && 'bg-primary border-primary text-white',
                selected && tone === 'great' && 'bg-reop-green border-reop-green text-white',
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrevRow({ k, v, goal }: { k: string; v: number; goal: number | null }) {
  const ok = goal == null ? null : v >= goal;
  const pct = goal == null || goal === 0 ? 100 : Math.min(100, Math.round((v / goal) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12.5px]">
        <span className="text-muted-foreground">{k}</span>
        <span className={cn(
          'font-semibold',
          ok == null ? 'text-reop-dark-blue' : ok ? 'text-[hsl(142_55%_28%)]' : 'text-[hsl(35_80%_38%)]',
        )}>
          {v}{goal != null && ` / ${goal}`}
        </span>
      </div>
      {goal != null && (
        <div className="h-1.5 bg-[hsl(210_20%_92%)] rounded-full overflow-hidden">
          <span
            className={cn('block h-full rounded-full', ok ? 'bg-primary' : 'bg-[hsl(35_80%_55%)]')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function YtdRow({ k, v, last }: { k: string; v: number | string; last?: boolean }) {
  return (
    <div className={cn(
      'flex justify-between items-center py-2 text-[13px]',
      !last && 'border-b border-border',
    )}>
      <span className="text-muted-foreground text-[12.5px]">{k}</span>
      <strong className="font-semibold text-reop-dark-blue tabular-nums">{v}</strong>
    </div>
  );
}
