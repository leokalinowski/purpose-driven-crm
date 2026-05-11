import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useTransactions, type Transaction } from '@/hooks/useTransactions';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { cn } from '@/lib/utils';

type Filter = 'active' | 'closing' | 'ytd' | 'all';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isClosed(t: Transaction): boolean {
  return t.transaction_stage === 'closed';
}

function isClosingSoon(t: Transaction): boolean {
  if (isClosed(t) || !t.closing_date) return false;
  const days = Math.round((new Date(t.closing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days >= 0 && days <= 14;
}

function isClosedYtd(t: Transaction): boolean {
  if (!isClosed(t)) return false;
  const closeDate = t.closing_date ? new Date(t.closing_date) : null;
  if (!closeDate) return false;
  return closeDate.getFullYear() === new Date().getFullYear();
}

export default function Transactions() {
  const { transactions, metrics, loading, syncWithOpenToClose } = useTransactions();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    return {
      active: transactions.filter((t) => !isClosed(t)).length,
      closing: transactions.filter(isClosingSoon).length,
      ytd: transactions.filter(isClosedYtd).length,
      all: transactions.length,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => {
        if (filter === 'active') return !isClosed(t);
        if (filter === 'closing') return isClosingSoon(t);
        if (filter === 'ytd') return isClosedYtd(t);
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        return (
          (t.property_address || '').toLowerCase().includes(q) ||
          (t.client_name || '').toLowerCase().includes(q) ||
          (t.transaction_stage || '').toLowerCase().includes(q)
        );
      });
  }, [transactions, filter, search]);

  const filterOptions: { id: Filter; label: string }[] = [
    { id: 'active', label: `Active (${counts.active})` },
    { id: 'closing', label: `Closing soon (${counts.closing})` },
    { id: 'ytd', label: `Closed YTD (${counts.ytd})` },
    { id: 'all', label: `All (${counts.all})` },
  ];

  const summary = [
    {
      lab: 'YTD volume',
      val: formatCurrency(metrics.totalSalesYear),
      sub: `${metrics.transactionsYear} transactions`,
    },
    {
      lab: 'YTD GCI',
      val: formatCurrency(metrics.gciYear),
      sub: `Avg sale ${formatCurrency(metrics.avgDealValue)}`,
    },
    {
      lab: 'Active pipeline',
      val: String(metrics.ongoing),
      sub: `${formatCurrency(metrics.pipelineValue)} volume`,
    },
    {
      lab: 'Avg days to close',
      val: metrics.dealVelocity > 0 ? String(metrics.dealVelocity) : '—',
      sub: 'Contract → close',
    },
  ];

  const showEmpty = !loading && transactions.length === 0;

  return (
    <>
      <Helmet><title>Transactions — Real Estate on Purpose</title></Helmet>
      <Layout>
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-start md:justify-between gap-4 mb-6 md:mb-7">
          <div>
            <span className="eye-label block mb-1.5">Transactions</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              Every transaction, every detail, in sync.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              Pulled from OpenToClose. Sync runs daily — manual sync below if you need it sooner.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-2.5">
            <button
              onClick={syncWithOpenToClose}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition disabled:opacity-60"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              {loading ? 'Syncing…' : 'Sync with OpenToClose'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
          {summary.map((s) => (
            <div key={s.lab} className="bg-card border border-border rounded-[12px] py-4 px-[18px]">
              <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground font-semibold mb-1.5">{s.lab}</div>
              <div className="text-[26px] font-medium tracking-[-0.02em] leading-none">{s.val}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        <section className="mb-5">
          <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2.5">
            <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px]">
              {filterOptions.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'px-3 py-[6px] rounded-[7px] text-sm transition-all',
                    filter === f.id
                      ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                      : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative max-w-[260px] w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search address, client, stage…"
                className="h-[38px] w-full pl-9 pr-3 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition"
              />
            </div>
          </div>

          {showEmpty ? (
            <div className="bg-card border border-border rounded-[12px] px-6 py-12 text-center">
              <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-reop-dark-blue mb-1">No transactions yet</p>
              <p className="text-[13px] text-muted-foreground mb-4 max-w-[420px] mx-auto">
                Connect OpenToClose in Settings, then click sync to pull your active transactions and closed history.
              </p>
              <button
                onClick={syncWithOpenToClose}
                disabled={loading}
                className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition disabled:opacity-60"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                Run sync now
              </button>
            </div>
          ) : (
            <TransactionTable transactions={filtered} loading={loading} />
          )}
        </section>
      </Layout>
    </>
  );
}
