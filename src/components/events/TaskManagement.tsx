import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, Clock, AlertCircle, Plus, Trash2, Edit, ChevronDown, MessageSquare } from 'lucide-react';
import { EventTask, useEvents } from '@/hooks/useEvents';
import { TaskForm } from './TaskForm';
import { TaskEditForm } from './TaskEditForm';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TaskManagementProps {
  eventId?: string;
  tasks: EventTask[];
}

export function TaskManagement({ eventId, tasks }: TaskManagementProps) {
  const { markTaskComplete, deleteTask, events } = useEvents();
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(eventId || '');
  const [editingTask, setEditingTask] = useState<EventTask | null>(null);

  // Filter tasks based on selected event
  const filteredTasks = selectedEventId 
    ? tasks.filter(task => task.event_id === selectedEventId)
    : tasks;

  const handleMarkComplete = async (taskId: string) => {
    try {
      await markTaskComplete(taskId);
      toast.success('Task marked as complete');
    } catch (error) {
      toast.error('Failed to mark task as complete');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success('Task deleted successfully');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const getTaskStatusBadge = (task: EventTask) => {
    if (task.completed_at) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
    }
    
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      
      if (dueDate < now) {
        return <Badge variant="destructive">Overdue</Badge>;
      }
      
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      if (daysDiff <= 3) {
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Due Soon</Badge>;
      }
    }
    
    return <Badge variant="outline">Pending</Badge>;
  };

  const completedTasks = filteredTasks.filter(task => task.completed_at);
  const totalTasks = filteredTasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Get overdue tasks
  const overdueTasks = filteredTasks.filter(task => {
    if (task.completed_at) return false;
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    return dueDate < new Date();
  });

  // Get urgent tasks (due within 3 days)
  const urgentTasks = filteredTasks.filter(task => {
    if (task.completed_at) return false;
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return dueDate <= threeDaysFromNow && dueDate >= new Date();
  });

  const TaskList: React.FC<{ tasks: EventTask[]; showActions?: boolean }> = ({ 
    tasks, 
    showActions = true 
  }) => (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Collapsible key={task.id}>
          <div className="border rounded-lg">
            <div className="flex items-center justify-between p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{task.task_name}</h4>
                  {getTaskStatusBadge(task)}
                  {task.notes && (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  <p>Responsible: {task.responsible_person}</p>
                  {task.due_date && (
                    <p>Due: {format(new Date(task.due_date), 'PPP')}</p>
                  )}
                  <p>Created: {format(new Date(task.created_at), 'PPP')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {task.notes && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                )}
                {showActions && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setEditingTask(task)}
                      className="h-8 px-3"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!task.completed_at && (
                      <Button 
                        size="sm" 
                        onClick={() => handleMarkComplete(task.id)}
                        className="h-8 px-3"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleDeleteTask(task.id)}
                      className="h-8 px-3"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {task.notes && (
              <CollapsibleContent>
                <div className="px-3 pb-3 border-t bg-muted/20">
                  <div className="pt-3">
                    <p className="text-sm font-medium mb-1">Notes:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.notes}
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            )}
          </div>
        </Collapsible>
      ))}
      {tasks.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No tasks found</p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Event Tasks
          <Button onClick={() => setShowTaskForm(true)} size="sm" disabled={!selectedEventId}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </CardTitle>
        <CardDescription>
          Manage tasks for your events
        </CardDescription>
        
        {/* Event Selection Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Event:</label>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an event to view tasks" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title} - {format(new Date(event.event_date), 'MMM dd, yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        {selectedEventId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedTasks.length} of {totalTasks} tasks completed
              </span>
            </div>
            <Progress value={completionPercentage} className="w-full" />
          </div>
        )}

        {/* Alert for overdue/urgent tasks */}
        {selectedEventId && (overdueTasks.length > 0 || urgentTasks.length > 0) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {overdueTasks.length > 0 && (
                <p>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</p>
              )}
              {urgentTasks.length > 0 && (
                <p>{urgentTasks.length} task{urgentTasks.length > 1 ? 's' : ''} due soon</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {selectedEventId ? (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Pending ({filteredTasks.filter(task => !task.completed_at).length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedTasks.length})
              </TabsTrigger>
              <TabsTrigger value="urgent">
                Urgent ({urgentTasks.length + overdueTasks.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <TaskList tasks={filteredTasks.filter(task => !task.completed_at)} />
            </TabsContent>
            <TabsContent value="completed">
              <TaskList tasks={completedTasks} showActions={false} />
            </TabsContent>
            <TabsContent value="urgent">
              <TaskList tasks={[...overdueTasks, ...urgentTasks]} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>Select an event to view and manage its tasks</p>
          </div>
        )}
      </CardContent>
      
      {showTaskForm && (
        <TaskForm 
          eventId={selectedEventId} 
          onClose={() => setShowTaskForm(false)} 
        />
      )}
      
      {editingTask && (
        <TaskEditForm 
          task={editingTask}
          onClose={() => setEditingTask(null)} 
        />
      )}
    </Card>
  );
}