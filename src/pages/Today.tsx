import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { RefreshCcw, ChevronDown, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePrioritizedContacts,
  useRescorePriorities,
  PriorityTier,
  PriorityGroups,
  TIER_META,
  PrioritizedContact,
} from '@/hooks/usePrioritizedContacts';
import { PrioritizedContactCard } from '@/components/today/PrioritizedContactCard';

const TIERS_IN_ORDER: { key: keyof PriorityGroups; tier: PriorityTier; defaultOpen: boolean }[] = [
  { key: 'urgent',   tier: 'urgent',   defaultOpen: true },
  { key: 'hot',      tier: 'hot',      defaultOpen: true },
  { key: 'warm',     tier: 'warm',     defaultOpen: false },
  { key: 'cool',     tier: 'cool',     defaultOpen: false },
  { key: 'cold',     tier: 'cold',     defaultOpen: false },
  { key: 'unscored', tier: 'unscored', defaultOpen: false },
];

function TierSection({
  tier, contacts, defaultOpen, onLog, onOpen,
}: {
  tier: PriorityTier;
  contacts: PrioritizedContact[];
  defaultOpen: boolean;
  onLog?: (c: PrioritizedContact) => void;
  onOpen?: (c: PrioritizedContact) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = TIER_META[tier];

  if (contacts.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left py-1 group min-h-[44px] md:min-h-0"
        aria-expanded={open}
      >
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', meta.dot)} />
        <span className={cn('font-semibold text-sm', meta.text)}>{meta.label}</span>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', meta.bg, meta.text)}>
          {contacts.length}
        </span>
        <span className="ml-auto text-muted-foreground group-hover:text-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="space-y-2 pl-1">
          {contacts.slice(0, 50).map(c => (
            <PrioritizedContactCard
              key={c.id}
              contact={c}
              onLog={onLog}
              onOpen={onOpen}
            />
          ))}
          {contacts.length > 50 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Showing top 50 of {contacts.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Today() {
  const { groups, loading, error, refetch } = usePrioritizedContacts();
  const rescore = useRescorePriorities();

  const handleRescore = () => rescore.mutate();
  const handleRefresh = () => refetch();

  const totalScored = groups
    ? groups.urgent.length + groups.hot.length + groups.warm.length + groups.cool.length + groups.cold.length
    : 0;
  const totalUnscored = groups?.unscored.length ?? 0;
  const noContacts = !loading && groups && groups.all.length === 0;

  return (
    <>
      <Helmet><title>Today — Real Estate on Purpose</title></Helmet>
      <Layout>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Today</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Who to talk to, and why. Powered by Grok.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-11 md:h-9"
                onClick={handleRescore}
                disabled={rescore.isPending}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {rescore.isPending ? 'Scoring…' : 'Rescore'}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 md:h-9 md:w-9"
                onClick={handleRefresh}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary strip */}
          {groups && totalScored > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['urgent', 'hot', 'warm', 'cool', 'cold', 'unscored'] as const).map(k => {
                const meta = TIER_META[k];
                const count = groups[k].length;
                return (
                  <div
                    key={k}
                    className={cn(
                      'rounded-lg p-2 text-center',
                      count > 0 ? meta.bg : 'bg-muted/30',
                    )}
                  >
                    <div className={cn('text-lg font-bold', count > 0 ? meta.text : 'text-muted-foreground')}>
                      {count}
                    </div>
                    <div className={cn('text-[10px] uppercase tracking-wider font-semibold', count > 0 ? meta.text : 'text-muted-foreground')}>
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 bg-muted rounded-lg" />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">We couldn't load your priorities</p>
                  <p className="mt-1">{error.message}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Empty: no contacts at all */}
          {noContacts && (
            <div className="text-center py-16">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-base mb-1">No contacts yet</h3>
              <p className="text-sm text-muted-foreground">
                Import your sphere or add a contact, then come back for AI-powered priorities.
              </p>
            </div>
          )}

          {/* Empty: have contacts but none scored */}
          {!loading && groups && groups.all.length > 0 && totalScored === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-base mb-1">No priorities yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You have {groups.unscored.length} contacts waiting to be scored. Click Rescore to start.
              </p>
              <Button onClick={handleRescore} disabled={rescore.isPending}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                {rescore.isPending ? 'Scoring…' : 'Score now'}
              </Button>
            </div>
          )}

          {/* Tier sections */}
          {!loading && groups && totalScored > 0 && (
            <div className="space-y-5">
              {TIERS_IN_ORDER.map(({ key, tier, defaultOpen }) => (
                <TierSection
                  key={tier}
                  tier={tier}
                  contacts={groups[key]}
                  defaultOpen={defaultOpen}
                />
              ))}
            </div>
          )}

          {/* Footer hint */}
          {!loading && totalUnscored > 0 && totalScored > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
              {totalUnscored} contact{totalUnscored === 1 ? '' : 's'} not yet scored. They'll be picked up on the next scoring run.
            </p>
          )}
        </div>
      </Layout>
    </>
  );
}
