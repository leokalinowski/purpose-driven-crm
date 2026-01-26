

## Implementation Plan: Agent Images Gallery and AI Backgrounds System

### Overview
This plan implements two new features:
1. A gallery system for storing multiple images per agent
2. A centralized AI backgrounds table with client linking capability

---

### Part 1: Agent Images Gallery

**Database Changes:**

Create a new `agent_images` table to store multiple images per agent:

```text
Table: agent_images
- id: uuid (primary key)
- user_id: uuid (references agent)
- image_url: text (stored in Supabase Storage)
- image_type: text (e.g., 'headshot', 'logo', 'promotional', 'other')
- name: text (optional display name)
- notes: text (optional)
- sort_order: integer (for ordering)
- created_at: timestamp
- updated_at: timestamp
```

RLS Policies:
- Admins can manage all images
- Users can view their own images

**UI Changes:**

Add an "Images" tab to the `AgentMarketingSettingsForm` component with:
- Grid display of uploaded images with thumbnails
- Upload button for adding new images
- Image type selector (dropdown)
- Delete functionality per image
- Drag-and-drop reordering (optional enhancement)

---

### Part 2: AI Backgrounds System

**Database Changes:**

Create a `backgrounds` table for centralized AI-generated backgrounds:

```text
Table: backgrounds
- id: uuid (primary key)
- name: text (required)
- background_url: text (image URL)
- prompt: text (AI generation prompt)
- category: text (e.g., 'real-estate', 'lifestyle', 'abstract')
- notes: text (optional)
- created_at: timestamp
- updated_at: timestamp
- created_by: uuid (admin who created it)
```

Create a junction table for many-to-many client linking:

```text
Table: background_agent_links
- id: uuid (primary key)
- background_id: uuid (references backgrounds)
- user_id: uuid (references agent)
- created_at: timestamp
```

RLS Policies:
- Admins can manage all backgrounds
- Admins can manage all links
- Users can view backgrounds linked to them

**UI Changes:**

Add a "Backgrounds" tab to the `AgentMarketingSettingsForm` component with:
- Table/grid showing all available backgrounds
- Checkboxes to link/unlink backgrounds to the current agent
- Display columns: Name, Thumbnail, Category, Notes
- Filter by category

Create a new admin page or section for managing the master backgrounds list:
- Form to add new backgrounds (name, upload image, prompt, category, notes)
- Edit and delete existing backgrounds
- View which clients are linked to each background

---

### File Changes Summary

**New Files:**
1. `src/hooks/useAgentImages.ts` - Hook for agent images CRUD
2. `src/hooks/useBackgrounds.ts` - Hook for backgrounds management
3. `src/components/admin/AgentImagesGallery.tsx` - Images gallery component
4. `src/components/admin/BackgroundsManager.tsx` - Backgrounds management for admin
5. `src/components/admin/AgentBackgroundsSelector.tsx` - Background selection per agent

**Modified Files:**
1. `src/components/admin/AgentMarketingSettingsForm.tsx` - Add Images and Backgrounds tabs
2. `src/hooks/useAgentMarketingSettings.ts` - Update type definitions
3. `supabase/migrations/[timestamp]_create_agent_images_table.sql` - New migration
4. `supabase/migrations/[timestamp]_create_backgrounds_tables.sql` - New migration

---

### Technical Details

**Database Migrations:**

Migration 1 - Agent Images:
```sql
CREATE TABLE agent_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  image_type text DEFAULT 'other',
  name text,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies for admin management and user read access
```

Migration 2 - Backgrounds System:
```sql
CREATE TABLE backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  background_url text NOT NULL,
  prompt text,
  category text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE background_agent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  background_id uuid NOT NULL REFERENCES backgrounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(background_id, user_id)
);

-- RLS policies for admin management
```

**Storage:**
- Continue using existing `agent-assets` bucket for agent-uploaded images
- Create new `backgrounds` bucket for admin-uploaded AI backgrounds

**Component Architecture:**

```text
AgentMarketingSettingsForm
├── Tab: Branding (existing)
├── Tab: Content (existing)
├── Tab: Integrations (existing)
├── Tab: Images (new)
│   └── AgentImagesGallery
│       ├── Image grid with thumbnails
│       ├── Upload button
│       └── Delete per image
└── Tab: Backgrounds (new)
    └── AgentBackgroundsSelector
        ├── Grid of all backgrounds
        ├── Checkbox to link/unlink
        └── Category filter
```

---

### Implementation Steps

1. **Database Setup**
   - Create `agent_images` table with RLS
   - Create `backgrounds` table with RLS
   - Create `background_agent_links` junction table with RLS
   - Create `backgrounds` storage bucket

2. **Backend Hooks**
   - Create `useAgentImages` hook for agent image CRUD
   - Create `useBackgrounds` hook for backgrounds management

3. **Agent Images Gallery**
   - Build `AgentImagesGallery` component with upload and display
   - Add "Images" tab to marketing settings form

4. **Backgrounds System**
   - Build `AgentBackgroundsSelector` for per-agent linking
   - Build `BackgroundsManager` for admin master list management
   - Add "Backgrounds" tab to marketing settings form

5. **Integration**
   - Update `AgentMarketingSettingsForm` with new tabs
   - Test upload and linking functionality

