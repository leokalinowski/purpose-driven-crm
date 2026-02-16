import React, { RefObject } from 'react'
import { Badge } from '@/components/ui/badge'

const VARIABLE_GROUPS = [
  {
    label: 'Event',
    variables: [
      { name: 'event_title', label: 'Event Title' },
      { name: 'event_date', label: 'Date' },
      { name: 'event_time', label: 'Time' },
      { name: 'event_location', label: 'Location' },
      { name: 'event_description', label: 'Description' },
    ],
  },
  {
    label: 'Agent',
    variables: [
      { name: 'agent_name', label: 'Name' },
      { name: 'agent_email', label: 'Email' },
      { name: 'agent_phone', label: 'Phone' },
      { name: 'agent_office_number', label: 'Office #' },
      { name: 'agent_office_address', label: 'Office Addr' },
      { name: 'agent_website', label: 'Website' },
      { name: 'agent_brokerage', label: 'Brokerage' },
      { name: 'agent_team_name', label: 'Team' },
    ],
  },
]

interface VariableInsertBarProps {
  textareaRef: RefObject<HTMLTextAreaElement | HTMLInputElement>
  onInsert: (variable: string) => void
}

export const VariableInsertBar: React.FC<VariableInsertBarProps> = ({ textareaRef, onInsert }) => {
  const handleInsert = (varName: string) => {
    const el = textareaRef.current
    if (!el) {
      onInsert(`{${varName}}`)
      return
    }
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const value = el.value
    const insertion = `{${varName}}`
    const newValue = value.slice(0, start) + insertion + value.slice(end)

    // Use native setter to trigger React onChange
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set
    nativeInputValueSetter?.call(el, newValue)
    el.dispatchEvent(new Event('input', { bubbles: true }))

    // Restore cursor position after insertion
    requestAnimationFrame(() => {
      const newPos = start + insertion.length
      el.setSelectionRange(newPos, newPos)
      el.focus()
    })
  }

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {VARIABLE_GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium mr-0.5">{group.label}:</span>
          {group.variables.map((v) => (
            <Badge
              key={v.name}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 text-xs px-1.5 py-0"
              onClick={() => handleInsert(v.name)}
            >
              {v.label}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  )
}
