

# Fix: Unreliable "Show Event Details" Toggle

## Root Cause

The `VisualEmailEditor` component has a one-way data flow problem. It generates HTML from its internal state but never parses incoming HTML to restore that state. Every time it mounts, it resets all toggles to defaults via `getDefaultData(emailType)`, then immediately overwrites the parent's saved HTML.

This means:
- Toggle off event details, save -- works in the moment
- Reload or switch email types -- toggle resets to default, saved HTML gets overwritten

## Fix

Modify `src/components/events/email/VisualEmailEditor.tsx` to parse the incoming `htmlContent` on initialization and detect which features are present. This way, when a saved template is loaded, the toggle states match what was actually saved.

### Changes to `VisualEmailEditor.tsx`

**1. Add an HTML parsing function** that detects key features from saved HTML:

```
function parseHtmlToData(html: string, emailType: string): Partial<VisualEditorData> {
  return {
    showEventDetails: html.includes('Event Details') && html.includes('{event_date}'),
    showHeadshot: html.includes('{headshot_url}'),
    showLogo: html.includes('{logo_colored_url}'),
    showAgentName: html.includes('{agent_name}') && html.includes('Hosted by'),
    showPhone: html.includes('{agent_phone}'),
    showEmail: html.includes('{agent_email}'),
    // ... etc for each toggle
  }
}
```

**2. Update initialization** to merge parsed state from `htmlContent` (when it exists and is non-empty) with defaults:

- On first mount, if `htmlContent` is non-empty (meaning a saved template was loaded), parse it and use those toggle states instead of defaults
- If `htmlContent` is empty (new template), use `getDefaultData()` as before

**3. Fix the race condition** in the useEffect that calls `onHtmlChange`:

- Skip the initial `onHtmlChange` call when the component mounts with existing HTML content (the parent already has valid HTML from the database)
- Only call `onHtmlChange` when the user actually changes something in the editor

This ensures the saved template HTML is never silently overwritten on mount.

### Technical Details

The component interface gains awareness of saved content:

```
interface VisualEmailEditorProps {
  emailType: string
  htmlContent: string
  onHtmlChange: (html: string) => void
}
```

No interface change needed -- `htmlContent` is already passed in. We just need to actually use it during initialization instead of ignoring it.

The initialization logic becomes:

```
const [data, setData] = useState<VisualEditorData>(() => {
  if (htmlContent && htmlContent.trim().length > 0) {
    const defaults = getDefaultData(emailType)
    const parsed = parseHtmlToData(htmlContent, emailType)
    return { ...defaults, ...parsed }
  }
  return getDefaultData(emailType)
})
```

And a ref to skip the first useEffect fire:

```
const isInitialMount = useRef(true)

useEffect(() => {
  if (mode === 'visual') {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return  // Don't overwrite saved HTML on mount
    }
    onHtmlChange(dataToHtml(data))
  }
}, [data, mode])
```

### File Modified

| File | Change |
|---|---|
| `src/components/events/email/VisualEmailEditor.tsx` | Add `parseHtmlToData()` function, update initialization to parse saved HTML, add mount guard to prevent overwriting saved content |

### What This Fixes

- Toggle off "Show Event Details" on a Thank You email, save, reload -- stays off
- Toggle on "Show Event Details" on a No-Show email, save, reload -- stays on
- All other toggles (headshot, logo, phone, etc.) also persist correctly across reloads
- No database schema changes needed -- everything is derived from the saved HTML

