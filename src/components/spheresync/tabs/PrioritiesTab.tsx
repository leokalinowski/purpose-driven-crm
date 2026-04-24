import { Briefcase, Users, Sparkles, AlertCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCoachingState, ALERT_META, TodayItem } from '@/hooks/useCoachingState';
import { HeroCard } from '@/components/commander/HeroCard';
import { ActionCard } from '@/components/commander/ActionCard';
import { TodayView } from '@/components/pipeline/TodayView';
import { Opportunity } from '@/hooks/usePipeline';

interface PrioritiesTabProps {
  onOpenOpportunity?: (opp: Opportunity) => void;
}

export function PrioritiesTab({ onOpenOpportunity }: PrioritiesTabProps) {
  const { state: coach, loading: coachLoading } = useCoachingState();

  const sphereToday: TodayItem[] = coach?.today_list ?? [];
  const alerts = coach?.alerts ?? [];

  return (
    <div className="space-y-6">
      {/* AI Coach hero — the single most important thing right now */}
      <HeroCard nextHour={coach?.next_hour ?? null} loading={coachLoading} />

      {/* Pipeline today — transactional urgency comes first */}
      <section className="space-y-3">
        <SectionHeading
          icon={<Briefcase className="h-4 w-4 text-orange-600" />}
          title="Pipeline today"
          subtitle="Active deals that need a touch"
        />
        <TodayView onOpenDetail={(opp) => onOpenOpportunity?.(opp as Opportunity)} />
      </section>

      {/* Sphere today — relationship cadence from the AI Coach */}
      <section className="space-y-3">
        <SectionHeading
          icon={<Users className="h-4 w-4 text-blue-600" />}
          title="Sphere today"
          subtitle="People to reach out to, ranked by the Coach"
          rightSlot={
            sphereToday.length > 0 ? (
              <span className="text-xs text-muted-foreground">{sphereToday.length} contacts</span>
            ) : null
          }
        />
        {coachLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        ) : sphereToday.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="font-medium text-sm">No sphere touches surfaced</p>
            <p className="text-xs text-muted-foreground mt-1">
              {coach
                ? 'The Coach has nothing to flag right now. Check back after the next tick.'
                : 'Your Coach hasn\'t run yet — the first full tick runs at 05:00 UTC.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sphereToday.map((item, i) => (
              <ActionCard
                key={`${item.contact_id}-${i}`}
                item={item}
                showCoachBadge
                onCall={() => toast.info(`Dialling ${item.contact_name}…`)}
                onText={() => toast.info(`Opening text to ${item.contact_name}…`)}
                onLog={() => toast.info('Opening log modal…')}
              />
            ))}
          </div>
        )}
      </section>

      {/* Signals — Coach alerts */}
      {!coachLoading && alerts.length > 0 && (
        <section className="space-y-2">
          <SectionHeading
            icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
            title="Signals"
            subtitle="What the Coach noticed"
          />
          <div className="space-y-1.5">
            {alerts.slice(0, 6).map((alert, i) => {
              const meta = ALERT_META[alert.level];
              return (
                <div key={i} className={cn('rounded-lg p-3 flex items-start gap-2.5', meta.bg)}>
                  <span className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', meta.dot)} />
                  <p className={cn('text-sm leading-snug flex-1', meta.text)}>{alert.message}</p>
                  {alert.contact_id && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({
  icon, title, subtitle, rightSlot,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-2 border-b border-border pb-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
        {subtitle && <span className="text-xs text-muted-foreground hidden sm:inline">— {subtitle}</span>}
      </div>
      {rightSlot}
    </div>
  );
}
