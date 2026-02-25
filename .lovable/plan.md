

# E-Newsletter Rebuild: Full Visual Builder

## Summary

Replace the current AI-only, per-ZIP newsletter system with a Mailchimp-style drag-and-drop email builder. Agents and admins design newsletter templates visually using content blocks. One newsletter layout per agent per month, with a special "Market Data" block that dynamically populates per-contact ZIP code at send time. The existing AI generation (`market-data-grok`) is preserved as the engine behind that dynamic block.

## Architecture Overview

```text
┌──────────────────────────────────────────────────────┐
│                  Newsletter Builder UI                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐ │
│  │ Heading │ │  Text   │ │  Image  │ │   Button   │ │
│  ├─────────┤ ├─────────┤ ├─────────┤ ├────────────┤ │
│  │ Divider │ │ Spacer  │ │ Columns │ │Social Icons│ │
│  ├─────────┤ ├─────────┤ ├─────────┤ ├────────────┤ │
│  │ Market  │ │Listings │ │Agent Bio│ │  HTML Raw  │ │
│  │  Data   │ │Showcase │ │/Branding│ │            │ │
│  └─────────┘ └─────────┘ └─────────┘ └────────────┘ │
│                                                      │
│  Canvas: Drag blocks, reorder, configure each block  │
│  Live Preview: Desktop / Mobile toggle               │
└──────────────────────────────────────────────────────┘
           │
           ▼ Save as JSON (block tree)
┌──────────────────────────────────────────────────────┐
│           newsletter_templates table                  │
│  id, agent_id, name, blocks_json, global_styles,     │
│  is_default, created_by, created_at, updated_at      │
└──────────────────────────────────────────────────────┘
           │
           ▼ At send time
┌──────────────────────────────────────────────────────┐
│         newsletter-send edge function                 │
│  1. Load template blocks_json for agent               │
│  2. For each contact:                                 │
│     a. Replace {{first_name}}, {{last_name}}, etc.    │
│     b. For "market_data" blocks: call market-data-grok│
│        with contact's ZIP (cached per ZIP per month)  │
│     c. Render blocks_json → final HTML email          │
│  3. Send via Resend with rate limiting                │
└──────────────────────────────────────────────────────┘
```

## Database Changes

### New table: `newsletter_templates`

Stores the visual template as a JSON block tree.

