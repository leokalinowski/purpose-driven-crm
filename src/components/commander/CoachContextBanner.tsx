import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCoachingState, AlertType, ALERT_META } from '@/hooks/useCoachingState';

/**
 * CoachContextBanner — a compact strip that surfaces the Coach's pipeline-
 * or sphere-relevant state on existing pages (Pipeline, SphereSync-tasks,
 * Database). Lens mode: these pages become views into the same coaching
 * state rather than parallel silos.
 *
 * Props:
 *   context — which narrative line + alert types to surface
 *     'pipeline' → pipeline_story + stuck_deal, opportunity_no_next_step
 *     'sphere'   → sphere_story + overdue_touch, high_priority_ignored, life_event
 */

type Context = 'pipeline' | 'sphere';

const CONTEXT_CONFIG: Record<Context, {
  label: string;
  narrativeKey: 'pipeline_story' | 'sphere_story';
  alertTypes: AlertType[];
  accent: string;
}> = {
  pipeline: {
    label: "Pipeline — what the Coach is seeing",
    narrativeKey: 'pipeline_story',
    alertTypes: ['stuck_deal', 'opportunity_no_next_step'],
    accent: 'from-orange-50 to-transparent border-orange-200',
  },
  sphere: {
    label: "Sphere — what the Coach is seeing",
    narrativeKey: 'sphere_story',
    alertTypes: ['overdue_touch', 'high_priority_ignored', 'life_event'],
    accent: 'from-blue-50 to-transparent border-blue-200',
  },
};

interface Props {
  context: Context;
  className?: string;
}

export function CoachContextBanner({ context, className }: Props) {
  const { state, loading } = useCoachingState();
  const cfg = CONTEXT_CONFIG[context];

  // Render nothing while loading OR when the Coach hasn't produced output yet.
  // The page's own content remains — the banner is additive.
  if (loading || !state) return null;

  const narrative = state.week_narrative?.[cfg.narrativeKey];
  const relevantAlerts = state.alerts.filter(a => cfg.alertTypes.includes(a.type));
  const topAlerts = relevantAlerts.slice(0, 3);

  if (!narrative && topAlerts.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-r p-3.5 md:p-4',
      cfg.accent, className,
    )}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-white/70 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-purple-500" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
            {cfg.label}
          </div>
          {narrative && (
            <p className="text-sm leading-snug text-foreground mb-2">{narrative}</p>
          )}
          {topAlerts.length > 0 && (
            <ul className="space-y-1">
              {topAlerts.map((a, i) => {
                const meta = ALERT_META[a.level];
                return (
                  <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                    <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', meta.dot)} />
                    <span className={meta.text}>{a.message}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Link
          to="/"
          className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-center"
          title="Go to Today"
        >
          <span className="hidden sm:inline">Open Today</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
