/**
 * EventDetail — full-page detail view at /events/:id.
 *
 * Phase 1 of the Events comprehensive sweep. The previous version was a
 * 715-line page rendering MOCK DATA ("Jordan's Open House" with fake
 * attendees) — the route was wired but `useParams` was never read and
 * nothing connected to the real DB. This rewrite:
 *
 *   - Reads the route param and finds the event in the agent's pipeline
 *   - Auth-gated like Pipeline.tsx
 *   - 4 tabs (Overview · Tasks · RSVPs · Emails) reusing existing components:
 *       SelfManagedTaskDashboard, RSVPManagement, EmailManagement
 *   - Token-driven styling matching Pipeline / SphereSync / Database
 *
 * The Overview tab is the only bespoke surface — it summarizes the event
 * (date, location, branding, RSVP totals, share link) and exposes the
 * primary actions (Edit, View public page, Open Calendar). Everything else
 * is delegated to the existing reusable subsection components.
 */

import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format, parseISO, isPast, isToday } from 'date-fns';
import {
  ArrowLeft, Calendar, Clock, MapPin, Users, Pencil, ExternalLink,
  CheckSquare, Mail, FileText, Share2, AlertCircle, Sparkles,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { EventForm } from '@/components/events/EventForm';
import { EventTasksPanel } from '@/components/events/EventTasksPanel';
import { EventRSVPsPanel } from '@/components/events/EventRSVPsPanel';
import { EventEmailsPanel } from '@/components/events/EventEmailsPanel';
import { cn } from '@/lib/utils';

type TabKey = 'overview' | 'tasks' | 'rsvps' | 'emails';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { events, tasks, loading: eventsLoading } = useEvents();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');

  const event = useMemo(() => events.find(e => e.id === id), [events, id]);

  // Tasks for this event only — used by the Overview header strip + the
  // "Tasks" tab. Already filtered to agent_id by the hook.
  const eventTasks = useMemo(() => tasks.filter(t => t.event_id === id), [tasks, id]);

  const taskStats = useMemo(() => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    let done = 0, overdue = 0, todo = 0;
    for (const t of eventTasks) {
      if (t.status === 'completed' || t.completed_at) {
        done++;
      } else if (t.due_date && new Date(t.due_date) < todayMidnight) {
        overdue++;
      } else {
        todo++;
      }
    }
    return { done, overdue, todo, total: eventTasks.length };
  }, [eventTasks]);

  // ── Auth gate ─────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <>
        <Helmet><title>Event — Real Estate on Purpose</title></Helmet>
        <Layout>
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            Loading event…
          </div>
        </Layout>
      </>
    );
  }
  if (!user) {
    return (
      <>
        <Helmet><title>Event — Real Estate on Purpose</title></Helmet>
        <Layout>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm">Please sign in to view this event.</p>
          </div>
        </Layout>
      </>
    );
  }

  // ── Loading / not-found ────────────────────────────────────────────────
  if (eventsLoading && !event) {
    return (
      <>
        <Helmet><title>Event — Real Estate on Purpose</title></Helmet>
        <Layout>
          <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
            Loading event…
          </div>
        </Layout>
      </>
    );
  }
  if (!event) {
    return (
      <>
        <Helmet><title>Event not found — Real Estate on Purpose</title></Helmet>
        <Layout>
          <div className="bg-card border border-border rounded-lg p-8 max-w-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-base font-semibold mb-1.5">Event not found</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  This event doesn't exist or you don't have access to it. It may have been deleted.
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/events')} className="gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to all events
                </Button>
              </div>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  const eventDate = parseISO(event.event_date);
  const isUpcoming = !isPast(eventDate) || isToday(eventDate);
  const publicUrl = event.public_slug ? `${window.location.origin}/event/${event.public_slug}` : null;
  const rsvpCount = event.current_rsvp_count ?? 0;
  const capacity = event.max_capacity ?? null;

  return (
    <>
      <Helmet><title>{event.title} — Real Estate on Purpose</title></Helmet>
      <Layout>
        {/* Breadcrumb / back */}
        <div className="mb-4">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-3 h-3" />
            All events
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6 md:mb-7">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="eye-label">{isUpcoming ? 'Upcoming event' : 'Past event'}</span>
              {event.is_published ? (
                <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-reop-teal-soft text-primary">
                  Published
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Draft
                </span>
              )}
            </div>
            <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-medium tracking-tighter leading-[1.15] mb-1.5">
              {event.title}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {format(eventDate, 'EEE, MMM d, yyyy')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {format(eventDate, 'h:mm a')}
              </span>
              {event.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {event.location}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {publicUrl && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Public page
                </a>
              </Button>
            )}
            <Button onClick={() => setEditing(true)} size="sm" className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Edit event
            </Button>
          </div>
        </div>

        {/* Quick stats strip — single source of truth for the at-a-glance health
            of this event. Mirrors the Pipeline metrics strip pattern. */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatTile
            label="RSVPs"
            value={capacity ? `${rsvpCount} / ${capacity}` : `${rsvpCount}`}
            sub={capacity && rsvpCount >= capacity ? 'At capacity' : 'Confirmed responses'}
            tone="primary"
          />
          <StatTile
            label="Tasks done"
            value={`${taskStats.done} / ${taskStats.total}`}
            sub={taskStats.total === 0 ? 'No tasks yet' : 'Across all phases'}
            tone="ok"
          />
          <StatTile
            label="Overdue"
            value={`${taskStats.overdue}`}
            sub={taskStats.overdue === 0 ? 'On track' : 'Need attention'}
            tone={taskStats.overdue > 0 ? 'warn' : 'muted'}
          />
          <StatTile
            label="To do"
            value={`${taskStats.todo}`}
            sub={taskStats.todo === 0 && taskStats.total > 0 ? 'All caught up' : 'Open tasks'}
            tone="muted"
          />
        </section>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full md:w-auto md:inline-grid bg-muted/60">
            <TabsTrigger value="overview" className="text-xs md:text-sm gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs md:text-sm gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              Tasks
              {taskStats.overdue > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-100 text-red-700 text-[9px] font-semibold">
                  {taskStats.overdue}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rsvps" className="text-xs md:text-sm gap-1.5">
              <Users className="w-3.5 h-3.5" />
              RSVPs
            </TabsTrigger>
            <TabsTrigger value="emails" className="text-xs md:text-sm gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Emails
            </TabsTrigger>
          </TabsList>

          {/* ── Overview ─────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-5 mt-0">
            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
              {/* Description + branding */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    About this event
                  </h3>
                  {event.description ? (
                    <p className="text-sm leading-relaxed whitespace-pre-line">{event.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No description yet. Click <span className="font-medium">Edit event</span> to add one — guests see this on the public RSVP page.
                    </p>
                  )}
                </div>

                {(event.theme || event.event_type || event.quarter) && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    {event.event_type && <Pill label="Type" value={event.event_type} />}
                    {event.theme && <Pill label="Theme" value={event.theme} />}
                    {event.quarter && <Pill label="Quarter" value={event.quarter} />}
                  </div>
                )}

                {event.header_image_url && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Header image
                    </h3>
                    <div
                      className="aspect-[16/8] rounded-lg border border-border bg-muted"
                      style={{ background: `url(${event.header_image_url}) center/cover` }}
                      role="img"
                      aria-label="Event header image"
                    />
                  </div>
                )}
              </div>

              {/* Sharing + Coach nudge */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Public RSVP link
                  </h3>
                  {publicUrl ? (
                    <>
                      <div className="bg-muted/60 rounded-lg p-2.5 mb-3 break-all text-xs font-mono text-foreground">
                        {publicUrl}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 flex-1"
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl).catch(() => {});
                          }}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Copy link
                        </Button>
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a href={publicUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground space-y-3">
                      <p>This event isn't published yet — guests can't RSVP.</p>
                      <Button onClick={() => setEditing(true)} variant="outline" size="sm" className="gap-1.5 w-full">
                        <Pencil className="w-3.5 h-3.5" />
                        Edit & publish
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-reop-teal-soft border border-[hsl(184_50%_85%)] rounded-xl p-5">
                  <div className="flex gap-2.5 items-start">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <b className="block text-sm font-semibold mb-1">Coach nudge</b>
                      <p className="m-0 text-[12.5px] text-reop-dark-blue leading-[1.5]">
                        {coachNudgeFor({ taskStats, isUpcoming, hasPublicUrl: !!publicUrl, rsvpCount })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Tasks ────────────────────────────────────────────────── */}
          <TabsContent value="tasks" className="mt-0">
            <EventTasksPanel event={event} />
          </TabsContent>

          {/* ── RSVPs ────────────────────────────────────────────────── */}
          <TabsContent value="rsvps" className="mt-0">
            <EventRSVPsPanel
              eventId={event.id}
              publicSlug={event.public_slug}
              maxCapacity={event.max_capacity}
            />
          </TabsContent>

          {/* ── Emails ───────────────────────────────────────────────── */}
          <TabsContent value="emails" className="mt-0">
            <EventEmailsPanel eventId={event.id} eventTitle={event.title} />
          </TabsContent>
        </Tabs>

        {editing && (
          <EventForm
            event={event}
            onClose={() => setEditing(false)}
          />
        )}
      </Layout>
    </>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────

type StatTone = 'primary' | 'ok' | 'warn' | 'muted';

const STAT_TONES: Record<StatTone, { value: string; sub: string; ring: string }> = {
  primary: { value: 'text-primary',         sub: 'text-muted-foreground', ring: 'border-l-primary' },
  ok:      { value: 'text-reop-green',      sub: 'text-muted-foreground', ring: 'border-l-reop-green' },
  warn:    { value: 'text-amber-700',       sub: 'text-amber-700/80',     ring: 'border-l-amber-500' },
  muted:   { value: 'text-foreground',      sub: 'text-muted-foreground', ring: 'border-l-border' },
};

function StatTile({
  label, value, sub, tone,
}: { label: string; value: string; sub: string; tone: StatTone }) {
  const t = STAT_TONES[tone];
  return (
    <div className={cn('bg-card border border-border rounded-xl p-4 border-l-[3px]', t.ring)}>
      <div className="text-[10.5px] uppercase tracking-[0.05em] font-semibold text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className={cn('text-[22px] sm:text-[24px] font-semibold leading-none -tracking-[0.02em]', t.value)}>
        {value}
      </div>
      <div className={cn('text-[12px] mt-1.5', t.sub)}>{sub}</div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-muted/70 text-foreground">
      <span className="text-muted-foreground uppercase tracking-wide text-[9px]">{label}</span>
      <span className="font-semibold capitalize">{value.replace(/_/g, ' ')}</span>
    </span>
  );
}

function coachNudgeFor({
  taskStats, isUpcoming, hasPublicUrl, rsvpCount,
}: {
  taskStats: { done: number; overdue: number; todo: number; total: number };
  isUpcoming: boolean;
  hasPublicUrl: boolean;
  rsvpCount: number;
}): string {
  if (!hasPublicUrl) {
    return 'Publish this event to generate the public RSVP page — guests need a link to respond.';
  }
  if (taskStats.overdue > 0) {
    return `${taskStats.overdue} overdue task${taskStats.overdue > 1 ? 's' : ''}. Knock those out first — they're usually venue, catering, or invite-list deadlines.`;
  }
  if (isUpcoming && rsvpCount === 0) {
    return 'No RSVPs yet. Send the invite blast or share the public link with your sphere — momentum builds when the first 5 confirm.';
  }
  if (isUpcoming && taskStats.todo > 0) {
    return `${taskStats.todo} task${taskStats.todo > 1 ? 's' : ''} remaining. Stay ahead — day-of feels effortless when the checklist is closed by the morning of.`;
  }
  if (!isUpcoming) {
    return 'Past event — capture takeaways in the description and send the thank-you email. Then plan the next one.';
  }
  return 'On track. Keep checking off tasks as they come due.';
}