```sql
CREATE TABLE public.newsletter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT 'Monthly Newsletter',
  blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  global_styles JSONB DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: Agents can CRUD their own templates; admins can CRUD all templates.

### `blocks_json` Schema (stored in JSONB)

Each block is an object:

```json
[
  {
    "id": "uuid",
    "type": "heading",
    "props": { "text": "Monthly Market Update", "level": 2, "align": "center", "color": "#1a1a1a" }
  },
  {
    "id": "uuid",
    "type": "columns",
    "props": { "columns": 2, "gap": 16 },
    "children": [
      [{ "id": "uuid", "type": "image", "props": { "src": "...", "alt": "..." } }],
      [{ "id": "uuid", "type": "text", "props": { "html": "<p>Hello {{first_name}}...</p>" } }]
    ]
  },
  {
    "id": "uuid",
    "type": "market_data",
    "props": { "style": "cards", "metrics": ["median_sale_price", "active_listings", "days_on_market", "price_per_sqft"] }
  },
  {
    "id": "uuid",
    "type": "agent_bio",
    "props": { "layout": "horizontal", "showHeadshot": true, "showLogo": true }
  },
  {
    "id": "uuid",
    "type": "button",
    "props": { "text": "Schedule a Call", "url": "https://...", "color": "#2563eb", "align": "center" }
  }
]
```

### Block Types

| Type | Description | Dynamic? |
|---|---|---|
| `heading` | H1-H4 with font, color, alignment | Static |
| `text` | Rich text paragraph (supports `{{variables}}`) | Static + variables |
| `image` | Single image with alt text, link, sizing | Static |
| `button` | CTA button with text, URL, color | Static |
| `divider` | Horizontal rule with color/thickness | Static |
| `spacer` | Vertical spacing (configurable height) | Static |
| `columns` | 2 or 3 column layout, each column holds child blocks | Container |
| `social_icons` | Row of social media icons with links | Static |
| `market_data` | **Dynamic**: auto-filled with AI market analysis per contact ZIP | Dynamic per contact |
| `listings` | Property listings showcase (manual or from pipeline) | Semi-dynamic |
| `agent_bio` | Auto-populated from agent profile + marketing settings | Dynamic per agent |
| `html_raw` | Raw HTML block for advanced users | Static |

### Supported Variables (replaced at send time)

`{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{address}}`, `{{city}}`, `{{state}}`, `{{zip_code}}`, `{{agent_name}}`, `{{agent_email}}`, `{{agent_phone}}`, `{{unsubscribe_url}}`

## Frontend: Newsletter Builder

### Technology Choice

Build a custom block editor using `react-dnd` (already installed) for drag-and-drop. This avoids adding heavy third-party email builder dependencies while giving full control over the block types and rendering.

### New Files

| File | Purpose |
|---|---|
| `src/components/newsletter/builder/NewsletterBuilder.tsx` | Main builder component: sidebar palette + canvas + preview |
| `src/components/newsletter/builder/BlockPalette.tsx` | Draggable block type list (sidebar) |
| `src/components/newsletter/builder/BuilderCanvas.tsx` | Drop zone, renders block list, handles reorder |
| `src/components/newsletter/builder/BlockRenderer.tsx` | Renders a single block in edit mode (with controls) |
| `src/components/newsletter/builder/BlockSettings.tsx` | Right-panel settings for selected block (text, colors, etc.) |
| `src/components/newsletter/builder/blocks/HeadingBlock.tsx` | Heading block editor |
| `src/components/newsletter/builder/blocks/TextBlock.tsx` | Rich text block editor |
| `src/components/newsletter/builder/blocks/ImageBlock.tsx` | Image upload/URL block |
| `src/components/newsletter/builder/blocks/ButtonBlock.tsx` | CTA button block |
| `src/components/newsletter/builder/blocks/DividerBlock.tsx` | Divider block |
| `src/components/newsletter/builder/blocks/SpacerBlock.tsx` | Spacer block |
| `src/components/newsletter/builder/blocks/ColumnsBlock.tsx` | Multi-column layout block |
| `src/components/newsletter/builder/blocks/MarketDataBlock.tsx` | Market data placeholder (shows sample data in editor) |
| `src/components/newsletter/builder/blocks/ListingsBlock.tsx` | Property listings block |
| `src/components/newsletter/builder/blocks/AgentBioBlock.tsx` | Agent bio/branding block |
| `src/components/newsletter/builder/blocks/SocialIconsBlock.tsx` | Social media icons block |
| `src/components/newsletter/builder/blocks/HtmlRawBlock.tsx` | Raw HTML block |
| `src/components/newsletter/builder/PreviewPanel.tsx` | Desktop/mobile preview toggle, renders final HTML |
| `src/components/newsletter/builder/AIAssistant.tsx` | AI writing assistant sidebar (suggest copy, rewrite, etc.) |
| `src/components/newsletter/builder/TemplateGallery.tsx` | Starter templates gallery |
| `src/components/newsletter/builder/renderBlocksToHtml.ts` | Converts blocks_json to email-safe HTML (inline styles, table layout) |
| `src/hooks/useNewsletterTemplates.ts` | CRUD hook for newsletter_templates |
| `src/pages/NewsletterBuilder.tsx` | Page wrapper with route |

### Builder Layout

```text
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [Save] [Preview] [Send Test] [AI Assistant] [←]  │
├──────────┬────────────────────────────┬─────────────────────┤
│          │                            │                     │
│  Block   │       Canvas               │   Block Settings    │
│  Palette │  (drag to reorder)         │   (selected block)  │
│          │                            │                     │
│  ┌────┐  │  ┌──────────────────────┐  │  Font: [dropdown]   │
│  │ H  │  │  │  Monthly Update      │  │  Size: [slider]     │
│  ├────┤  │  ├──────────────────────┤  │  Color: [picker]    │
│  │ T  │  │  │  Dear {{first_name}} │  │  Align: [L C R]     │
│  ├────┤  │  ├──────────────────────┤  │  Padding: [input]   │
│  │ Img│  │  │  [Market Data Block] │  │                     │
│  ├────┤  │  ├──────────────────────┤  │                     │
│  │ Btn│  │  │  [Agent Bio Block]   │  │                     │
│  ├────┤  │  └──────────────────────┘  │                     │
│  │ ···│  │                            │                     │
│  └────┘  │                            │                     │
├──────────┴────────────────────────────┴─────────────────────┤
│  Status: Last saved 2 min ago | Template: "March 2026"      │
└─────────────────────────────────────────────────────────────┘
```

### AI Assistant

A slide-out panel that can:
- Generate a full newsletter draft based on the agent's database info (contacts, transactions, events, coaching data)
- Rewrite selected text blocks (tone, length adjustments)
- Suggest subject lines
- Auto-populate a market data section with sample content

Uses the existing `market-data-grok` edge function for market content, and a new lightweight edge function for copy assistance.

### Template Gallery

Pre-built starter templates (stored as seed data in `newsletter_templates` with `agent_id = NULL` as system templates):
- "Classic Market Report" - clean, data-focused
- "Modern Minimal" - white space heavy, elegant
- "Bold & Colorful" - vibrant colors, large CTAs
- "Personal Touch" - photo-heavy, casual tone

## Backend: HTML Rendering Engine

### `renderBlocksToHtml.ts` (shared between frontend preview and edge function)

Converts the `blocks_json` array into email-safe HTML:
- Uses `<table>` layout for email client compatibility
- All styles inlined (no `<style>` tags)
- Responsive via `max-width` on outer table + `width: 100%` on inner elements
- Images use absolute URLs
- Column blocks render as `<td>` elements in a `<tr>`

This same renderer runs:
1. In the browser for live preview
2. In the edge function at send time (copy the renderer logic into the edge function or import as shared code)

### Updated `newsletter-send` Edge Function

Modified flow:
1. Load the agent's active `newsletter_template` (blocks_json)
2. If no template exists, fall back to the current AI-only generation (backward compatible)
3. For each contact:
   - Replace all `{{variables}}` in text/heading blocks
   - For `market_data` blocks: call `market-data-grok` (cached per ZIP per month to avoid redundant API calls)
   - For `agent_bio` blocks: pull from `profiles` + `agent_marketing_settings`
   - For `listings` blocks: pull from `transaction_coordination` or manually configured listings
   - Render final HTML via the block-to-HTML renderer
   - Send via Resend

### New Edge Function: `newsletter-ai-assist`

A lightweight function for the AI writing assistant:
- Accepts a prompt + context (agent profile, recent transactions, contact stats)
- Returns suggested copy
- Uses Grok API (same as market-data-grok)

## Modified Files

| File | Change |
|---|---|
| `src/App.tsx` | Add route for `/newsletter-builder/:templateId?` |
| `src/components/layout/AppSidebar.tsx` | Add "Newsletter Builder" nav item |
| `src/pages/AdminNewsletter.tsx` | Add "Templates" tab linking to builder, keep existing tabs |
| `src/pages/Newsletter.tsx` | Add link to builder for agents |
| `supabase/functions/newsletter-send/index.ts` | Load template, render blocks to HTML, fallback to current behavior |
| `src/integrations/supabase/types.ts` | Auto-updated with new table types |

## Migration Path

- The current system continues to work as-is for agents without a custom template
- When an agent (or admin for that agent) creates a template, future sends use the visual template
- The "AI-only" mode becomes a special case: a template with a single full-width `market_data` block + `agent_bio` block

## Implementation Phases

**Phase 1 - Foundation** (this session):
- Database table + RLS
- Block renderer (blocks_json to HTML)
- Builder UI with core blocks: heading, text, image, button, divider, spacer
- Save/load templates
- Live preview (desktop/mobile toggle)

**Phase 2 - Advanced Blocks**:
- Column layouts
- Market data dynamic block
- Agent bio block
- Listings showcase block
- Social icons block

**Phase 3 - AI + Send Integration**:
- AI assistant panel
- Template gallery with starter templates
- Update `newsletter-send` to use templates
- Test email sending from builder

**Phase 4 - Polish**:
- Undo/redo
- Template duplication
- Admin: manage templates per agent
- Raw HTML block
- Analytics integration (track which template performed best)

