import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Pencil, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { cn } from '@/lib/utils';

interface SphereSyncTaskCardProps {
  task: SphereSyncTask;
  onUpdate: (taskId: string, updates: Partial<SphereSyncTask>) => void;
  onEditContact: () => void;
}

function PriorityBadge({ score }: { score: number }) {
  const label = `${score}/10`;
  const className =
    score >= 8 ? 'bg-amber-100 text-amber-800 border-amber-200' :
    score >= 4 ? 'bg-blue-100 text-blue-800 border-blue-200' :
                 'bg-gray-100 text-gray-500 border-gray-200';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', className)}>
      {label}
    </span>
  );
}

export function SphereSyncTaskCard({ task, onUpdate, onEditContact }: SphereSyncTaskCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showTalkingPoints, setShowTalkingPoints] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');

  const handleCompletionChange = (completed: boolean | string) => {
    const isCompleted = completed === true || completed === 'true';
    onUpdate(task.id, { completed: isCompleted });
  };

  const handleNotesUpdate = () => {
    onUpdate(task.id, { notes });
    setShowNotes(false);
  };

  const TaskIcon = task.task_type === 'call' ? Phone : MessageSquare;
  const hasTalkingPoints = task.ai_talking_points && task.ai_talking_points.length > 0;

  return (
    <Card className={cn('mb-3', task.completed && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">

          {/* Left: checkbox + icon + name + AI reason */}
          <div className="flex items-start gap-3 min-w-0">
            <Checkbox
              checked={task.completed}
              onCheckedChange={handleCompletionChange}
              className="mt-1 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <TaskIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <CardTitle className={cn('text-base', task.completed && 'line-through text-muted-foreground')}>
                  {`${task.lead.first_name || ''} ${task.lead.last_name}`.trim()}
                </CardTitle>
                {task.ai_priority_score != null && (
                  <PriorityBadge score={task.ai_priority_score} />
                )}
              </div>
              {task.ai_reason && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {task.ai_reason}
                </p>
              )}
            </div>
          </div>

          {/* Right: edit + category + DNC badges */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditContact}
              className="h-8 w-8 p-0"
              title="Edit Contact"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Badge variant="secondary" className="text-xs">
              {task.lead.category}
            </Badge>
            {task.lead.dnc && (
              <Badge variant="destructive" className="text-xs">DNC</Badge>
            )}
            {task.completed && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                ✓ Done
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">

        {/* Phone + action buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            {task.lead.phone ? (
              <a
                href={`tel:${task.lead.phone}`}
                className="hover:text-primary hover:underline transition-colors"
              >
                {task.lead.phone}
              </a>
            ) : (
              <span>No phone number</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {hasTalkingPoints && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTalkingPoints(!showTalkingPoints)}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <Lightbulb className="h-3 w-3" />
                Talking Points
                {showTalkingPoints ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className="h-7 text-xs"
            >
              {showNotes ? 'Hide Notes' : 'Notes'}
            </Button>
          </div>
        </div>

        {/* Talking points */}
        {showTalkingPoints && hasTalkingPoints && (
          <ul className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
            {task.ai_talking_points!.map((point, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5 shrink-0">•</span>
                {point}
              </li>
            ))}
          </ul>
        )}

        {/* Notes editor */}
        {showNotes && (
          <div className="space-y-2">
            <Textarea
              placeholder="Add notes about this interaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleNotesUpdate}>Save Notes</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNotes(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Existing notes display */}
        {task.notes && !showNotes && (
          <div className="px-3 py-2 bg-muted rounded-md text-xs">
            <span className="font-medium">Notes:</span> {task.notes}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
