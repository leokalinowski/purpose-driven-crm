import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Phone, MessageSquare, Pencil, Lightbulb, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { cn } from '@/lib/utils';

interface SphereSyncTaskCardProps {
  task: SphereSyncTask;
  onUpdate: (taskId: string, updates: Partial<SphereSyncTask>) => void;
  onEditContact: () => void;
}

function Initials({ first, last }: { first?: string; last?: string }) {
  const a = (first?.[0] ?? '').toUpperCase();
  const b = (last?.[0] ?? '').toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11.5px] font-bold select-none">
      {(a + b) || '?'}
    </div>
  );
}

export function SphereSyncTaskCard({ task, onUpdate, onEditContact }: SphereSyncTaskCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showTalkingPoints, setShowTalkingPoints] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');

  const handleCompletionChange = () => {
    onUpdate(task.id, { completed: !task.completed });
  };

  const handleNotesUpdate = () => {
    onUpdate(task.id, { notes });
    setShowNotes(false);
  };

  const TaskIcon = task.task_type === 'call' ? Phone : MessageSquare;
  const hasTalkingPoints = task.ai_talking_points && task.ai_talking_points.length > 0;
  const score = task.ai_priority_score ?? 0;
  const pillClass = score >= 8
    ? 'bg-red-50 text-red-700 border border-red-200'
    : score >= 4
    ? 'bg-orange-50 text-orange-700 border border-orange-200'
    : 'bg-muted/60 text-muted-foreground';

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card overflow-hidden transition-opacity',
      task.completed && 'opacity-55'
    )}>
      {/* Main row */}
      <div className="flex items-start gap-3.5 px-4 py-3.5">
        {/* Checkbox */}
        <button
          onClick={handleCompletionChange}
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] mt-0.5 transition-colors',
            task.completed
              ? 'bg-primary border-primary text-white'
              : 'border-border bg-white hover:border-primary'
          )}
        >
          {task.completed && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Avatar */}
        <Initials first={task.lead.first_name} last={task.lead.last_name} />

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className={cn('text-sm font-semibold text-foreground', task.completed && 'line-through text-muted-foreground')}>
              {`${task.lead.first_name || ''} ${task.lead.last_name}`.trim()}
            </span>
            {score > 0 && (
              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', pillClass)}>
                {score}/10
              </span>
            )}
            {task.lead.dnc && (
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive border border-destructive/20">
                DNC
              </span>
            )}
            {task.completed && (
              <span className="inline-flex items-center rounded-full bg-reop-green/10 px-2 py-0.5 text-[11px] font-semibold text-reop-green">
                Done
              </span>
            )}
          </div>
          {task.ai_reason && (
            <div className="flex items-center gap-1 text-[12px] text-primary font-medium">
              <Sparkles className="h-3 w-3 shrink-0" />
              {task.ai_reason}
            </div>
          )}
          {task.lead.phone && (
            <a href={`tel:${task.lead.phone}`}
              className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-primary transition-colors">
              <Phone className="h-3 w-3" />
              {task.lead.phone}
            </a>
          )}
        </div>

        {/* Type tag + actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
            <TaskIcon className="h-3 w-3" />
            {task.task_type === 'call' ? 'Call' : 'Text'}
          </div>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{task.lead.category}</span>
          {hasTalkingPoints && (
            <button
              onClick={() => setShowTalkingPoints(!showTalkingPoints)}
              title="Talking points"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all"
            >
              <Lightbulb className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowNotes(!showNotes)}
            title="Notes"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all"
          >
            {showNotes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onEditContact}
            title="Edit contact"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Talking points */}
      {showTalkingPoints && hasTalkingPoints && (
        <div className="border-t border-border bg-muted/20 px-5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">
            <Lightbulb className="h-3 w-3" /> Talking points
          </div>
          <ul className="space-y-1">
            {task.ai_talking_points!.map((point, i) => (
              <li key={i} className="text-[12px] text-foreground flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5 shrink-0">·</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {showNotes && (
        <div className="border-t border-border bg-muted/20 px-5 py-3 space-y-2">
          {task.notes && !showNotes && (
            <p className="text-[12px] text-muted-foreground">{task.notes}</p>
          )}
          <Textarea
            placeholder="Add notes about this interaction…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[72px] text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleNotesUpdate} className="h-7 text-xs">Save</Button>
            <Button size="sm" variant="outline" onClick={() => setShowNotes(false)} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {/* Existing notes (collapsed state) */}
      {task.notes && !showNotes && (
        <div className="border-t border-border/50 bg-muted/10 px-5 py-2 text-[11px] text-muted-foreground">
          {task.notes}
        </div>
      )}
    </div>
  );
}
