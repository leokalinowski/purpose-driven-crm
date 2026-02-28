

# Improve AI Newsletter Generator Dialog — 3 Editable Prompt Options

## Current State
The dialog has a single free-text `Input` for an optional topic hint. The user types a theme or leaves it blank.

## Change
Replace the single input with **3 pre-filled prompt options** displayed as editable `Textarea` fields, each with a label and description. The user selects one (radio-style) and can edit the prompt text before generating.

### Prompt Templates

1. **Market Data** — Pre-filled with: *"Write a newsletter featuring current real estate market data and trends for [City/Area]. Include median home prices, inventory levels, days on market, and what this means for buyers and sellers right now."*

2. **Seasonal** — Pre-filled with a dynamically computed prompt based on the current month/season: *"Write a newsletter about the [Season] [Year] real estate market. Cover seasonal buying/selling trends, what homeowners should be doing this time of year, and market outlook for the coming months."*

3. **Educational** — Pre-filled with: *"Write an educational newsletter about the real estate process. Cover topics like home maintenance tips, understanding title insurance, how the transaction process works from offer to closing, or general homeownership advice that provides value to your database."*

### UI Design
- 3 cards/sections, each with a radio button, title, and an editable `Textarea` showing the prompt
- Selecting a card highlights it; the textarea for the selected option is fully editable
- The selected prompt text is sent as `topic_hint` to the edge function
- Dialog width increased slightly (`max-w-2xl`) to accommodate the textareas

### File to Modify
- `src/pages/AdminNewsletter.tsx` — Replace the single input with the 3-option prompt selector UI, add state for selected option and prompt texts

### No backend changes needed
The `topic_hint` parameter already accepts any string and is passed directly to the AI system prompt.

