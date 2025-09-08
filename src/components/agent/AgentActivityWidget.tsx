import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Clock, Calendar, Phone, Users, ArrowRight } from 'lucide-react';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useEvents } from '@/hooks/useEvents';
import { useTransactions } from '@/hooks/useTransactions';

export function AgentActivityWidget() {
  const { callTasks, textTasks } = useSphereSyncTasks();
  const { tasks: eventTasks, getNextEvent } = useEvents();
  const { transactions } = useTransactions();

  // Get today's priority tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaysCallTasks = callTasks.filter(t => 
    !t.completed && 
    new Date(t.created_at).toDateString() === today.toDateString()
  ).slice(0, 3);

  const urgentEventTasks = eventTasks
    .filter(t => t.status === 'pending' && t.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 3);

  const nextEvent = getNextEvent();
  const urgentTransactions = transactions
    .filter(t => t.status === 'ongoing' && t.closing_date)
    .sort((a, b) => new Date(a.closing_date!).getTime() - new Date(b.closing_date!).getTime())
    .slice(0, 2);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Today's Focus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today's Focus
          </CardTitle>
          <CardDescription>Priority tasks for today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaysCallTasks.length > 0 ? (
            <>
              {todaysCallTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{task.lead?.first_name} {task.lead?.last_name}</span>
                  </div>
                  <Badge variant="outline">{task.task_type}</Badge>
                </div>
              ))}
              <Link to="/spheresync-tasks">
                <Button variant="outline" size="sm" className="w-full">
                  View All Tasks <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No tasks for today</p>
              <Link to="/spheresync-tasks">
                <Button variant="outline" size="sm" className="mt-2">
                  Generate Tasks
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Event Deadlines
          </CardTitle>
          <CardDescription>
            {nextEvent ? `Next: ${nextEvent.title}` : 'No upcoming events'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {urgentEventTasks.length > 0 ? (
            <>
              {urgentEventTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{task.task_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                    </p>
                  </div>
                  <Badge variant={
                    task.due_date && new Date(task.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) 
                      ? 'destructive' : 'secondary'
                  }>
                    {task.due_date && new Date(task.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                      ? 'Urgent' : 'Pending'}
                  </Badge>
                </div>
              ))}
              <Link to="/events">
                <Button variant="outline" size="sm" className="w-full">
                  View All Events <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No pending event tasks</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Urgency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Transaction Alerts
          </CardTitle>
          <CardDescription>Deals requiring attention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {urgentTransactions.length > 0 ? (
            <>
              {urgentTransactions.map((transaction) => (
                <div key={transaction.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{transaction.client_name || 'Unknown Client'}</p>
                    <Badge variant="outline">
                      ${Math.round(transaction.sale_price || 0).toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Closing: {transaction.closing_date ? new Date(transaction.closing_date).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
              ))}
              <Link to="/transactions">
                <Button variant="outline" size="sm" className="w-full">
                  View All Transactions <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No urgent transactions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}