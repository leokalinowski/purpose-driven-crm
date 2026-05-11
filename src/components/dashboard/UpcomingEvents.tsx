/**
 * UpcomingEvents — next 5 events panel, sized to live alongside the
 * recent-activity feed in the dashboard split.
 *
 * Layout reference: design/dashboard-v2.html .up-panel.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight, ArrowUpRight } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { useEvents } from '@/hooks/useEvents';

export function UpcomingEvents({ limit = 5 }: { limit?: number }) {
  const { events } = useEvents();

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter((e) => isAfter(new Date(e.event_date), now))
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, limit)
      .map((e) => {
        const d = new Date(e.event_date);
        return {
          id: e.id,
          dow: format(d, 'EEE'),
          dom: d.getDate(),
          title: e.title,
          sub: [format(d, 'h:mm a'), e.location].filter(Boolean).join(' · '),
        };
      });
  }, [events, limit]);

  return (
    <section className="bg-card border border-border rounded-[16px] overflow-hidden">
      <div className="px-5 py-4 flex justify-between items-center border-b border-border">
        <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] inline-flex items-center gap-2 text-reop-dark-blue">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          Upcoming
        </h3>
        <Link
          to="/events"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[12.5px] font-semibold text-reop-dark-blue hover:bg-reop-teal-soft transition"
        >
          Events
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div>
        {upcoming.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
            No upcoming events. Plan one from the Events page.
          </div>
        ) : (
          <ul className="m-0 p-0">
            {upcoming.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/events?event=${u.id}`}
                  className="grid grid-cols-[48px_1fr_30px] gap-3 px-5 py-3 items-center border-b border-border last:border-b-0 transition hover:bg-[hsl(210_20%_99%)]"
                >
                  <div className="text-center bg-reop-surface-subtle rounded-[10px] px-1.5 py-[7px]">
                    <div className="text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground font-bold">
                      {u.dow}
                    </div>
                    <div className="text-[19px] font-bold leading-none tracking-[-0.02em] text-reop-dark-blue">
                      {u.dom}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <b className="block text-[13px] font-semibold mb-0.5 text-reop-dark-blue truncate">
                      {u.title}
                    </b>
                    <span className="text-[11.5px] text-muted-foreground truncate">
                      {u.sub}
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-reop-teal-soft text-primary flex items-center justify-center transition hover:bg-primary hover:text-white">
                    <ArrowUpRight className="w-[13px] h-[13px]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
