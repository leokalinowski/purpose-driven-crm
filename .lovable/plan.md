

## Fix ClickUp Integration for Support Hub

### Current State

| Item | Status |
|------|--------|
| `CLICKUP_API_TOKEN` | ✅ Configured |
| `CLICKUP_WEBHOOK_SECRET` | ✅ Configured |
| `CLICKUP_SUPPORT_LIST_ID` | ❌ Missing |
| `support_config` assignee IDs | ❌ All NULL |

---

### Step-by-Step Fix

#### Step 1: Add CLICKUP_SUPPORT_LIST_ID Secret

You need to provide the ClickUp List ID where support tickets will be created.

**How to find it:**
1. Open ClickUp and navigate to your Support list
2. Click the three dots (⋮) next to the list name
3. Select "Copy link"
4. The URL will look like: `https://app.clickup.com/123456/v/li/901234567`
5. The List ID is the last number: `901234567`

Once you have it, I'll add it as a secret.

---

#### Step 2: Get ClickUp User IDs for Assignees

To auto-assign tickets to team members, we need their ClickUp user IDs.

**How to find ClickUp User IDs:**
1. In ClickUp, go to Settings → Teams
2. Click on your workspace/team
3. For each member, you can find their ID via the ClickUp API

**Alternatively**, I can create a simple edge function to fetch all team members from ClickUp and display their IDs. This would make mapping easier.

---

#### Step 3: Update support_config Table

Once we have the user IDs, update the `support_config` table:

| Category | Assignee Name | ClickUp User ID |
|----------|---------------|-----------------|
| database | [Name] | [ID] |
| social | [Name] | [ID] |
| events | [Name] | [ID] |
| newsletter | [Name] | [ID] |
| spheresync | [Name] | [ID] |
| technical | Leonardo | [ID] |
| general | Leonardo | [ID] |

---

#### Step 4: Build Admin UI for Config Management (Optional)

Create an admin page to manage support config:
- View/edit assignee mappings
- See all support tickets across agents
- Update ticket statuses manually

---

### Implementation Plan

**Phase 1: Secrets & Testing**
1. Add `CLICKUP_SUPPORT_LIST_ID` secret
2. Create helper edge function to fetch ClickUp team members
3. Test ticket creation with ClickUp sync

**Phase 2: Assignee Configuration**
1. Populate `support_config` with correct ClickUp user IDs
2. Test that tickets are assigned to the right people

**Phase 3: Admin Dashboard (if desired)**
1. Create admin page for ticket management
2. Add support config editor

---

### Questions to Confirm

1. **Do you have a Support List already created in ClickUp?** If not, we should create one first.

2. **Who handles each category?** Please provide names for:
   - Database/CRM issues
   - Social Media issues
   - Events issues
   - Newsletter issues
   - SphereSync issues
   - Technical issues
   - General requests

3. **Would you like me to create a helper function to fetch your ClickUp team member IDs?** This would output all member names and IDs so you can easily map them.

---

### Technical Details

The edge function `create-support-ticket` is already correctly structured:
- Line 27: Reads `CLICKUP_API_TOKEN` 
- Line 84: Reads `CLICKUP_SUPPORT_LIST_ID`
- Line 101: Uses `clickup_assignee_id` from `support_config`
- Lines 104-120: Creates task in ClickUp with tags and assignees

Once secrets are configured and assignee IDs populated, tickets will automatically sync to ClickUp.

