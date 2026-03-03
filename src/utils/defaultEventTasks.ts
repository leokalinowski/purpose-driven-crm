export type TaskPhase = 'pre_event' | 'event_day' | 'post_event';

export interface DefaultTaskTemplate {
  task_name: string;
  phase: TaskPhase;
  /** Negative = days before event, positive = days after */
  days_offset: number;
  responsible_person: string;
}

export const DEFAULT_EVENT_TASKS: DefaultTaskTemplate[] = [
  // ── Pre-Event ──────────────────────────────────────────
  { task_name: 'Confirm Event Theme & Date',               phase: 'pre_event', days_offset: -60, responsible_person: 'Event Coordinator' },
  { task_name: 'Request Speaker & Sponsor Commitments',    phase: 'pre_event', days_offset: -55, responsible_person: 'Event Coordinator' },
  { task_name: 'Confirm charity',                          phase: 'pre_event', days_offset: -50, responsible_person: 'Event Coordinator' },
  { task_name: 'Draft Event Budget',                       phase: 'pre_event', days_offset: -50, responsible_person: 'Event Coordinator' },
  { task_name: 'Test hub RSVP',                            phase: 'pre_event', days_offset: -45, responsible_person: 'Event Coordinator' },
  { task_name: 'Export Database from Hub',                  phase: 'pre_event', days_offset: -45, responsible_person: 'Event Coordinator' },
  { task_name: 'Create Facebook & LinkedIn Events',        phase: 'pre_event', days_offset: -42, responsible_person: 'Marketing' },
  { task_name: 'Update Promo Kit for Sponsors',            phase: 'pre_event', days_offset: -40, responsible_person: 'Marketing' },
  { task_name: 'Send Save-the-Date Email',                 phase: 'pre_event', days_offset: -38, responsible_person: 'Marketing' },
  { task_name: 'Post Save-the-Date on Social',             phase: 'pre_event', days_offset: -38, responsible_person: 'Marketing' },
  { task_name: 'Personalize postcard to mail',             phase: 'pre_event', days_offset: -35, responsible_person: 'Event Coordinator' },
  { task_name: 'Finalize Vendor Selections',               phase: 'pre_event', days_offset: -30, responsible_person: 'Event Coordinator' },
  { task_name: 'Email #1 Formal Invite',                   phase: 'pre_event', days_offset: -28, responsible_person: 'Marketing' },
  { task_name: 'SMS Nudge #1',                             phase: 'pre_event', days_offset: -25, responsible_person: 'Marketing' },
  { task_name: 'Email #2 15-Day Reminder',                 phase: 'pre_event', days_offset: -15, responsible_person: 'Marketing' },
  { task_name: 'Mail invite to Sphere',                    phase: 'pre_event', days_offset: -15, responsible_person: 'Event Coordinator' },
  { task_name: 'Social Content Schedule',                  phase: 'pre_event', days_offset: -14, responsible_person: 'Marketing' },
  { task_name: 'Check RSVP Progress',                      phase: 'pre_event', days_offset: -12, responsible_person: 'Event Coordinator' },
  { task_name: 'Agent Call/Text Round #1',                  phase: 'pre_event', days_offset: -10, responsible_person: 'Event Coordinator' },
  { task_name: 'Check RSVP Progress #2',                   phase: 'pre_event', days_offset: -8,  responsible_person: 'Event Coordinator' },
  { task_name: 'Email #3 One-Week Reminder',               phase: 'pre_event', days_offset: -7,  responsible_person: 'Marketing' },
  { task_name: 'SMS Nudge #2',                             phase: 'pre_event', days_offset: -6,  responsible_person: 'Marketing' },
  { task_name: 'Check RSVP Progress #3',                   phase: 'pre_event', days_offset: -5,  responsible_person: 'Event Coordinator' },
  { task_name: 'Confirm Catering Headcount',               phase: 'pre_event', days_offset: -5,  responsible_person: 'Event Coordinator' },
  { task_name: 'Charity Delivery Prep',                    phase: 'pre_event', days_offset: -4,  responsible_person: 'Event Coordinator' },
  { task_name: 'Confirm sponsors',                         phase: 'pre_event', days_offset: -4,  responsible_person: 'Event Coordinator' },
  { task_name: 'Day-Of Kit - remind agent',                phase: 'pre_event', days_offset: -3,  responsible_person: 'Event Coordinator' },
  { task_name: 'Confirm Event Type',                       phase: 'pre_event', days_offset: -3,  responsible_person: 'Event Coordinator' },
  { task_name: 'Confirm Venue',                            phase: 'pre_event', days_offset: -3,  responsible_person: 'Event Coordinator' },
  { task_name: 'Gate check: Venue + Owner confirmed',      phase: 'pre_event', days_offset: -2,  responsible_person: 'Event Coordinator' },
  { task_name: 'Send Check-in list to print',              phase: 'pre_event', days_offset: -2,  responsible_person: 'Event Coordinator' },
  { task_name: 'Remind Sponsors',                          phase: 'pre_event', days_offset: -1,  responsible_person: 'Event Coordinator' },
];

/**
 * Calculate concrete due dates from a template given an event date.
 */
export function buildTaskInserts(
  eventId: string,
  agentId: string,
  eventDate: Date,
) {
  return DEFAULT_EVENT_TASKS.map((t) => {
    const due = new Date(eventDate);
    due.setDate(due.getDate() + t.days_offset);
    return {
      event_id: eventId,
      agent_id: agentId,
      task_name: t.task_name,
      phase: t.phase,
      responsible_person: t.responsible_person,
      due_date: due.toISOString().split('T')[0],
      status: 'pending' as const,
    };
  });
}
