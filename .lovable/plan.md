

## Bidirectional ClickUp Comments Integration

### Overview

Use ClickUp's native task comments as the communication layer. Your team replies in ClickUp, agents see and respond in the Hub. Single source of truth, no separate database table needed.

---

### What We're Removing

**Integrations Tab in Team Management**

The `SupportWebhookManager` component and the "Integrations" tab at lines 664-666 and 942-944 in `AdminTeamManagement.tsx` are no longer needed since the ClickUp Automation handles webhook sync. This will be deleted along with the component file.

**Files to delete:**
- `src/components/admin/SupportWebhookManager.tsx`

**Files to modify:**
- `src/pages/AdminTeamManagement.tsx` - Remove import, tab trigger, and tab content

---

### What We're Building

#### 1. New Edge Function: `get-ticket-comments`

Fetches comments from ClickUp for a specific ticket.

**Endpoint:** `GET /functions/v1/get-ticket-comments?ticket_id={uuid}`

**Flow:**
1. Look up `clickup_task_id` from `support_tickets` table
2. Call ClickUp API: `GET /api/v2/task/{task_id}/comment`
3. Return formatted comments with sender info, timestamp, and text

**Response format:**
```json
{
  "comments": [
    {
      "id": "comment_123",
      "text": "We're looking into this now",
      "author": "Pam Anderson",
      "author_email": "pam@example.com",
      "created_at": "2024-01-15T10:30:00Z",
      "is_admin": true
    }
  ]
}
```

#### 2. New Edge Function: `post-ticket-comment`

Posts a comment to ClickUp from the agent.

**Endpoint:** `POST /functions/v1/post-ticket-comment`

**Request body:**
```json
{
  "ticket_id": "uuid",
  "message": "Here's more context about my issue..."
}
```

**Flow:**
1. Verify the authenticated user owns this ticket
2. Look up `clickup_task_id`
3. Call ClickUp API: `POST /api/v2/task/{task_id}/comment`
4. Return success

#### 3. New Hook: `useTicketComments`

React hook to fetch and post comments for a ticket.

```typescript
export function useTicketComments(ticketId: string) {
  // Query: fetch comments from edge function
  // Mutation: post new comment
  return { comments, isLoading, postComment, isPosting };
}
```

#### 4. New Component: `TicketDetailDialog`

Modal that opens when an agent clicks on a ticket in their history.

**Features:**
- Full ticket details (subject, description, status, dates)
- Conversation thread with alternating styling (agent vs admin)
- Reply input with send button
- Auto-refresh on open

#### 5. New Component: `TicketConversation`

Displays the comment thread with visual distinction between agent and admin messages.

- Agent messages: Right-aligned, primary color
- Admin messages: Left-aligned, muted background
- Timestamps on each message

#### 6. Updated Component: `TicketHistory`

Make each ticket row clickable to open the detail dialog.

---

### Technical Details

#### ClickUp Comments API

**Get Comments:**
```
GET https://api.clickup.com/api/v2/task/{task_id}/comment
Headers:
  Authorization: {CLICKUP_API_TOKEN}
```

**Post Comment:**
```
POST https://api.clickup.com/api/v2/task/{task_id}/comment
Headers:
  Authorization: {CLICKUP_API_TOKEN}
  Content-Type: application/json
Body:
  {
    "comment_text": "Message from agent via Hub Portal"
  }
```

#### Identifying Admin vs Agent Messages

ClickUp comments include `user` object with email. We can:
- Compare against the ticket's `agent_id` profile email
- Or maintain a list of admin emails
- Or simply check if the comment author matches the agent's email

---

### File Changes Summary

| File | Action |
|------|--------|
| `src/components/admin/SupportWebhookManager.tsx` | DELETE |
| `src/pages/AdminTeamManagement.tsx` | Remove Integrations tab |
| `supabase/functions/get-ticket-comments/index.ts` | CREATE |
| `supabase/functions/post-ticket-comment/index.ts` | CREATE |
| `src/hooks/useTicketComments.ts` | CREATE |
| `src/components/support/TicketDetailDialog.tsx` | CREATE |
| `src/components/support/TicketConversation.tsx` | CREATE |
| `src/components/support/TicketHistory.tsx` | Add click handler, integrate dialog |
| `src/pages/Support.tsx` | Import dialog component |

---

### User Experience

**For Agents:**
1. View ticket in "My Tickets" list
2. Click to open detail dialog
3. See full conversation history (your messages + admin replies)
4. Type reply and click "Send" to add follow-up
5. Reply appears immediately in dialog and in ClickUp

**For Your Team (Admins):**
1. Work entirely in ClickUp as usual
2. Add comments to tasks - they appear in the Hub automatically
3. Agent replies from Hub show up as ClickUp comments
4. Everything in one place for both sides

---

### Future Enhancement (Optional)

Add a ClickUp Automation that triggers the webhook when a **comment is added** by an admin. This would enable real-time notifications to agents. For now, comments refresh when the agent opens the ticket detail.

