

# Featured Listings Overhaul + Market Data Clarification

## How Market Data Currently Works

The Market Data block uses the existing `fetch-market-data-grok` edge function which calls the **Anthropic Claude API** (not uploaded data). It generates market stats per ZIP code using AI, caches results in `market_stats` and `zip_reports` tables, and populates the newsletter dynamically at send time based on each contact's ZIP. There is also a `zillow-scraper` edge function that attempts to scrape Zillow pages directly.

**The Market Data block will continue using this AI-generated system.** In the builder, it shows sample data as a preview. At send time, the `newsletter-send` function calls `fetch-market-data-grok` per unique ZIP code across recipients, caches results, and injects real numbers into the email HTML. No change needed here -- it works as designed.

## Featured Listings: New Approach

Currently the Listings block shows hardcoded sample data and says "pulled from your pipeline at send time." The user wants agents to **paste property URLs** from Zillow, Homes.com, Realtor.com, etc., and have the system scrape listing details (photo, price, address, beds/baths/sqft) automatically.

### Data Model Change

Update `ListingsProps` to store an array of manually-added listings rather than relying on pipeline data:

```typescript
export interface ListingItem {
  id: string;
  url: string;           // Original listing URL
  image_url: string;     // Property photo
  price: string;         // e.g. "$475,000"
  address: string;       // Street address
  city: string;          // City, State
  beds: number;
  baths: number;
  sqft: string;
  status: 'pending' | 'loaded' | 'error';  // Scrape status
}

export interface ListingsProps {
  style: 'grid' | 'list';
  listings: ListingItem[];  // replaces `count`
}
```

### Scraping Edge Function: `scrape-listing`

A new edge function that accepts a property URL and returns structured listing data. Uses Firecrawl (already available as a connector) to scrape the page, then uses AI to extract structured fields.

Flow:
1. Agent pastes a URL like `https://www.zillow.com/homedetails/123-Oak-St/12345_zpid/`
2. Frontend calls `scrape-listing` edge function with the URL
3. Edge function uses Firecrawl to scrape the page as markdown
4. Passes the markdown to Lovable AI to extract structured data (price, address, beds, baths, sqft, image)
5. Returns the structured `ListingItem` to the frontend
6. The listing data is stored in the block's `props.listings` array (saved with the template)

### Settings Panel Changes

Replace the current count slider with a listing URL manager:
- Text input + "Add Listing" button
- Paste a URL, click add, shows loading spinner while scraping
- Each listing shows a card with scraped data (photo, price, address, details)
- Delete button per listing
- Drag to reorder (optional, can be deferred)
- Grid/List style toggle remains
- Max 6 listings

### Canvas Preview Changes

Instead of sample data, show the actual scraped listings the agent added. If no listings added yet, show an empty state prompting them to add URLs in settings.

### HTML Renderer Changes

Update `renderListings` to render the actual listing data from `props.listings` instead of placeholder text.

## Files to Create

| File | Purpose |
|---|---|
| `supabase/functions/scrape-listing/index.ts` | Scrapes a property URL via Firecrawl + AI extraction |

## Files to Modify

| File | Change |
|---|---|
| `src/components/newsletter/builder/types.ts` | Add `ListingItem` interface, update `ListingsProps` and `BLOCK_DEFAULTS.listings` |
| `src/components/newsletter/builder/BlockSettings.tsx` | Replace listings count slider with URL paste + scrape UI |
| `src/components/newsletter/builder/BlockRenderer.tsx` | Show actual listing data in canvas preview instead of sample data |
| `src/components/newsletter/builder/renderBlocksToHtml.ts` | Render real listing cards with images in email HTML |

## Technical Details

### `scrape-listing` Edge Function

```
POST /functions/v1/scrape-listing
Body: { "url": "https://www.zillow.com/homedetails/..." }
Response: {
  "success": true,
  "listing": {
    "image_url": "https://...",
    "price": "$475,000",
    "address": "123 Oak Street",
    "city": "Austin, TX",
    "beds": 3,
    "baths": 2,
    "sqft": "1,850"
  }
}
```

Uses Firecrawl to scrape the page content, then Lovable AI (Gemini) to extract structured listing data from the markdown. Falls back to regex-based extraction if AI fails.

### Supported URL Patterns

- Zillow: `zillow.com/homedetails/...`
- Homes.com: `homes.com/property/...`
- Realtor.com: `realtor.com/realestateandhomes-detail/...`
- Redfin: `redfin.com/...`
- Any URL with property listing content

### Default Block Data

```typescript
listings: {
  style: 'grid',
  listings: []  // Empty array, agent adds via URL paste
}
```

