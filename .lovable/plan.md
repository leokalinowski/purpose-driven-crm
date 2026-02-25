
# Newsletter Builder Status

## Completed

### Featured Listings Overhaul
- Agents paste listing URLs (Zillow, Homes.com, Realtor.com, Redfin) and the system scrapes property details via Firecrawl + Lovable AI
- `ListingItem` interface with id, url, image_url, price, address, city, beds, baths, sqft, status
- `scrape-listing` edge function: Firecrawl scrape → AI structured extraction → regex fallback
- Settings panel: URL paste input + scraped listing cards with delete
- Canvas preview: shows real scraped listings or empty state prompt
- HTML renderer: renders actual listing cards with images in email

### Market Data Block
- Uses existing `fetch-market-data-grok` edge function (AI-generated per ZIP code)
- Builder shows sample data preview; real data injected at send time
- Metric selection checkboxes and style options (cards/table/minimal)

### Other Fixes Applied
- Template creation button feedback for unauthenticated users
- Working columns block with drop zones
- Social icons link editor
- Raw HTML block preview
- Send/Schedule panel with subject, sender, recipients, test email
- Columns HTML renderer math bug fixed
