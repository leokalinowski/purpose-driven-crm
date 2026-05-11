/**
 * EventPublicHeader — guest-facing event hero shown on the public RSVP page.
 *
 * Phase 2 of the Events comprehensive sweep. The previous version used
 * `${primaryColor}20` hex-alpha tricks for icon backgrounds and a generic
 * 3-card grid that included a useless "Public Event" tile. This rewrite:
 *
 *   - Single hero card with header image (or gradient fallback) and a
 *     prominent date callout, matching the featured-event treatment in
 *     src/pages/Events.tsx
 *   - Token-driven chrome (bg-card, border-border, text-muted-foreground)
 *     with the agent's brand color reserved for true accent moments
 *     (avatar border, the date-tile color stripe)
 *   - Drops the redundant "Public Event" tile + "About this event" card
 *     into compact metadata rows
 */

import { Calendar, MapPin, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventPublicHeaderProps {
  title: string;
  eventDate: string;
  location?: string;
  description?: string;
  headerImageUrl?: string;
  brandColor?: string;
  agentName?: string;
  teamName?: string;
  brokerage?: string;
  agentLogo?: string;
  agentHeadshot?: string;
}

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export const EventPublicHeader = ({
  title,
  eventDate,
  location,
  description,
  headerImageUrl,
  brandColor,
  agentName,
  teamName,
  brokerage,
  agentLogo,
  agentHeadshot,
}: EventPublicHeaderProps) => {
  const primaryColor = brandColor || 'hsl(var(--primary))';
  const date = parseISO(eventDate);
  const monthLabel = MONTHS_SHORT[date.getMonth()];
  const dayLabel = date.getDate();
  const fullDate = format(date, 'EEEE, MMMM d, yyyy');
  const timeLabel = format(date, 'h:mm a');

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Hero image / gradient banner — header image when set, otherwise a
          gentle gradient using the agent's brand color so the page still
          feels intentional even without a custom image. */}
      <div
        className="relative aspect-[16/8] sm:aspect-[16/7] flex items-end p-5 sm:p-6"
        style={{
          background: headerImageUrl
            ? `url(${headerImageUrl}) center/cover`
            : `linear-gradient(135deg, ${primaryColor}, hsl(var(--reop-dark-blue)))`,
        }}
      >
        {!headerImageUrl && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(circle at 80% 90%, rgba(0,0,0,0.18), transparent 60%)',
            }}
          />
        )}
        {/* Date tile — the focal point of the hero. */}
        <div
          className="relative bg-white text-reop-dark-blue rounded-lg py-2 px-3 sm:py-2.5 sm:px-3.5 text-center min-w-[68px] shadow-md"
          style={{ borderTop: `3px solid ${primaryColor}` }}
        >
          <div className="text-[10.5px] uppercase font-bold tracking-[0.07em]" style={{ color: primaryColor }}>
            {monthLabel}
          </div>
          <div className="text-[28px] sm:text-[30px] font-medium leading-none -tracking-[0.02em]">{dayLabel}</div>
        </div>
      </div>

      {/* Title + agent attribution */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="space-y-2">
          {/* Agent identity strip — avatar + logo, only when present. Compact
              row instead of the previous oversized centered layout. */}
          {(agentHeadshot || agentLogo || agentName) && (
            <div className="flex items-center gap-3 flex-wrap">
              {agentHeadshot && (
                <img
                  src={agentHeadshot}
                  alt={agentName || 'Host'}
                  className="h-10 w-10 rounded-full object-cover border-2"
                  style={{ borderColor: primaryColor }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {agentLogo && (
                <img
                  src={agentLogo}
                  alt={`${agentName || 'Host'} logo`}
                  className="h-8 w-auto object-contain max-w-[160px]"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              {agentName && (
                <span className="text-[12.5px] text-muted-foreground">
                  Hosted by <span className="text-foreground font-medium">{agentName}</span>
                  {teamName && <> · {teamName}</>}
                  {brokerage && <> · {brokerage}</>}
                </span>
              )}
            </div>
          )}
          <h1 className="text-2xl sm:text-[28px] font-medium tracking-tighter leading-[1.15]">{title}</h1>
        </div>

        {/* Compact metadata strip (date / time / location). Inline icons,
            no oversized circular badges. */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground border-t border-border pt-4">
          <Meta icon={Calendar} label={fullDate} />
          <Meta icon={Clock} label={timeLabel} />
          {location && <Meta icon={MapPin} label={location} />}
        </div>

        {/* Description — only renders when set. The card border above keeps
            it visually grouped with the title without needing a separate
            "About this event" wrapper card. */}
        {description && (
          <div className="border-t border-border pt-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        )}
      </div>
    </article>
  );
};

function Meta({ icon: Icon, label }: { icon: typeof Calendar; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5')}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}
