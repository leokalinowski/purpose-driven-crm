

## Implementation Plan: Add Rolling Audit Section to SphereSync Email

### Overview
Add the "Rolling Audit Directive" section with communication frameworks to the weekly SphereSync email, placed strategically after the task summary and before the Conversation Starters section.

---

### Content Placement Strategy

The email will flow in this order:
1. **Header** - Greeting and week info
2. **Call Tasks** - Green section with contacts to call
3. **Text Tasks** - Red section with contacts to text
4. **Summary Box** - Task counts
5. **NEW: Rolling Audit Directive** - Yellow/orange section (prominent call to action)
6. **NEW: Communication Frameworks** - Purple/blue section with scripts
7. **Conversation Starters** - Blue section (existing, moves down)
8. **Footer** - Closing instructions

---

### Custom Variables for the New Content

The `[Insert Letters]` placeholder will be replaced dynamically with the actual letters for this week:

**For Call Letters**: Pulls from `SPHERESYNC_CALLS[weekNumber]` (e.g., "S and Q" for week 1)
**For Text Letter**: Pulls from `SPHERESYNC_TEXTS[weekNumber]` (e.g., "M" for week 1)

The `[Your Name]` and `[Name]` placeholders in the scripts are kept as-is since they're instructional templates.

---

### File Changes

**Modified File:**
`supabase/functions/spheresync-email-function/index.ts`

---

### HTML Content Structure

**Section 1: Rolling Audit Directive**

```text
Style: Orange/yellow accent card
Placement: After task summary box (line ~485)

Content:
- Header: "THE ROLLING AUDIT Directive"
- Subheader: Stop waiting for a "perfect" database...
- STEP 1: VERIFY (The Scan) - with this week's letters inserted
- STEP 2: CAPTURE (The Comparison)
- STEP 3: INTEGRATE (The Outreach)
```

**Section 2: Communication Frameworks**

```text
Style: Purple accent card (distinct from conversation starters)
Placement: Directly after Rolling Audit

Content:
- Header: "COMMUNICATION FRAMEWORKS: DORMANT TIES"
- OPTION A: The Professional Update (For Clients/Colleagues)
- OPTION B: The Human Element (For Friends/Acquaintances)
- DM/Text Option
```

---

### Dynamic Variable Injection

The edge function will compute and inject:

```javascript
// Get this week's letters
const callLetters = SPHERESYNC_CALLS[targetWeek] || [];
const textLetter = SPHERESYNC_TEXTS[targetWeek] || '';

// Format for display: "S, Q (calls) and M (texts)"
const allLetters = [...callLetters, textLetter].filter(Boolean);
const lettersDisplay = callLetters.length > 0 && textLetter 
  ? `${callLetters.join(', ')} (calls) and ${textLetter} (texts)`
  : allLetters.join(', ');
```

This ensures every email automatically shows the correct letters for that specific week.

---

### Plain Text Version

The plain text email will include simplified versions:

```text
THE ROLLING AUDIT DIRECTIVE
================================
Stop waiting for a "perfect" database. Build it while you move.

STEP 1: VERIFY (The Scan)
Open your mobile phone contacts and social media friend lists.
Scroll specifically to the letters for this week: S, Q (calls) and M (texts)

STEP 2: CAPTURE (The Comparison)
Compare your phone/social lists against the SphereSync Rotation below.
Who is missing from your system?
Who have you met recently that you forgot to input?
Action: Add these individuals to your CRM immediately.

STEP 3: INTEGRATE (The Outreach)
Do not wait 12 weeks to speak with them...

COMMUNICATION FRAMEWORKS: DORMANT TIES
=======================================
OPTION A: The Professional Update
"Hello [Name], it's [Your Name]..."

OPTION B: The Human Element
"Hey [Name], it's [Your Name]..."

DM/Text Option:
"Hi [Name] – hope you're well..."
```

---

### Visual Design (HTML)

**Rolling Audit Section:**
- Background: Light orange (`#fff7ed`)
- Border-left: Orange (`#f97316`)
- Icons: Clipboard, Search, Target emojis

**Communication Frameworks Section:**
- Background: Light purple (`#faf5ff`)
- Border-left: Purple (`#9333ea`)
- Subsections: Each option in a slightly different shade

---

### Implementation Steps

1. Add `SPHERESYNC_CALLS` and `SPHERESYNC_TEXTS` constants to the edge function (if not already present)
2. Compute the `lettersDisplay` variable using the target week
3. Insert Rolling Audit HTML section after the summary box (around line 485)
4. Insert Communication Frameworks HTML section after Rolling Audit
5. Keep existing Conversation Starters section (it moves down)
6. Update plain text version with same content structure
7. Deploy and test with a sample email

---

### Example Output

For **Week 5** the email would show:

> **THE ROLLING AUDIT Directive**
> 
> Stop waiting for a "perfect" database. Build it while you move.
>
> **STEP 1: VERIFY (The Scan)**
> Open your mobile phone contacts and social media friend lists.
> Scroll specifically to the letters for this week: **H, U (calls) and W (texts)**

