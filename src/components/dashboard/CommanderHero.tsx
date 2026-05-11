/**
 * CommanderHero — the dark-blue band at the top of the Dashboard.
 *
 * Greets the agent (never a contact), summarizes what's left this week,
 * and shows 4 headline KPIs. NO Coach CTA, no contact-suggestions, no
 * call-to-action button — that's SphereSync's job. The dashboard's job
 * is to surface the agent's own numbers.
 *
 * Layout reference: design/dashboard-v2.html .hero-band.
 */

import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── KPI cell ────────────────────────────────────────────────────────

export interface HeroKpi {
  label: string;
  /** The big value rendered in display font. */
  value: string;
  /** Optional smaller suffix tucked beside `value` (e.g. "/50" or "deals"). */
  valueSub?: string;
  /** Trend chip text. If `link` is set, the trend chip is itself a Link. */
  trend?: string;
  /** When present, render the trend chip as a Link to this path. */
  trendLink?: string;
}

function KpiCell({ kpi }: { kpi: HeroKpi }) {
  const trendInner = kpi.trend ? (
    <>
      <TrendingUp className="w-2.5 h-2.5" />
      <span>{kpi.trend}</span>
      {kpi.trendLink && <ArrowRight className="w-2.5 h-2.5" />}
    </>
  ) : null;
  return (
    <div className="px-[22px] py-[18px] bg-reop-hero-stat-bg transition hover:brightness-110">
      <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-reop-hero-eyebrow mb-2">
        {kpi.label}
      </div>
      <div className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-white mb-1.5">
        {kpi.value}
        {kpi.valueSub && (
          <span className="ml-1 text-[14px] font-normal text-reop-hero-eyebrow tracking-normal">
            {kpi.valueSub}
          </span>
        )}
      </div>
      {kpi.trend && (
        kpi.trendLink ? (
          <Link
            to={kpi.trendLink}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-reop-hero-trend hover:underline"
          >
            {trendInner}
          </Link>
        ) : (
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-reop-hero-trend">
            {trendInner}
          </div>
        )
      )}
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────

interface CommanderHeroProps {
  firstName: string;
  greeting: string;
  dateLabel: string;
  /** Sub-line under the greeting. Computed from real numbers by the
   *  parent — Hero just renders it. Falsy = render nothing. */
  subline: string | null;
  kpis: [HeroKpi, HeroKpi, HeroKpi, HeroKpi];
}

export function CommanderHero({ firstName, greeting, dateLabel, subline, kpis }: CommanderHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[20px] px-10 pt-9 pb-8 text-white bg-reop-dark-blue',
      )}
    >
      {/* Twin radial highlights — top-right teal + bottom-left green */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 600px 400px at 110% -20%, hsl(var(--reop-teal) / 0.18) 0%, transparent 60%),
            radial-gradient(ellipse 300px 300px at -10% 120%, hsl(var(--reop-green) / 0.12) 0%, transparent 60%)
          `,
        }}
      />

      <div className="relative">
        {/* Eyebrow with green pulse */}
        <div className="flex items-center gap-2 mb-2.5 text-[11px] uppercase tracking-[0.1em] font-semibold text-reop-hero-eyebrow">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-reop-green"
            style={{ boxShadow: '0 0 8px hsl(var(--reop-green))' }}
          />
          {dateLabel}
        </div>

        {/* Greeting — always the agent's first name */}
        <h2 className="font-display text-[clamp(1.9rem,2.8vw+0.5rem,2.6rem)] font-normal tracking-[-0.04em] leading-[1.1] text-white max-w-[640px] m-0 mb-2 text-balance">
          {greeting},{' '}
          <strong className="font-bold" style={{ color: 'hsl(184 90% 72%)' }}>
            {firstName}.
          </strong>
        </h2>

        {/* Sub-line — only render when the parent has one to show */}
        {subline && (
          <p className="m-0 mb-8 text-sm leading-[1.65] text-reop-hero-sub max-w-[520px]">
            {subline}
          </p>
        )}

        {/* 4 KPI cells in a tight grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] rounded-[14px] overflow-hidden bg-reop-dark-blue-2">
          {kpis.map((k) => (
            <KpiCell key={k.label} kpi={k} />
          ))}
        </div>
      </div>
    </section>
  );
}
