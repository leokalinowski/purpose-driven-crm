import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Plus, Clock, MapPin, User, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { useEvents, type Event as Ev, type EventTask } from '@/hooks/useEvents';
import { EventForm } from '@/components/events/EventForm';
import { EventCalendar } from '@/components/events/EventCalendar';

type Tab = 'Upcoming' | 'Drafts' | 'Past' | 'Calendar';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseEventDate(iso: string): Date {
  return new Date(iso);
}

function statusFor(ev: Ev): 'Confirmed' | 'Featured' | 'Planning' | 'Draft' {
  if (!ev.is_published) return 'Draft';
  const d = parseEventDate(ev.event_date);
  const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= 14 && days >= 0) return 'Featured';
  if (days >= 0) return 'Confirmed';
  return 'Planning';
}

const statusStyle: Record<ReturnType<typeof statusFor>, string> = {
  Confirmed: 'bg-[hsl(140_50%_94%)] text-[hsl(140_50%_30%)]',
  Featured: 'bg-reop-teal-soft text-primary',
  Planning: 'bg-[hsl(35_100%_94%)] text-[hsl(35_80%_40%)]',
  Draft: 'bg-[hsl(210_20%_94%)] text-muted-foreground',
};

function formatTime(iso: string): string {
  const d = parseEventDate(iso);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${dow} · ${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${ampm}`;
}

function buildCalendarCells(year: number, month: number, eventsThisMonth: Ev[], featuredId?: string) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const eventDayMap = new Map<number, { hasEv: boolean; feature: boolean }>();
  for (const ev of eventsThisMonth) {
    const d = parseEventDate(ev.event_date);
    const day = d.getDate();
    const cur = eventDayMap.get(day) ?? { hasEv: false, feature: false };
    cur.hasEv = true;
    if (ev.id === featuredId) cur.feature = true;
    eventDayMap.set(day, cur);
  }
  const cells: { d: string; off?: boolean; today?: boolean; hasEv?: boolean; feature?: boolean }[] = [];
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ d: String(prevMonthDays - i), off: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const ev = eventDayMap.get(day);
    cells.push({ d: String(day), today: isToday, hasEv: ev?.hasEv, feature: ev?.feature });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ d: String(cells.length - daysInMonth - startDow + 1), off: true });
  }
  return cells;
}

function Avatar({ initials, sm }: { initials: string; sm?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-reop-dark-blue border-2 border-white',
        sm ? 'w-[22px] h-[22px] text-[9px]' : 'w-7 h-7 text-[10px]',
      )}
      style={{ background: 'hsl(184 50% 88%)' }}
    >
      {initials}
    </span>
  );
}

function speakerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Events() {
  const navigate = useNavigate();
  const { events, tasks, loading, markTaskComplete, updateTask } = useEvents();
  const [tab, setTab] = useState<Tab>('Upcoming');
  // `editingEvent` was previously used to open EventForm on card click. Cards
  // now navigate to /events/:id instead — EventForm is reached via the Edit
  // button on the detail page. This state stays only for the "create new"
  // flow which doesn't have a target route until the row is inserted.
  const [showCreate, setShowCreate] = useState(false);
  const [calCursor, setCalCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { upcoming, drafts, past, featured } = useMemo(() => {
    const now = new Date();
    const upcoming = events
      .filter((e) => e.is_published && parseEventDate(e.event_date) >= now)
      .sort((a, b) => parseEventDate(a.event_date).getTime() - parseEventDate(b.event_date).getTime());
    const drafts = events
      .filter((e) => !e.is_published)
      .sort((a, b) => parseEventDate(a.event_date).getTime() - parseEventDate(b.event_date).getTime());
    const past = events
      .filter((e) => parseEventDate(e.event_date) < now)
      .sort((a, b) => parseEventDate(b.event_date).getTime() - parseEventDate(a.event_date).getTime());
    return { upcoming, drafts, past, featured: upcoming[0] ?? null };
  }, [events]);

  const eventsThisMonth = useMemo(() => {
    return events.filter((e) => {
      const d = parseEventDate(e.event_date);
      return d.getFullYear() === calCursor.year && d.getMonth() === calCursor.month;
    });
  }, [events, calCursor]);

  const calendarCells = useMemo(
    () => buildCalendarCells(calCursor.year, calCursor.month, eventsThisMonth, featured?.id),
    [calCursor, eventsThisMonth, featured?.id],
  );

  const checklist: EventTask[] = useMemo(() => {
    if (!featured) return [];
    return tasks.filter((t) => t.event_id === featured.id).slice(0, 6);
  }, [tasks, featured]);

  const visibleList: Ev[] = tab === 'Upcoming' ? upcoming : tab === 'Drafts' ? drafts : past;

  const onCalendarPrev = () =>
    setCalCursor(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  const onCalendarNext = () =>
    setCalCursor(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));

  return (
    <>
      <Helmet><title>Events — Real Estate on Purpose</title></Helmet>
      <Layout>
        {/* PAGE HEAD */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <span className="eye-label block mb-1.5">Events</span>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              The calendar that builds relationships.
            </h1>
            <p className="text-sm text-muted-foreground max-w-[640px] leading-[1.55]">
              Two mixers a year, one pop-by per quarter, four open houses per listing. Your Coach keeps the rhythm; you bring the people.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setTab('Calendar')}
              className={cn(
                'inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg border text-sm font-semibold transition',
                tab === 'Calendar'
                  ? 'border-primary bg-reop-teal-soft text-primary'
                  : 'border-border bg-card text-reop-dark-blue hover:bg-reop-teal-soft hover:border-primary hover:text-primary',
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Calendar view
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Plan event
            </button>
          </div>
        </div>

        {/* HERO: featured + mini cal */}
        <section className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mb-7">
          {featured ? (
            <article
              className="bg-card border border-border rounded-[14px] overflow-hidden cursor-pointer transition hover:border-primary"
              onClick={() => navigate(`/events/${featured.id}`)}
            >
              <div
                className="relative aspect-[16/8] flex items-end p-6"
                style={{
                  background: featured.header_image_url
                    ? `url(${featured.header_image_url}) center/cover`
                    : 'linear-gradient(135deg, hsl(184 70% 40%), hsl(210 47% 22%))',
                }}
              >
                {!featured.header_image_url && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(circle at 20% 20%, hsl(184 100% 60% / 0.3), transparent 60%), radial-gradient(circle at 80% 90%, hsl(280 60% 50% / 0.25), transparent 60%)',
                    }}
                  />
                )}
                <span className="absolute top-5 left-6 text-[11px] uppercase tracking-[0.08em] font-semibold text-white bg-white/20 backdrop-blur px-2.5 py-1 rounded-full">
                  Featured · Next up
                </span>
                <div className="relative bg-white text-reop-dark-blue rounded-[10px] py-2.5 px-3.5 text-center min-w-[72px]">
                  <div className="text-[10.5px] uppercase font-bold tracking-[0.07em] text-primary">
                    {MONTHS[parseEventDate(featured.event_date).getMonth()]}
                  </div>
                  <div className="text-[30px] font-medium leading-none">
                    {parseEventDate(featured.event_date).getDate()}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-medium tracking-[-0.02em] mb-1.5 leading-[1.2]">{featured.title}</h3>
                <div className="flex flex-wrap gap-4 text-[12.5px] text-muted-foreground mb-3.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />{formatTime(featured.event_date)}
                  </span>
                  {featured.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />{featured.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <User className="w-3 h-3" />Hosted by you
                  </span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-[hsl(210_20%_97%)] rounded-[10px] mb-3.5">
                  <div>
                    <div className="text-2xl font-medium tracking-tighter">
                      {featured.current_rsvp_count ?? 0}
                      {featured.max_capacity ? (
                        <span className="text-[15px] text-muted-foreground font-normal">/{featured.max_capacity} RSVPs</span>
                      ) : (
                        <span className="text-[15px] text-muted-foreground font-normal"> RSVPs</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {featured.invited_count
                        ? `${featured.invited_count} invited`
                        : 'Share the public RSVP link to start collecting responses'}
                    </div>
                  </div>
                  {featured.public_slug && (
                    <a
                      onClick={(e) => e.stopPropagation()}
                      href={`/event/${featured.public_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12.5px] text-primary font-semibold hover:underline"
                    >
                      Open public page →
                    </a>
                  )}
                </div>
                <h5 className="text-[11px] uppercase text-muted-foreground tracking-[0.05em] font-bold mb-2">
                  Pre-event checklist
                </h5>
                {checklist.length === 0 ? (
                  <div className="text-[12.5px] text-muted-foreground py-2">
                    No tasks yet for this event.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {checklist.map((t) => {
                      const done = t.status === 'completed';
                      return (
                        <div key={t.id} className="flex items-center gap-2.5 py-2">
                          <span
                            className={cn(
                              'w-[18px] h-[18px] rounded-[5px] flex items-center justify-center flex-shrink-0',
                              done ? 'bg-reop-green border border-reop-green' : 'border-[1.5px] border-border bg-white',
                            )}
                          >
                            {done && (
                              <span className="block w-2.5 h-1.5 border-l-2 border-b-2 border-white rotate-[-45deg] -translate-y-px translate-x-px" />
                            )}
                          </span>
                          <b className={cn('text-sm font-medium', done && 'opacity-50 line-through')}>{t.task_name}</b>
                          <span className="text-[11.5px] text-muted-foreground ml-auto">
                            {t.due_date
                              ? new Date(t.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                              : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          ) : (
            <article className="bg-card border border-dashed border-border rounded-[14px] p-10 flex flex-col items-center justify-center text-center">
              <Calendar className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1.5">No upcoming events yet</h3>
              <p className="text-[12.5px] text-muted-foreground max-w-[360px] leading-[1.5] mb-4">
                Plan a mixer, open house, or pop-by — your Coach will fill in the task checklist automatically.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Plan first event
              </button>
            </article>
          )}

          <div className="flex flex-col gap-4">
            <div className="bg-card border border-border rounded-[12px] p-[18px]">
              <div className="flex justify-between items-center mb-2.5">
                <b className="text-base font-semibold">
                  {FULL_MONTHS[calCursor.month]} {calCursor.year}
                </b>
                <div className="flex gap-1">
                  <button
                    onClick={onCalendarPrev}
                    className="w-[26px] h-[26px] border border-border rounded-md bg-card flex items-center justify-center hover:bg-[hsl(210_20%_96%)]"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={onCalendarNext}
                    className="w-[26px] h-[26px] border border-border rounded-md bg-card flex items-center justify-center hover:bg-[hsl(210_20%_96%)]"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-[10px] uppercase text-muted-foreground text-center py-1 font-semibold">
                    {d}
                  </div>
                ))}
                {calendarCells.map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      'aspect-square flex items-center justify-center text-xs rounded-md relative cursor-pointer hover:bg-[hsl(210_20%_96%)]',
                      c.off && 'text-[hsl(210_10%_70%)]',
                      c.hasEv && !c.today && !c.feature && 'font-semibold text-primary',
                      c.today && 'bg-reop-dark-blue text-white',
                      c.feature && 'bg-reop-teal-soft text-primary font-bold shadow-[inset_0_0_0_2px_hsl(var(--primary))]',
                    )}
                  >
                    {c.d}
                    {c.hasEv && !c.feature && (
                      <span
                        className={cn(
                          'absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                          c.today ? 'bg-white' : 'bg-primary',
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-reop-teal-soft border border-[hsl(184_50%_85%)] rounded-[12px] p-[18px]">
              <div className="flex gap-2.5 items-start">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <b className="block text-sm font-semibold mb-1">Coach nudge</b>
                  <p className="m-0 text-[12.5px] text-reop-dark-blue leading-[1.5]">
                    {upcoming.length === 0
                      ? "You don't have anything on the calendar yet — plan a sphere event to keep your relationships warm."
                      : upcoming.length === 1
                        ? "One event in motion. Aim for two mixers a year + a quarterly pop-by to stay rhythmic."
                        : `${upcoming.length} events queued — strong cadence. Keep checklist tasks moving so day-of feels effortless.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GRID HEAD */}
        <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2.5">
          <h3 className="text-base font-semibold m-0">
            {tab === 'Calendar' ? 'Calendar' : 'All events'}
          </h3>
          <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px]">
            {(['Upcoming', 'Drafts', 'Past', 'Calendar'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3.5 py-[6px] rounded-[7px] text-sm transition-all',
                  tab === t
                    ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
                )}
              >
                {t}
                {t !== 'Calendar' && (
                  <span className="ml-1.5 text-[11px] text-muted-foreground/80">
                    {t === 'Upcoming' ? upcoming.length : t === 'Drafts' ? drafts.length : past.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT — calendar tab takes the full content slot, otherwise grid */}
        {tab === 'Calendar' ? (
          <EventCalendar
            events={events}
            tasks={tasks}
            onTaskToggle={async (task) => {
              try {
                if (task.status === 'completed' || task.completed_at) {
                  // Pass `null` (not `undefined`) so the Supabase update
                  // actually clears `completed_at` rather than omitting it.
                  await updateTask(task.id, { status: 'pending', completed_at: null as unknown as string });
                } else {
                  await markTaskComplete(task.id);
                }
              } catch (err) {
                console.error('Failed to toggle task:', err);
              }
            }}
          />
        ) : loading ? (
          <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">
            Loading events…
          </div>
        ) : visibleList.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {tab === 'Upcoming' && 'No upcoming events yet.'}
              {tab === 'Drafts' && 'No drafts. Save an event without publishing to come back to it later.'}
              {tab === 'Past' && 'No past events on record.'}
            </p>
            {tab !== 'Past' && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-reop-teal-hover transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Plan event
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {visibleList.map((e) => {
              const d = parseEventDate(e.event_date);
              const status = statusFor(e);
              const speakers = e.speakers ?? [];
              return (
                <article
                  key={e.id}
                  onClick={() => navigate(`/events/${e.id}`)}
                  className="relative bg-card border border-border rounded-[12px] p-[18px] flex flex-col gap-2.5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_6px_20px_hsl(184_100%_34%_/_0.1)] cursor-pointer"
                >
                  <span
                    className={cn(
                      'absolute top-3.5 right-3.5 px-2 py-0.5 rounded-md text-[11px] font-semibold',
                      statusStyle[status],
                    )}
                  >
                    {status}
                  </span>
                  <div className="flex items-start gap-3">
                    <div className="bg-[hsl(210_20%_96%)] rounded-md py-2 px-2.5 text-center min-w-[52px]">
                      <div className="text-[9.5px] uppercase font-bold tracking-[0.07em] text-primary">{MONTHS[d.getMonth()]}</div>
                      <div className="text-[20px] font-semibold leading-none">{d.getDate()}</div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold leading-[1.35] mb-0.5 pr-16">{e.title}</h4>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(e.event_date)}
                        {e.location ? ` · ${e.location}` : ''}
                      </div>
                    </div>
                  </div>
                  {e.description && (
                    <div className="text-xs text-muted-foreground leading-[1.5] line-clamp-3">{e.description}</div>
                  )}
                  <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-border text-xs text-muted-foreground mt-auto">
                    <span>
                      {e.current_rsvp_count != null && e.max_capacity
                        ? `${e.current_rsvp_count}/${e.max_capacity} RSVPs`
                        : e.current_rsvp_count != null
                          ? `${e.current_rsvp_count} RSVPs`
                          : e.invited_count
                            ? `${e.invited_count} invited`
                            : 'No RSVPs yet'}
                    </span>
                    <div className="flex">
                      {speakers.slice(0, 3).map((a, i) => (
                        <span key={a + i} className={cn(i > 0 && '-ml-1')}>
                          <Avatar initials={speakerInitials(a)} sm />
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {showCreate && <EventForm onClose={() => setShowCreate(false)} />}
      </Layout>
    </>
  );
}
