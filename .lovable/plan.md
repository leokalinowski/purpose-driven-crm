

# Admin Database Export Button

## What This Does

Adds an "Export CSV" button to the Admin Database Management page that lets admins download any agent's full contact database as a CSV file. This is useful for mailers, marketing strategies, and offline analysis.

## How It Works

1. Admin selects an agent from the dropdown (as they already do)
2. A new "Export CSV" button appears in the toolbar alongside "Upload CSV", "Add Contact", etc.
3. Clicking it fetches ALL contacts for that agent (handling large databases beyond the current 5000 limit) and downloads them as a CSV file
4. The CSV includes all relevant columns: first name, last name, email, phone, address, city, state, zip, tags, DNC status, notes, category, last activity date, activity count

## Technical Details

### File Changed: `src/pages/AdminDatabaseManagement.tsx`

1. Add a `Download` icon import from `lucide-react`
2. Add an `exportContacts` async function that:
   - Fetches ALL contacts for the selected agent in batches of 1000 (using pagination via `.range()`) to handle databases larger than 5000
   - Builds a CSV string with proper escaping (quotes, commas, newlines)
   - Triggers a browser download with filename: `{agent_name}_contacts_{date}.csv`
   - Shows a toast on success/failure
   - Includes a loading state so the button shows a spinner during export
3. Add the "Export CSV" button in the toolbar row (next to "Upload CSV"), disabled when no agent is selected

### CSV Columns

The exported CSV will include these columns in order:
- First Name, Last Name, Email, Phone, Address 1, Address 2, City, State, Zip Code, Tags, DNC, Notes, Category, Last Activity Date, Activity Count

### No Database Changes Required

This is purely a client-side feature that reads existing data through the already-authorized Supabase queries (admin RLS policies are already in place for the contacts table).

