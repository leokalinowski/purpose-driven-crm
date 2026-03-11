

## First-Time Onboarding Experience for Core Users

### Approach

Create a dismissible onboarding overlay that appears on the dashboard for new users. It will use `localStorage` to track whether the user has completed or dismissed it. The experience is a multi-step guided walkthrough explaining every Core feature.

### Detection Logic

A user is "new" if they have no `onboarding_dismissed` flag in localStorage AND their dashboard data shows zero activity (0 contacts, 0 touchpoints, no scoreboard submission). This avoids any database changes.

### Components

| # | File | What |
|---|---|---|
| 1 | `src/components/onboarding/OnboardingWelcome.tsx` | New component: full onboarding experience with 7 steps |
| 2 | `src/pages/Index.tsx` | Import and render `OnboardingWelcome` conditionally when data is loaded and user appears new |

### OnboardingWelcome Component Design

A card-based stepper that sits at the top of the dashboard (not a modal -- non-blocking). Each step has a title, icon, description, and a CTA button linking to the relevant page. The user can navigate steps with Next/Back or dismiss entirely. Dismissing sets `localStorage.setItem('reop_onboarding_dismissed', 'true')`.

**Step 1 -- Welcome**
- "Welcome to the Hub!" with the user's first name
- Brief overview: "This is your command center for building and maintaining your real estate business through intentional relationship management."

**Step 2 -- Dashboard**
- Explains the 5 dashboard blocks: Weekly Impact (touchpoints across all systems), Weekly Tasks (what's due this week), Transaction Opportunity (your database's earning potential), Performance Trends (8-week completion chart), and Accountability Center (overdue tasks + score)
- "Everything here updates automatically as you complete tasks across the platform."

**Step 3 -- Database**
- "Your database is the foundation. Add your sphere of influence -- past clients, friends, family, colleagues. The platform generates personalized outreach tasks based on who's in your database."
- CTA: "Add Your First Contacts" -> `/database`
- Mentions the 500-contact limit for Core

**Step 4 -- SphereSync**
- "SphereSync is your weekly outreach engine. Each week, it assigns you calls and texts to specific contacts based on a rotating category system. Complete them to stay top-of-mind with your sphere."
- Explains: calls on specific days, texts mid-week, tasks auto-generate each Monday
- CTA: "View SphereSync Tasks" -> `/spheresync-tasks`

**Step 5 -- Success Scoreboard**
- "Every week, submit your Success Scoreboard to track conversations, sphere activations, appointments set, and database growth. Your goal: 25 conversations per week."
- Explains: the scoreboard feeds your dashboard metrics and builds your streak
- CTA: "Submit Your First Check-In" -> `/coaching`

**Step 6 -- E-Newsletter**
- "Send a monthly newsletter to your database to stay visible. Use the drag-and-drop builder to create branded emails with market updates, personal notes, and calls to action."
- CTA: "Explore Newsletter" -> `/newsletter`

**Step 7 -- Settings**
- "Complete your profile in Settings -- your name, brokerage, license info, and photo. This information is used in your newsletter templates and across the platform."
- CTA: "Complete Your Profile" -> `/settings`
- Final "Get Started!" button that dismisses the onboarding

### Integration in Index.tsx

After the dashboard header and before the dashboard blocks, conditionally render:

```
{showOnboarding && <OnboardingWelcome userName={profile?.first_name} onDismiss={dismissOnboarding} />}
```

The `showOnboarding` flag is `true` when:
- `localStorage.getItem('reop_onboarding_dismissed')` is NOT `'true'`
- Dashboard data is loaded
- Total touchpoints === 0 AND total contacts in blockThree === 0

This ensures returning users who already have data never see it, even if they never explicitly dismissed it.

