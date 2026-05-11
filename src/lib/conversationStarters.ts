/**
 * Conversation starter library — REOP-curated talk tracks for sphere outreach.
 *
 * Three channels (call / text / email), each with a small library of templates.
 * Templates support `{firstName}` interpolation. Email templates include a
 * subject line. Call templates are talking-point lists, not body copy — calls
 * aren't pre-filled, the agent just needs prompts on what to say.
 *
 * v1: hardcoded library. v2 can layer in Grok-generated personalization keyed
 * to the contact's category, life event, last touch, etc.
 */

export type Channel = 'call' | 'text' | 'email';

export interface CallStarter {
  id: string;
  title: string;          // short label for the card ("Reconnect with a warm sphere contact")
  context: string;        // one-line description of when to use this
  talkingPoints: string[]; // 3-5 short prompts
}

export interface TextStarter {
  id: string;
  title: string;
  context: string;
  body: string;           // pre-fill body with {firstName}
}

export interface EmailStarter {
  id: string;
  title: string;
  context: string;
  subject: string;
  body: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function interpolate(template: string, vars: { firstName?: string | null; lastName?: string | null }): string {
  const first = vars.firstName?.trim() || 'there';
  const last = vars.lastName?.trim() || '';
  return template
    .replaceAll('{firstName}', first)
    .replaceAll('{lastName}', last);
}

// ─── Call talking-point libraries ────────────────────────────────────────────

export const CALL_STARTERS: CallStarter[] = [
  {
    id: 'warm-checkin',
    title: 'Warm sphere check-in',
    context: 'Past client or sphere contact you haven\'t spoken to in 30+ days.',
    talkingPoints: [
      'Open with a personal observation — kids\' age, last vacation, last time you talked.',
      'Ask one open question about life or work — not real estate.',
      'If they mention a milestone or move, ask: "Is that something you\'re thinking about doing soon?"',
      'Close: "Who in your life is buying or selling this year?"',
    ],
  },
  {
    id: 'birthday-call',
    title: 'Birthday or anniversary',
    context: 'Their birthday, home-buying anniversary, or life event today.',
    talkingPoints: [
      'Wish them happy {occasion} — keep it under 30 seconds, no agenda.',
      'Ask one warm follow-up: how they\'re celebrating, who\'s with them.',
      'Mention you\'ll send a small gift or card — keeps the touch tangible.',
      'Don\'t pivot to business. The point is the relationship.',
    ],
  },
  {
    id: 'past-client-followup',
    title: 'Past-client follow-up',
    context: 'Closed in the last 12 months. Time for a quality check.',
    talkingPoints: [
      '"Hey {firstName}, just checking in — how\'s the house treating you?"',
      'Ask about anything they\'ve fixed, painted, or planned since closing.',
      'If they bring up neighbors or work — note it. Referrals start here.',
      'Close: "If you ever hear of someone thinking about a move, would you send them my way?"',
    ],
  },
  {
    id: 'lead-discovery',
    title: 'New lead discovery call',
    context: 'First conversation with a new lead — qualify warmly, no pitch.',
    talkingPoints: [
      'Confirm timeline: "When would you ideally want to be in your next home?"',
      'Confirm motivation: "What\'s driving the move?"',
      'Confirm financial readiness — pre-approval, cash, contingent.',
      'Listen for hesitation. Don\'t close hard. Schedule the next step.',
    ],
  },
  {
    id: 'price-watch',
    title: 'Market check-in',
    context: 'Contact watching prices in their area — keep them informed.',
    talkingPoints: [
      'Open with the headline number for their ZIP — median, days on market.',
      'Tie it to their goal: "If prices drop another 3%, does that change your timing?"',
      'Don\'t push urgency. Offer to send a saved-search update.',
      'Close: "Want me to keep flagging anything in your range?"',
    ],
  },
];

// ─── Text starter libraries ──────────────────────────────────────────────────

export const TEXT_STARTERS: TextStarter[] = [
  {
    id: 'warm-thinking',
    title: '"Thinking of you" check-in',
    context: 'Low-pressure way to restart a stale thread.',
    body: 'Hey {firstName}, happened to think of you today — how\'s everything going?',
  },
  {
    id: 'long-overdue',
    title: 'Long-overdue catch-up',
    context: 'Haven\'t touched base in months.',
    body: '{firstName}, long overdue catch-up. You and the family doing okay?',
  },
  {
    id: 'quick-hi',
    title: 'Quick hi',
    context: 'Light, no agenda — keeps you top of mind.',
    body: 'Hey {firstName}, just a quick hi. Anything fun on the horizon?',
  },
  {
    id: 'birthday-text',
    title: 'Birthday wish',
    context: 'Their birthday today.',
    body: 'Happy birthday {firstName}! Hope your day is full of good people and good food.',
  },
  {
    id: 'market-nudge',
    title: 'Market update nudge',
    context: 'They\'ve been watching their ZIP — prices moved.',
    body: 'Hey {firstName}, prices in your area shifted this month. Want me to send you the latest?',
  },
];

// ─── Email starter libraries ─────────────────────────────────────────────────

export const EMAIL_STARTERS: EmailStarter[] = [
  {
    id: 'warm-reconnect',
    title: 'Warm reconnect',
    context: 'Long-overdue check-in with a sphere contact.',
    subject: 'Long overdue catch-up',
    body: `Hey {firstName},

It's been a minute and you crossed my mind today — wanted to say hi and see how everything's going on your end. Family good? Work treating you well?

No agenda, just thinking about you. If there's anything I can do or if you ever want to grab coffee, you know where to find me.

Talk soon,`,
  },
  {
    id: 'past-client-anniversary',
    title: 'Home anniversary',
    context: 'Marks the date they closed on their home.',
    subject: 'Happy home anniversary, {firstName}!',
    body: `{firstName},

Hard to believe — it's already been a year (or more!) since we got you the keys to your place. Hope you're still loving it.

If anything ever comes up — projects you're tackling, neighborhood questions, or someone you know who's thinking about a move — I'm always here.

Cheers,`,
  },
  {
    id: 'market-update',
    title: 'Market update',
    context: 'Personalized market snapshot for their ZIP.',
    subject: 'Quick market update for your area',
    body: `Hey {firstName},

Wanted to send you a quick read on what's happening in your ZIP this month — prices, inventory, days on market — in case it's useful for what you're thinking about.

Let me know if you want the full report or want to talk through any of it.

Talk soon,`,
  },
  {
    id: 'referral-ask',
    title: 'Soft referral ask',
    context: 'After a positive interaction or close — keeps the loop open.',
    subject: 'A small favor, {firstName}',
    body: `{firstName},

Hope you're doing well. Quick favor: if you hear of anyone in your circle thinking about buying or selling this year, I'd appreciate the introduction. I take care of every referral like it's my only one.

Either way, glad to have you in my corner.

Thanks,`,
  },
  {
    id: 'event-invite',
    title: 'Event invite',
    context: 'Inviting them to a sphere event or open house.',
    subject: 'Saving you a seat',
    body: `Hey {firstName},

Hosting a small get-together — wanted to make sure you got the invite first. Details below — let me know if you can make it and I'll save you a spot.

[Add event details here]

Hope to see you there,`,
  },
];

// ─── URL builders ────────────────────────────────────────────────────────────

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function buildSmsUrl(phone: string, body: string): string {
  // iOS: sms:+15555551234&body=...   |   Android: sms:+15555551234?body=...
  // The `&body=` form works on both; `?` is rejected by some iOS versions.
  // Use platform-detect to pick the right separator.
  const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
  return `sms:${digitsOnly(phone)}${separator}body=${encodeURIComponent(body)}`;
}

export function buildMailtoUrl(email: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  // URLSearchParams encodes spaces as `+`; mailto wants `%20`.
  const query = params.toString().replaceAll('+', '%20');
  return `mailto:${email}?${query}`;
}

export function buildTelUrl(phone: string): string {
  return `tel:${digitsOnly(phone)}`;
}
