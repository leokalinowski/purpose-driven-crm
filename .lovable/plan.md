

# Visual Email Template Editor

## Problem

The current email template editors (both Global and Event-Specific) require editing raw HTML in a textarea. This is difficult for non-technical team members and error-prone.

## Solution

Replace the raw HTML textarea with a visual, block-based editor. The team edits structured sections using simple form fields, and the editor generates the HTML behind the scenes. Variables are inserted via clickable buttons -- no need to remember or type `{event_title}` manually.

## How It Works

The editor presents the email as a series of editable sections:

1. **Header Section** -- Toggle headshot and logo on/off (auto-populated from agent settings)
2. **Heading** -- A text input for the main headline (e.g., "RSVP Confirmed!")
3. **Body Paragraphs** -- Multiple text areas for the email body, with an "Add Paragraph" button. Each paragraph supports inserting variables via clickable chips.
4. **Event Details Card** -- Auto-included block showing date/time/location/description (always present, uses variables automatically)
5. **Host Info** -- Toggle agent name, team name, brokerage display
6. **Footer / Contact Info** -- Toggle which contact fields appear (phone, email, office, website)
7. **Colors** -- Primary and secondary color pickers (defaults from agent branding)

A row of **"Insert Variable" buttons** (chips/badges) sits above each text field. Clicking one inserts the variable at the cursor position. Variables include: Event Title, Event Date, Agent Name, etc.

The **Preview** tab remains and shows the fully rendered email exactly as before.

The editor stores the structured data as JSON internally, and converts it to the same HTML format on save -- so existing templates and the email sending pipeline are fully compatible with no backend changes.

## Technical Details

### New File: `src/components/events/email/VisualEmailEditor.tsx`

A new component that renders the block-based editor UI. It:
- Accepts the same props as the current editors (`emailType`, initial `htmlContent`, `subject`)
- Maintains state as a structured object (heading, paragraphs array, toggles for sections)
- Has a `toHtml()` function that generates the same HTML structure as `getDefaultEmailTemplate()` from `emailTemplateBuilder.ts`
- Includes an "Insert Variable" chip bar above text inputs with all available variables
- On first load, if existing HTML is detected, it falls back to a raw HTML mode with a banner saying "This template was created in HTML mode -- switch to Visual to start fresh or continue in HTML"
- Provides a toggle between "Visual" and "HTML" editing modes so power users can still access raw HTML if needed

### New File: `src/components/events/email/VariableInsertBar.tsx`

A small reusable component that renders clickable Badge buttons for each available variable. When clicked, inserts the `{variable_name}` text at the current cursor position in the associated text field.

Variables grouped by category:
- **Event**: event_title, event_date, event_time, event_location, event_description
- **Agent**: agent_name, agent_email, agent_phone, agent_office_number, agent_office_address, agent_website, agent_brokerage, agent_team_name
- **Branding**: primary_color, secondary_color, headshot_url, logo_colored_url, logo_white_url

### Modified Files

**`src/components/events/email/EmailTemplateEditor.tsx`**
- Replace the raw HTML textarea section with the new `VisualEmailEditor` component
- Keep the subject line input, active toggle, save button, and preview as-is
- The visual editor outputs `htmlContent` which flows into the same save logic

**`src/components/events/email/GlobalTemplateEditor.tsx`**
- Same changes as above -- replace HTML textarea with `VisualEmailEditor`

### No Backend/Database Changes

The visual editor generates the exact same HTML format. The hooks, edge functions, and email sending pipeline remain untouched.

