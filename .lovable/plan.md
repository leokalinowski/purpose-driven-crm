

# Fix: AI Newsletter Generation Edge Function

## Root Cause

The error `AI did not return structured output` occurs at line 169. The Gemini model responded but did not use the `tool_calls` format -- it likely returned the newsletter content as plain text in `message.content` instead. This can happen with Gemini models when tool calling instructions aren't followed strictly.

## Two Issues to Fix

### Issue 1: No fallback when tool_calls is missing

The function crashes when the AI doesn't return tool_calls. We need a fallback that parses the content from `message.content` as JSON.

### Issue 2: CPU time limit risk

The AI call can take several seconds. Edge Functions have a 2-second CPU time limit. While `await fetch()` is wall-clock time (not CPU), the JSON parsing and DB operations after could push over the limit. We should use `EdgeRuntime.waitUntil()` to move the heavy processing to background.

## Fix Plan

### File: `supabase/functions/generate-ai-newsletter/index.ts`

1. **Add detailed logging** of the AI response structure so we can see what's actually returned
2. **Add fallback parsing**: If `tool_calls` is missing, try to extract JSON from `message.content` (the AI may return the structured data as text)
3. **Try `tool_choice: "auto"` instead of the forced object format** -- Gemini sometimes ignores forced tool choice but works fine with `auto`
4. **Wrap the AI response handling** to be more resilient

### Specific Changes

Replace the tool_choice and response parsing section:

```typescript
// Change tool_choice from object to string format
tool_choice: 'auto',

// After getting aiData, add logging and fallback:
console.log('AI response structure:', JSON.stringify({
  hasChoices: !!aiData.choices,
  finishReason: aiData.choices?.[0]?.finish_reason,
  hasToolCalls: !!aiData.choices?.[0]?.message?.tool_calls,
  hasContent: !!aiData.choices?.[0]?.message?.content,
}));

const message = aiData.choices?.[0]?.message;
let generated;

// Try tool_calls first
const toolCall = message?.tool_calls?.[0];
if (toolCall?.function?.arguments) {
  generated = JSON.parse(toolCall.function.arguments);
} else if (message?.content) {
  // Fallback: try to extract JSON from content
  const content = message.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    generated = JSON.parse(jsonMatch[0]);
  }
}

if (!generated?.blocks) {
  console.error('AI response:', JSON.stringify(aiData).slice(0, 500));
  throw new Error('AI did not return valid newsletter blocks');
}
```

This makes the function resilient to both tool-call and plain-text responses from the AI.

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/generate-ai-newsletter/index.ts` | Add response logging, fallback JSON parsing, and more resilient tool_choice |

