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
  { task_name: 'Secure and confirm venue',              phase: 'pre_event', days_offset: -30, responsible_person: 'Event Coordinator' },
  { task_name: 'Create event branding & theme',         phase: 'pre_event', days_offset: -28, responsible_person: 'Event Coordinator' },
  { task_name: 'Set up online registration / RSVP page',phase: 'pre_event', days_offset: -25, responsible_person: 'Event Coordinator' },
  { task_name: 'Design & send digital invitations',     phase: 'pre_event', days_offset: -21, responsible_person: 'Marketing' },
  { task_name: 'Finalize guest list',                   phase: 'pre_event', days_offset: -14, responsible_person: 'Event Coordinator' },
  { task_name: 'Confirm speakers / presenters',         phase: 'pre_event', days_offset: -14, responsible_person: 'Event Coordinator' },
  { task_name: 'Order promotional materials & signage', phase: 'pre_event', days_offset: -14, responsible_person: 'Marketing' },
  { task_name: 'Arrange catering / refreshments',       phase: 'pre_event', days_offset: -10, responsible_person: 'Event Coordinator' },
  { task_name: 'Send reminder emails to attendees',     phase: 'pre_event', days_offset: -7,  responsible_person: 'Marketing' },
  { task_name: 'Confirm vendor & supplier arrangements',phase: 'pre_event', days_offset: -7,  responsible_person: 'Event Coordinator' },
  { task_name: 'Prepare presentation / agenda',         phase: 'pre_event', days_offset: -5,  responsible_person: 'Event Coordinator' },
  { task_name: 'Verify final headcount',                phase: 'pre_event', days_offset: -3,  responsible_person: 'Event Coordinator' },
  { task_name: 'Print name tags & check-in materials',  phase: 'pre_event', days_offset: -2,  responsible_person: 'Event Coordinator' },

  // ── Event Day ──────────────────────────────────────────
  { task_name: 'Set up venue & signage',                phase: 'event_day', days_offset: 0,   responsible_person: 'Event Coordinator' },
  { task_name: 'Test A/V equipment',                    phase: 'event_day', days_offset: 0,   responsible_person: 'Event Coordinator' },
  { task_name: 'Manage check-in / registration desk',   phase: 'event_day', days_offset: 0,   responsible_person: 'Event Coordinator' },
  { task_name: 'Take event photos & videos',            phase: 'event_day', days_offset: 0,   responsible_person: 'Marketing' },

  // ── Post-Event ─────────────────────────────────────────
  { task_name: 'Send thank-you emails to attendees',    phase: 'post_event', days_offset: 2,  responsible_person: 'Marketing' },
  { task_name: 'Follow up with leads generated',        phase: 'post_event', days_offset: 3,  responsible_person: 'Event Coordinator' },
  { task_name: 'Post event recap on social media',      phase: 'post_event', days_offset: 3,  responsible_person: 'Marketing' },
  { task_name: 'Collect & review feedback / surveys',   phase: 'post_event', days_offset: 5,  responsible_person: 'Event Coordinator' },
  { task_name: 'Compile final attendance & metrics',    phase: 'post_event', days_offset: 7,  responsible_person: 'Event Coordinator' },
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
