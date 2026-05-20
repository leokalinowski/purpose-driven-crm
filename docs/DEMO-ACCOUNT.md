# Demo account — sales walkthrough

A fully-seeded agent account for the sales process. Every live surface of
the Hub has realistic data so a prospect sees the product *working*, not
empty.

## The account

| | |
|---|---|
| **Login** | `demo@realestateonpurpose.com` |
| **Password** | set at signup (ask Leo / the sales lead) |
| **Agent** | "Jordan Rivera" — Rivera Property Group, Keller Williams Realty, Cleveland OH |
| **user_id** | `8e395af3-1a6a-4b6f-a689-e6ee65a77908` |
| **Role** | `agent` |

The sphere is **famous fictional characters** — Tony Stark, Harry Potter,
Gandalf, James Bond, Katniss Everdeen, etc. — so the audience instantly
recognizes the names and isn't distracted parsing real-looking strangers.

## What's seeded

| Surface | Data |
|---|---|
| Database / Contacts | 36 contacts, spread A–Z (drives the SphereSync rotation), 4 DNC-flagged, varied last-touch dates |
| Pipeline | 13 opportunities — at least one in **every** stage (conversation_active → closed, plus a lost one and a referral) |
| SphereSync | This week's call/text tasks, 4 already completed; Priorities tab shows ~7 (pipeline + cadence); Cadence tab always has matches |
| Scoreboard / Coaching | 8 consecutive weeks of check-ins (8-week streak), 4 growth goals, annual GCI / closings / conversations goals |
| Delight | ~7 contacts with birthdays / anniversaries inside the next two weeks |
| Events | "Summer Client Appreciation — Backyard BBQ" — published, public RSVP page, 9 RSVPs |
| AI Coach | `compute-priority-scores` has run (priority bands populated). For the Coach's per-contact take, click **Refresh** on the Coach bar in the SphereSync Priorities tab once after first login — it generates live (a nice demo moment in itself) |
| Settings | Full brand/marketing settings (colors, voice, signature) |

## Resetting the demo

The seed is **idempotent**. After a messy demo, re-run it and the account
returns to a pristine state:

```
Apply scripts/seed-demo-account.sql  (Supabase SQL editor / MCP / psql)
then re-run compute-priority-scores + ai-coach-agent for the demo agent.
```

Time-relative data (this week's tasks, the 8-week coaching streak, recent
activity) re-anchors to `CURRENT_DATE` on every run — the demo never goes
stale, even months later.

## Suggested walkthrough order

1. **Dashboard (`/`)** — the daily command center. KPIs, call streak, sphere
   touches this week, recent activity.
2. **SphereSync (`/spheresync-tasks`)** — the core loop. Priorities tab (who
   to contact and why), Cadence tab (the letter rotation), this week's tasks.
   Tip: click **Refresh** on the Coach bar to generate the AI Coach's take live.
3. **Pipeline (`/pipeline`)** — drag a card between stages. 13 deals across
   every stage; open the drawer on one to show the detail + AI Coach pane.
4. **Database (`/database`)** — the full sphere. Search, the SphereSync
   filter rail, a contact's Quick Sheet.
5. **Scoreboard (`/scoreboard`)** — accountability. 8-week streak, the weekly
   check-in modal, annual goals trajectory.
6. **Delight (`/delight`)** — upcoming birthdays/anniversaries → gifting.
7. **Events (`/events`)** — the BBQ event; show the public RSVP page at
   `/event/rivera-summer-bbq-demo`.
8. **Settings (`/settings`)** — brand, AI voice, and the data-export tools.

## Caveats / known notes

- **It lives in the production database.** A sales demo has to show the live
  product. The demo agent's numbers therefore appear in company-wide admin
  rollups — if that ever skews real metrics noticeably, exclude
  `agent_id = 8e395af3-…` from admin aggregate queries (follow-up, not done).
- **The crons treat it as a real agent** — SphereSync emails, coaching
  reminders, and Delight nudges all fire to `demo@realestateonpurpose.com`.
  That's intentional: those emails become demo assets ("here's the weekly
  email agents get"). Point that inbox somewhere the team controls.
- **Priority bands** — the live `compute-priority-scores` scorer placed 3 of
  the ~7 early-stage pipeline opportunities into the `pipeline` band (the
  rest of the early-stage opps did not land in a band). This is the scorer's
  real output and affects all agents, not just the demo — worth a separate
  look at whether `conversation_active` opportunities should band.
