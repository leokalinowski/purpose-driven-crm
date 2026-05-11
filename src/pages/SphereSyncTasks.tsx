import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, CalendarDays, History, CheckSquare, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { PrioritiesTab } from '@/components/spheresync/tabs/PrioritiesTab';
import { CadenceTab } from '@/components/spheresync/tabs/CadenceTab';
import { HistoryTab } from '@/components/spheresync/tabs/HistoryTab';
import { WeeklyCheckInModal } from '@/components/shared/WeeklyCheckInModal';
import { cn } from '@/lib/utils';

type Tab = 'priorities' | 'cadence' | 'history';
const VALID_TABS: Tab[] = ['priorities', 'cadence', 'history'];

const tabDefs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'priorities', label: 'Priorities', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'cadence',    label: 'Cadence',    icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { key: 'history',    label: 'History',    icon: <History className="h-3.5 w-3.5" /> },
];

export default function SphereSyncTasks() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useUserProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [checkInOpen, setCheckInOpen] = useState(false);

  const activeTab: Tab = useMemo(() => {
    const t = searchParams.get('tab');
    return (VALID_TABS as string[]).includes(t ?? '') ? (t as Tab) : 'priorities';
  }, [searchParams]);

  const setActiveTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'priorities') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (searchParams.get('checkin') === '1') {
      setCheckInOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('checkin');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading SphereSync…
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-sm">Please sign in to access SphereSync.</p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Helmet><title>SphereSync — Real Estate on Purpose</title></Helmet>
      <Layout>
        {/* PAGE HEAD */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <span className="eye-label block mb-1.5">SphereSync™</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              Your operational hub.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              What to do now, who to call this week, and how the past month has gone — in that order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setCheckInOpen(true)}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border border-border bg-card text-sm font-semibold text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary transition"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Weekly check-in
            </button>
          </div>
        </div>

        {/* SEGMENTED TABS + WEEK PICKER */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px]" role="tablist">
            {tabDefs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[7px] text-sm transition-all',
                  activeTab === tab.key
                    ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Week selector lives inside Cadence + History tabs only —
              Priorities is always "right now" so a week jumper there is
              meaningless. */}
        </div>

        {/* TAB CONTENT */}
        {activeTab === 'priorities' && <PrioritiesTab />}
        {activeTab === 'cadence'    && <CadenceTab />}
        {activeTab === 'history'    && <HistoryTab />}
      </Layout>
      <WeeklyCheckInModal
        open={checkInOpen}
        // Prefer the agent's first name from `profiles`. Fall back to the
        // email-prefix only if the profile hasn't loaded — never as a default.
        agentName={profile?.first_name?.trim() || undefined}
        onClose={() => setCheckInOpen(false)}
      />
    </>
  );
}
