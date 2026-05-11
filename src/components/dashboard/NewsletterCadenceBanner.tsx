/**
 * NewsletterCadenceBanner — Hub-level nudge that surfaces when an agent's
 * newsletter rhythm is slipping. Renders only when there's something to
 * say (status !== 'on_track').
 *
 * Phase 4 of the Newsletter staple-readiness pass.
 */

import { Link } from 'react-router-dom';
import { Mail, Sparkles, ArrowRight, Pause, Repeat, AlertCircle } from 'lucide-react';
import { useNewsletterCadenceStatus } from '@/hooks/useNewsletterCadenceStatus';
import { cn } from '@/lib/utils';

export function NewsletterCadenceBanner() {
  const cadence = useNewsletterCadenceStatus();

  // Don't render until we know — avoids a flash on dashboard mount.
  if (cadence.loading) return null;
  if (cadence.status === 'on_track') return null;

  const config = bannerConfigFor(cadence);

  return (
    <Link
      to={config.linkTo}
      className={cn(
        'group flex items-start gap-3 rounded-xl border p-4 transition mb-6',
        config.tone === 'warn'
          ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
          : 'bg-reop-teal-soft border-reop-teal/30 hover:border-primary',
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
        config.tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-primary text-white',
      )}>
        <config.Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <h3 className="text-sm font-semibold leading-tight text-reop-dark-blue">
            {config.title}
          </h3>
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
            config.tone === 'warn'
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-white/80 text-primary border border-primary/30',
          )}>
            {config.badge}
          </span>
        </div>
        <p className="text-[12.5px] text-reop-dark-blue/85 leading-snug">
          {config.body}
        </p>
      </div>
      <div className="hidden sm:inline-flex items-center gap-1 text-[12px] font-semibold text-primary self-center shrink-0">
        {config.cta}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

// ── Config selector ─────────────────────────────────────────────────────

type Tone = 'warn' | 'primary';

interface BannerConfig {
  title: string;
  body: string;
  badge: string;
  cta: string;
  Icon: typeof Mail;
  tone: Tone;
  linkTo: string;
}

function bannerConfigFor(c: ReturnType<typeof useNewsletterCadenceStatus>): BannerConfig {
  switch (c.status) {
    case 'never':
      return {
        title: 'Send your first newsletter',
        body: 'Staying top of mind every month doubles sphere referrals over time. The Coach drafts; you approve.',
        badge: 'Get started',
        cta: 'Compose',
        Icon: Sparkles,
        tone: 'primary',
        linkTo: '/newsletter-builder',
      };
    case 'overdue':
      return {
        title: `${c.daysSinceLastSend ?? '30+'} days since your last newsletter`,
        body: c.activeRecurringCount > 0
          ? 'Your recurring schedule didn\'t fire as expected — open the Schedule tab to check the cadence.'
          : 'Set a recurring schedule so this never lapses again. Monthly is the sphere-warming sweet spot.',
        badge: 'Overdue',
        cta: 'Open Schedule',
        Icon: AlertCircle,
        tone: 'warn',
        linkTo: '/newsletter?tab=schedule',
      };
    case 'paused': {
      const n = c.pausedRecurringCount;
      return {
        title: `${n} paused newsletter schedule${n === 1 ? '' : 's'}`,
        body: 'Resume them to keep your sphere warm. Pausing was meant to be temporary — autopilot beats manual every month.',
        badge: 'Paused',
        cta: 'Resume',
        Icon: Pause,
        tone: 'warn',
        linkTo: '/newsletter?tab=schedule',
      };
    }
    case 'no_recurring':
      return {
        title: 'Set up a recurring schedule',
        body: c.daysSinceLastSend != null
          ? `Your last newsletter went out ${c.daysSinceLastSend} days ago. A recurring cadence runs forever on autopilot.`
          : 'Pick a template and set it to send every month — never miss your sphere again.',
        badge: 'Suggestion',
        cta: 'Set cadence',
        Icon: Repeat,
        tone: 'primary',
        linkTo: '/newsletter?tab=schedule',
      };
    case 'on_track':
    default:
      // Should never reach here — the parent guards on 'on_track'. But keep
      // an exhaustive return for type safety.
      return {
        title: 'On track',
        body: 'Nothing to surface.',
        badge: 'OK',
        cta: 'Open',
        Icon: Mail,
        tone: 'primary',
        linkTo: '/newsletter',
      };
  }
}
