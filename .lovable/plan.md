

# Text Block Line Breaks + Brand Colors + Compliant Agent Bio

## Three Issues to Fix

### 1. Text Block Doesn't Interpret Line Breaks

**Problem**: The Text block uses a `<Textarea>` for input (line 84 of BlockSettings), storing content in `props.html`. When the user types multiple lines, the textarea captures `\n` characters, but both the canvas preview (`dangerouslySetInnerHTML`) and the email renderer output the raw HTML string without converting newlines to `<br>` tags. The result: all lines collapse into a single paragraph.

**Fix**: In both `BlockRenderer.tsx` (canvas preview) and `renderBlocksToHtml.ts` (email output), convert `\n` to `<br />` in the text block's `html` content before rendering. This should only apply when the content doesn't already contain HTML block tags (`<p>`, `<div>`, `<br>`), so existing rich HTML content isn't double-processed.

**Files**:
- `BlockSettings.tsx` -- no change needed (textarea is fine)
- `BlockRenderer.tsx` -- in the `text` case, process `block.props.html` through a `convertNewlines()` helper before passing to `dangerouslySetInnerHTML`
- `renderBlocksToHtml.ts` -- in `renderText()`, apply the same `convertNewlines()` before outputting

### 2. Templates Should Pull Agent's Brand Colors

**Problem**: The `profiles` table already stores `primary_color` and `secondary_color` per agent. The builder currently uses hardcoded defaults for button colors, heading colors, etc. The system should fetch the agent's brand colors on builder load and apply them as defaults.

**Fix**: In `NewsletterBuilder.tsx`, fetch the logged-in agent's profile (`primary_color`, `secondary_color`) from the `profiles` table on mount. Store these as `brandColors`. When creating **new** templates (no `templateId`), override `DEFAULT_GLOBAL_STYLES.bodyColor` with the primary color, and update `BLOCK_DEFAULTS` usage so new button blocks use the primary color as their `backgroundColor`. Pass `brandColors` down to `BuilderCanvas` or store in context so `BlockPalette` drag-drop can use them when creating new blocks.

Specifically:
- Fetch `primary_color`, `secondary_color` from `profiles` where `user_id = user.id`
- Store in state: `brandColors: { primary: string | null, secondary: string | null }`
- When adding a new block, if it's a `button`, set `backgroundColor` to `primary_color` (if available)
- When adding a new block, if it's a `heading`, set `color` to `primary_color` (if available)
- Pass brand colors to `BlockSettings` so the color pickers show the brand colors as quick-select options
- Add a small "Use brand color" chip next to color pickers that applies the agent's primary/secondary color with one click

**Files**:
- `NewsletterBuilder.tsx` -- fetch brand colors on mount, pass to child components
- `BuilderCanvas.tsx` -- accept `brandColors` and apply to new blocks when dropped from palette
- `BlockSettings.tsx` -- accept `brandColors` prop, show quick-select chips next to color pickers

### 3. Agent Bio Block Needs Real Estate Compliance Fields

**Problem**: The current `AgentBioProps` only has layout and toggle switches for headshot/logo/phone/email. Real estate regulations require newsletters to include:
- Agent full name with REALTOR designation
- License number(s) and state(s)
- Brokerage name and info
- Office address
- Office phone number
- Website
- Privacy policy link (CAN-SPAM)
- Equal Housing logo/text

All these fields already exist in the `profiles` table. The agent bio block should be enhanced to show all compliance-required info and auto-populate from the profile.

**Data Model Changes** in `types.ts`:
```typescript
export interface AgentBioProps {
  layout: 'horizontal' | 'vertical';
  showHeadshot: boolean;
  showLogo: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showLicense: boolean;       // NEW
  showBrokerage: boolean;     // NEW
  showOfficeAddress: boolean; // NEW
  showOfficePhone: boolean;   // NEW
  showWebsite: boolean;       // NEW
  showEqualHousing: boolean;  // NEW
}
```

Update `BLOCK_DEFAULTS.agent_bio` to default all new fields to `true`.

**Settings Panel** (`BlockSettings.tsx`): Add toggle switches for the new fields (license, brokerage, office address, office phone, website, equal housing). Group them under a "Compliance" label.

**Canvas Preview** (`BlockRenderer.tsx`): Show a more detailed preview that lists which compliance fields are enabled, making it clear what will appear at send time.

**Email HTML** (`renderBlocksToHtml.ts`): Update `renderAgentBio()` to output a structured compliance block. At build time this still shows placeholder text (actual data is injected at send time by the `newsletter-send` function). But the placeholder should enumerate all the fields that will appear.

**Send Function** (`newsletter-send/index.ts`): The `generateStandardFooter` already includes most compliance fields. The agent_bio block in the template should trigger rendering the agent's profile data inline (not just in the footer). Need to update the send function to:
1. Fetch the template's `blocks_json`
2. Find any `agent_bio` block
3. Replace it with rendered agent profile HTML using `profiles` data (headshot, name, license, brokerage, etc.)
4. Include Equal Housing Opportunity text/logo when enabled

**Files to modify**:
| File | Change |
|---|---|
| `src/components/newsletter/builder/types.ts` | Add new boolean fields to `AgentBioProps`, update defaults |
| `src/components/newsletter/builder/BlockSettings.tsx` | Add compliance toggle switches to agent_bio settings |
| `src/components/newsletter/builder/BlockRenderer.tsx` | Enhanced canvas preview showing compliance field list |
| `src/components/newsletter/builder/renderBlocksToHtml.ts` | Updated placeholder HTML listing compliance fields |
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Fetch brand colors from profiles table |
| `src/components/newsletter/builder/BuilderCanvas.tsx` | Accept brandColors, apply to new blocks |

## Technical Details

### Newline Conversion Helper

```typescript
function convertNewlines(html: string): string {
  // If content already has HTML block tags, leave it alone
  if (/<(p|div|br|ul|ol|li|h[1-6])\b/i.test(html)) {
    return html;
  }
  return html.replace(/\n/g, '<br />');
}
```

### Brand Colors Fetch

```typescript
// In NewsletterBuilder, on mount:
const { data: profile } = await supabase
  .from('profiles')
  .select('primary_color, secondary_color')
  .eq('user_id', user.id)
  .single();
```

### Agent Bio Compliance Preview (Canvas)

Shows a card with checkmarks for each enabled compliance field:
- Name + REALTOR
- License #
- Brokerage
- Office Address
- Phone / Office Phone / Email / Website
- Equal Housing Opportunity

### Equal Housing Text

When `showEqualHousing` is true, the email HTML renders:
```
Equal Housing Opportunity. Each office independently owned and operated.
```

