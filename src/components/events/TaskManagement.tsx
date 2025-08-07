import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CheckCircle, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { EventTask, useEvents } from '@/hooks/useEvents';
import { TaskForm } from './TaskForm';
import { useToast } from '@/hooks/use-toast';

interface TaskManagementProps {
  eventId: string;
  tasks: EventTask[];
}

export const TaskManagement = ({ eventId, tasks }: TaskManagementProps) => {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const { markTaskComplete, deleteTask } = useEvents();
  const { toast } = useToast();

  const eventTasks = tasks.filter(task => task.event_id === eventId);
  const completedTasks = eventTasks.filter(task => task.status === 'completed');
  const pendingTasks = eventTasks.filter(task => task.status === 'pending');
  
  // Check for overdue tasks
  const now = new Date();
  const overdueTasks = pendingTasks.filter(task => 
    task.due_date && new Date(task.due_date) < now
  );

  // Tasks due soon (within 7 days)
  const urgentTasks = pendingTasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    return daysDiff <= 7 && daysDiff >= 0;
  });

  const progressPercentage = eventTasks.length > 0 
    ? Math.round((completedTasks.length / eventTasks.length) * 100) 
    : 0;

  const handleMarkComplete = async (taskId: string) => {
    try {
      await markTaskComplete(taskId);
      toast({
        title: "Task completed",
        description: "Task has been marked as completed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast({
        title: "Task deleted",
        description: "Task has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete task.",
        variant: "destructive",
      });
    }
  };

  const getTaskStatusBadge = (task: EventTask) => {
    if (task.status === 'completed') {
      return <Badge variant="default">Completed</Badge>;
    }
    
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      if (dueDate < now) {
        return <Badge variant="destructive">Overdue</Badge>;
      }
      
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      if (daysDiff <= 7) {
        return <Badge variant="secondary">Due Soon</Badge>;
      }
    }
    
    return <Badge variant="outline">Pending</Badge>;
  };

  const TaskList = ({ tasks, showActions = true }: { tasks: EventTask[], showActions?: boolean }) => (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">No tasks found</p>
      ) : (
        tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="font-medium">{task.task_name}</h4>
                {getTaskStatusBadge(task)}
              </div>
              <p className="text-sm text-muted-foreground">
                Responsible: {task.responsible_person}
              </p>
              {task.due_date && (
                <p className="text-sm text-muted-foreground">
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </p>
              )}
              {task.completed_at && (
                <p className="text-sm text-muted-foreground">
                  Completed: {new Date(task.completed_at).toLocaleDateString()}
                </p>
              )}
            </div>
            
            {showActions && task.status !== 'completed' && (
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkComplete(task.id)}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteTask(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Task Management</CardTitle>
          <Button onClick={() => setShowTaskForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedTasks.length} of {eventTasks.length} tasks completed
            </span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
        </div>

        {/* Alert for overdue/urgent tasks */}
        {(overdueTasks.length > 0 || urgentTasks.length > 0) && (
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <div className="text-sm">
              {overdueTasks.length > 0 && (
                <p className="text-yellow-800">
                  {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
                </p>
              )}
              {urgentTasks.length > 0 && (
                <p className="text-yellow-800">
                  {urgentTasks.length} task{urgentTasks.length > 1 ? 's' : ''} due soon
                </p>
              )}
            </div>
          </div>
        )}

        {/* Task Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Pending ({pendingTasks.length})</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Completed ({completedTasks.length})</span>
            </TabsTrigger>
            <TabsTrigger value="urgent" className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Urgent ({urgentTasks.length + overdueTasks.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="mt-4">
            <TaskList tasks={pendingTasks} />
          </TabsContent>
          
          <TabsContent value="completed" className="mt-4">
            <TaskList tasks={completedTasks} showActions={false} />
          </TabsContent>
          
          <TabsContent value="urgent" className="mt-4">
            <TaskList tasks={[...overdueTasks, ...urgentTasks]} />
          </TabsContent>
        </Tabs>

        {/* Task Form Modal */}
        {showTaskForm && (
          <TaskForm
            eventId={eventId}
            onClose={() => setShowTaskForm(false)}
          />
        )}
      </CardContent>
    </Card>
  );
};