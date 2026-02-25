

# Fix Preview Placeholders, Listings Design, and Mobile Column Stacking

## Three Issues

### 1. Agent Bio Shows Raw Placeholders Instead of Real Data

**Problem**: `renderBlocksToHtml` outputs `{{agent_name}}`, `{{agent_license}}`, etc. as literal text. The `PreviewPanel` calls this same function, so the preview shows raw placeholders instead of the agent's actual data.

**Fix**: 
- In `NewsletterBuilder.tsx`, fetch the agent's full profile from the `profiles` table (name, email, phone, office, license, brokerage, website) and `agent_marketing_settings` (headshot_url, logo_colored_url). Store as `agentProfile` state.
- Pass `agentProfile` down to `PreviewPanel`.
- Update `renderBlocksToHtml` to accept an optional `agentData` parameter. When provided, replace all `{{agent_*}}` placeholders with real values. If a field is empty/null, remove the entire line containing that placeholder (so empty fields don't show blank rows).
- The `headshot` and `logo` placeholders become actual `<img>` tags when data is available.

**Data available from `profiles` table**: `first_name`, `last_name`, `email`, `phone_number`, `office_number`, `office_address`, `brokerage`, `license_number`, `state_licenses`, `website`, `team_name`.

**Data from `agent_marketing_settings`**: `headshot_url`, `logo_colored_url`.

### 2. Featured Listings Design Looks Unprofessional

**Problem**: The listings block uses a bright green color scheme (`#f0fdf4` background, `#bbf7d0` borders, `#166534` text) with house emojis (🏠, 🏡). This looks playful rather than professional for a real estate newsletter.

**Fix**: Redesign the listings block in `renderBlocksToHtml.ts` with a clean, professional style:
- Remove emojis from the heading -- use plain text "Featured Listings"
- Use neutral colors: white background, light gray borders (`#e5e7eb`), dark text (`#1a1a1a`)
- Clean card design with subtle shadow effect via border
- Price in a professional dark color, not green
- Heading uses serif font (Georgia) for elegance
- Apply the same visual update to the `BlockRenderer.tsx` canvas preview

### 3. Mobile Preview: Columns Don't Stack, Images Disappear

**Problem**: The `columns` block renders as `<table><tr><td>...</td><td>...</td></tr></table>` with fixed percentage widths. At 375px mobile width, the columns get squished -- images become tiny or invisible because they're constrained to ~45% of 375px minus padding.

**Fix**: Add a `<style>` block with a `@media` query inside the email HTML output. At `max-width: 600px`, force each `<td>` in columns to `display: block; width: 100% !important;` so they stack vertically. This is standard email responsive design. The media query goes in the `<head>` of the HTML wrapper in `renderBlocksToHtml`.

Add a CSS class to column `<td>` elements (e.g., `class="nl-col"`) and target it:
```css
@media only screen and (max-width: 600px) {
  .nl-col { display: block !important; width: 100% !important; padding-right: 0 !important; }
}
```

## Files to Modify

| File | Changes |
|---|---|
| `renderBlocksToHtml.ts` | Add `agentData` param to replace placeholders with real values; redesign listings with neutral/professional colors; add responsive `<style>` in `<head>` for column stacking; add `class="nl-col"` to column `<td>` elements |
| `NewsletterBuilder.tsx` | Fetch full agent profile from `profiles` + `agent_marketing_settings`; pass `agentProfile` to `PreviewPanel` |
| `PreviewPanel.tsx` | Accept `agentData` prop; pass to `renderBlocksToHtml` |
| `BlockRenderer.tsx` | Update listings canvas preview to match new professional design (remove emojis, neutral colors) |

## Technical Details

### Agent Data Interface

```typescript
interface AgentData {
  name?: string;
  email?: string;
  phone?: string;
  office_phone?: string;
  office_address?: string;
  brokerage?: string;
  license?: string;
  website?: string;
  headshot_url?: string;
  logo_url?: string;
}
```

### Placeholder Replacement Logic

After generating the full HTML, do a single pass replacing placeholders. For each placeholder, if the value is empty, remove the entire `<p>` element containing it:

```typescript
function replaceAgentPlaceholders(html: string, agent: AgentData): string {
  const replacements: Record<string, string | undefined> = {
    '{{agent_name}}': agent.name,
    '{{agent_email}}': agent.email,
    // ... etc
  };
  // For each placeholder: if value exists, replace. If not, remove the parent <p> tag.
}
```

### Listings Redesign (Color Palette)

- Background: `#ffffff` (white)
- Border: `1px solid #e5e7eb`
- Heading: `#1a1a1a`, Georgia serif, no emoji
- Price: `#1a1a1a`, bold
- Address text: `#4b5563`
- Details (beds/baths): `#6b7280`
- Card hover: subtle border `#d1d5db`

