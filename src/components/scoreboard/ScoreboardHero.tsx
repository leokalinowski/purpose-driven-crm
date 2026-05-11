/**
 * ScoreboardHero — the gradient banner at the top of /scoreboard.
 *
 * Two states:
 *   Pending  → "How did your week go, [name]?" + primary CTA button that
 *              opens the WeeklyCheckInModalV2. Plus streak count.
 *   Logged   → "Week N logged ✓" + the must-do task as an inline quote
 *              if set. The CTA flips to "Edit this week" (re-opens modal
 *              pre-hydrated). Streak count.
 *
 * Matches `design/checkin.html` hero — gradient, week badge top-right,
 * radial glow ::before, streak block on the right inside the hero rather
 * than as a separate card.
 */

import { CheckSquare, Send, Zap, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CoachingSubmission } from '@/hooks/useCoaching';

interface ScoreboardHeroProps {
  agentFirstName: string;
  weekNumber: number;
  weekRange: string;
  streak: number;
  thisWeekSub: CoachingSubmission | null;
  onOpenCheckIn: () => void;
}

export function ScoreboardHero({
  agentFirstName, weekNumber, weekRange, streak, thisWeekSub, onOpenCheckIn,
}: ScoreboardHeroProps) {
  const logged = !!thisWeekSub;
  const mustDo = thisWeekSub?.must_do_task?.trim();

  return (
    <div
      className="relative overflow-hidden rounded-[14px] text-white mb-7"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--reop-dark-blue)), hsl(210 47% 18%))',
      }}
    >
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full"
        style={{ background: 'radial-gradient(circle, hsl(184 100% 50% / 0.22), transparent 70%)' }}
      />

      {/* Week badge — desktop only */}
      <div className="absolute top-7 right-9 hidden md:block rounded-[10px] border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm text-center">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: 'hsl(184 60% 80%)' }}>
          Week {weekNumber}
        </div>
        <div className="text-sm font-semibold">{weekRange}</div>
      </div>

      <div className="relative px-7 py-8 md:px-9 md:py-9 grid gap-6 lg:grid-cols-[1fr_auto] items-end">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.09em] flex items-center gap-1.5" style={{ color: 'hsl(184 60% 80%)' }}>
            <CheckSquare className="w-3.5 h-3.5" />
            {logged ? 'Weekly check-in · logged' : 'Weekly check-in'}
          </div>
          <h1 className="text-[clamp(1.6rem,2.2vw+0.5rem,2.1rem)] font-medium tracking-[-0.035em] leading-[1.15] text-balance mt-2 mb-3 max-w-[680px]">
            {logged
              ? `${agentFirstName}, this week is logged. Your Coach is on it.`
              : `${agentFirstName}, how did your week go?`}
          </h1>
          <p className="text-[14.5px] leading-[1.65] max-w-[580px]" style={{ color: 'hsl(210 30% 82%)' }}>
            {logged
              ? "Your Scoreboard below is updated with this week's numbers. Come back Sunday to log next week — your streak depends on it."
              : 'Five minutes, once a week. Your numbers feed the Scoreboard, sharpen the Coach\'s signals, and keep your momentum visible.'}
          </p>

          {/* Must-do quote (only when logged AND task set) */}
          {logged && mustDo && (
            <blockquote
              className="mt-5 max-w-[580px] py-3 px-4 border-l-[3px] rounded-r-[10px] text-[15px] leading-[1.5] italic"
              style={{
                borderLeftColor: 'hsl(35 100% 60%)',
                background: 'hsl(35 70% 16% / 0.4)',
                color: 'hsl(35 50% 90%)',
                fontFamily: 'var(--font-display, serif)',
              }}
            >
              <div className="flex items-center gap-1.5 not-italic font-bold uppercase text-[10px] tracking-[0.08em] mb-1" style={{ color: 'hsl(35 80% 80%)', fontFamily: 'inherit' }}>
                <Target className="w-3 h-3" />
                This week's commitment
              </div>
              "{mustDo}"
            </blockquote>
          )}

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button
              onClick={onOpenCheckIn}
              size="lg"
              className="bg-white text-reop-dark-blue hover:bg-white/90 gap-1.5 h-11 px-5 font-semibold"
            >
              {logged ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  Edit this week's check-in
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit weekly check-in
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Streak block — inline on the hero */}
        <div className="rounded-[12px] border border-white/15 bg-white/5 px-5 py-4 backdrop-blur-sm min-w-[220px] flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'hsl(184 60% 80%)' }}>
            <Zap className="w-3.5 h-3.5" />
            Check-in streak
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[40px] font-semibold tracking-[-0.02em] leading-none text-white">{streak}</span>
            <span className="text-[14px]" style={{ color: 'hsl(210 30% 82%)' }}>
              {streak === 1 ? 'week' : 'weeks'}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] leading-snug" style={{ color: 'hsl(210 30% 82%)' }}>
            {streak === 0
              ? 'Submit this week to start your streak.'
              : logged
                ? "You're current. Don't break it."
                : 'Submit this week to keep it alive.'}
          </p>
        </div>
      </div>
    </div>
  );
}
