import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';

interface TaskFormProps {
  eventId: string;
  onClose: () => void;
}

export const TaskForm = ({ eventId, onClose }: TaskFormProps) => {
  const [taskName, setTaskName] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { addTask } = useEvents();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || !responsiblePerson.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await addTask({
        event_id: eventId,
        task_name: taskName.trim(),
        responsible_person: responsiblePerson.trim(),
        due_date: dueDate || undefined,
        status: 'pending'
      });

      toast({
        title: "Task added",
        description: "Task has been added successfully.",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taskName">Task Name *</Label>
            <Input
              id="taskName"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Enter task name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsiblePerson">Responsible Person *</Label>
            <Input
              id="responsiblePerson"
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              placeholder="Enter responsible person"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};