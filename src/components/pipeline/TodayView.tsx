import { useState } from 'react';
import { TodayOpportunity, useToday } from '@/hooks/useToday';
import { TodayOpportunityCard } from './TodayOpportunityCard';
import { QuickLogModal } from './QuickLogModal';
import { CompleteAndSetNextModal } from './CompleteAndSetNextModal';
import { OpportunityDetailV2 } from './OpportunityDetailV2';
import { Button } from '@/components/ui/button';
import { RefreshCcw, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

function SectionHeader({
  icon, title, count, color, open, onToggle
}: {
  icon: React.ReactNode; title: string; count: number;
  color: string; open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left py-1 group"
    >
      <span className={cn('shrink-0', color)}>{icon}</span>
      <span className="font-semibold text-sm flex-1">{title}</span>
      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', color === 'text-red-600' ? 'bg-red-100 text-red-700' : color === 'text-yellow-600' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700')}>
        {count}
      </span>
      {open ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

export function TodayView() {
  const { needsAttention, stale, onTrack, all, loading, refresh } = useToday();
  const [logTarget, setLogTarget] = useState<TodayOpportunity | null>(null);
  const [completeTarget, setCompleteTarget] = useState<TodayOpportunity | null>(null);
  const [detailTarget, setDetailTarget] = useState<TodayOpportunity | null>(null);
  const [openSections, setOpenSections] = useState({ attention: true, stale: true, onTrack: true });

  const toggle = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const onTrackPct = all.length > 0 ? Math.round((onTrack.length / all.length) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (all.length === 0) {
    return (
      <div className="text-center py-16">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-base mb-1">No open deals</h3>
        <p className="text-sm text-muted-foreground">Add an opportunity to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Health bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden flex">
          {needsAttention.length > 0 && (
            <div
              className="bg-red-400 h-full transition-all"
              style={{ width: `${(needsAttention.length / all.length) * 100}%` }}
            />
          )}
          {stale.length > 0 && (
            <div
              className="bg-yellow-400 h-full transition-all"
              style={{ width: `${(stale.length / all.length) * 100}%` }}
            />
          )}
          {onTrack.length > 0 && (
            <div
              className="bg-green-400 h-full transition-all"
              style={{ width: `${(onTrack.length / all.length) * 100}%` }}
            />
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {onTrackPct}% on track
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={refresh} title="Refresh">
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<AlertCircle className="h-4 w-4" />}
            title="Needs Attention"
            count={needsAttention.length}
            color="text-red-600"
            open={openSections.attention}
            onToggle={() => toggle('attention')}
          />
          {openSections.attention && (
            <div className="space-y-2 pl-1">
              {needsAttention.map(opp => (
                <TodayOpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onOpen={setDetailTarget}
                  onLog={setLogTarget}
                  onComplete={setCompleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Going Stale */}
      {stale.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<Clock className="h-4 w-4" />}
            title="Going Stale"
            count={stale.length}
            color="text-yellow-600"
            open={openSections.stale}
            onToggle={() => toggle('stale')}
          />
          {openSections.stale && (
            <div className="space-y-2 pl-1">
              {stale.map(opp => (
                <TodayOpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onOpen={setDetailTarget}
                  onLog={setLogTarget}
                  onComplete={setCompleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* On Track */}
      {onTrack.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="On Track"
            count={onTrack.length}
            color="text-green-600"
            open={openSections.onTrack}
            onToggle={() => toggle('onTrack')}
          />
          {openSections.onTrack && (
            <div className="space-y-2 pl-1">
              {onTrack.map(opp => (
                <TodayOpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onOpen={setDetailTarget}
                  onLog={setLogTarget}
                  onComplete={setCompleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <QuickLogModal
        opportunity={logTarget}
        open={!!logTarget}
        onOpenChange={open => { if (!open) setLogTarget(null); }}
        onLogged={refresh}
      />
      <CompleteAndSetNextModal
        opportunity={completeTarget}
        open={!!completeTarget}
        onOpenChange={open => { if (!open) setCompleteTarget(null); }}
        onCompleted={refresh}
      />
      <OpportunityDetailV2
        opportunity={detailTarget}
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        onRefresh={refresh}
      />
    </div>
  );
}
