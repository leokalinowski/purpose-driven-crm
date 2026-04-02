

## Resources Tab — File Library for Agents

A new "Resources" page where agents can browse, search, and download categorized files. Admins get a management panel to upload, categorize, and remove resources.

### Database

**New table: `resources`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text NOT NULL | Display name |
| description | text | Optional summary |
| category | text NOT NULL | e.g. "Contracts & Forms", "Marketing Templates", "Scripts & Guides" |
| file_path | text NOT NULL | Path in Supabase storage bucket |
| file_name | text NOT NULL | Original filename for download |
| file_size | bigint | Bytes |
| file_type | text | MIME type |
| uploaded_by | uuid REFERENCES auth.users | Admin who uploaded |
| created_at | timestamptz DEFAULT now() | |

**RLS policies:**
- SELECT: all authenticated users
- INSERT / UPDATE / DELETE: admin role only (via `has_role(auth.uid(), 'admin')`)

**New storage bucket: `resources`** (public: true, so files are downloadable via URL)

### New Files

#### 1. `src/pages/Resources.tsx`
- Auth-gated page with Layout wrapper
- Search bar + category filter tabs (All, Contracts & Forms, Marketing Templates, Scripts & Guides)
- Card grid showing each resource with title, description, category badge, file size, and download button
- Downloads use the public Supabase storage URL

#### 2. `src/components/admin/ResourcesManager.tsx`
- Upload form: title, description, category dropdown, file picker
- Uploads file to `resources` bucket, inserts row into `resources` table
- List of existing resources with delete button
- Used on a new admin page

#### 3. `src/pages/AdminResources.tsx`
- Admin page wrapping `ResourcesManager` with Layout and admin auth guard

#### 4. `src/hooks/useResources.ts`
- `useQuery` to fetch all resources, filtered by category
- `useMutation` for create and delete (admin only)

### Routing & Navigation

- Add `/resources` route in `App.tsx`
- Add `/admin/resources` route in `App.tsx`
- Add "Resources" item to sidebar navigation (icon: `FolderOpen`) after "Support Hub"
- Add "Resources" to admin sidebar under "Content & Comms" sub-group
- Add `/resources` to `useFeatureAccess.ts` as `'core'` tier (accessible to all)

### Technical Details

- File upload uses `supabase.storage.from('resources').upload(path, file)`
- Public URL via `supabase.storage.from('resources').getPublicUrl(path)`
- Category filter uses client-side filtering on the fetched list
- No edge functions needed — all operations go through Supabase client SDK
- File size displayed as human-readable (KB/MB)

