import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Phone, MessageSquare, User } from 'lucide-react';
import { PO2Task } from '@/hooks/usePO2Tasks';

interface PO2TaskCardProps {
  task: PO2Task;
  onUpdate: (taskId: string, updates: Partial<PO2Task>) => void;
}

export function PO2TaskCard({ task, onUpdate }: PO2TaskCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');

  const handleCompletionChange = (completed: boolean) => {
    onUpdate(task.id, { completed });
  };

  const handleNotesUpdate = () => {
    onUpdate(task.id, { notes });
    setShowNotes(false);
  };

  const taskIcon = task.task_type === 'call' ? Phone : MessageSquare;
  const TaskIcon = taskIcon;

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={task.completed}
              onCheckedChange={handleCompletionChange}
              className="mt-1"
            />
            <div className="flex items-center gap-2">
              <TaskIcon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                {task.lead.name || `${task.lead.first_name || ''} ${task.lead.last_name}`.trim()}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-muted px-2 py-1 rounded">
              Category: {task.lead.category}
            </span>
            {task.completed && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                ✓ Complete
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{task.lead.phone_number || 'No phone number'}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
          >
            {showNotes ? 'Hide Notes' : 'Add Notes'}
          </Button>
        </div>

        {showNotes && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Add notes about this interaction..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleNotesUpdate}>
                Save Notes
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowNotes(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {task.notes && !showNotes && (
          <div className="mt-3 p-2 bg-muted rounded text-sm">
            <strong>Notes:</strong> {task.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}