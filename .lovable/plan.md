

# Fix External Link, Add Logo Download, Show Agent on Event Contributions

## 1. Fix External Link 404

The external link icon next to the company name opens the sponsor's `website` value. If it's stored without a protocol (e.g. `reop.com`), the browser treats it as a relative path within the app, causing a 404.

**Fix in `AdminSponsors.tsx` (line 161):**
- Before rendering the `href`, prepend `https://` if the URL doesn't already start with `http://` or `https://`.

## 2. Add Logo Download Button

Add a small download button next to the logo thumbnail in the table. When clicked, it fetches the logo image and triggers a browser download.

**Changes in `AdminSponsors.tsx`:**
- Add a download icon button in the Company cell, visible only when `s.logo_url` exists.
- The download function fetches the image URL as a blob and triggers a file save using a temporary anchor element.

## 3. Show Agent Name on Event Contributions

In the SponsorForm, each event in the "Event Contributions" list currently shows just the event title and date. We need to also show which agent is attached to that event.

**Changes in `SponsorForm.tsx`:**
- Update the events query (line 40) to also select `agent_id`.
- Add a second query (or extend the existing one) to fetch agent names from the `profiles` table for the agent IDs found.
- Display the agent name as a small badge or text next to each event title in the contributions list.

---

## Technical Details

### File: `src/pages/AdminSponsors.tsx`

**External link fix (line 161):**
```tsx
const href = s.website.startsWith('http') ? s.website : `https://${s.website}`;
<a href={href} target="_blank" ...>
```

**Logo download button** -- add a Download icon button in the Company cell that:
```tsx
const handleDownloadLogo = async (url: string, companyName: string) => {
  const response = await fetch(url);
  const blob = await response.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${companyName}-logo.${url.split('.').pop()}`;
  a.click();
  URL.revokeObjectURL(a.href);
};
```

### File: `src/components/admin/SponsorForm.tsx`

**Event query update (line 40):**
```tsx
const { data, error } = await supabase
  .from('events')
  .select('id, title, event_date, agent_id')
  .order('event_date', { ascending: false });
```

**Agent names lookup** -- fetch profiles for the unique agent IDs:
```tsx
const agentIds = [...new Set(data.map(e => e.agent_id).filter(Boolean))];
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name')
  .in('id', agentIds);
// Build a map: agentId -> name
```

**Display** -- show agent name next to each event title in the contributions scroll area:
```tsx
<span className="text-xs text-muted-foreground ml-1">
  ({agentMap.get(ev.agent_id) ?? 'Unassigned'})
</span>
```
