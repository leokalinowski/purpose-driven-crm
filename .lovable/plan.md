

# Add Agent Names to Event Selectors

## Problem
The event dropdown in the ClickUp Tasks admin tab only shows event titles (e.g., "The Real Estate Scholarship") without indicating which agent owns each event. Since multiple agents can have events with the same title, this makes it impossible to distinguish them.

## Solution
Update the event selector in `AdminEventTasks` to display the agent name next to each event title, e.g., **"The Real Estate Scholarship (Samir Redwan)"**.

## Changes

### File: `src/components/admin/AdminEventTasks.tsx`
- In the event filter dropdown (line 148-151), update each `SelectItem` to show the event title combined with the assigned agent's name
- Use the existing `agents` prop to look up the agent name by matching `event.agent_id` to `agents[].user_id`
- Display format: `Event Title (Agent Name)` or `Event Title (Unassigned)` if no agent

This is a small, targeted change -- just updating the label text in the dropdown items.
