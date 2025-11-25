import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Clock, Phone, MessageSquare, ArrowRight, ExternalLink } from 'lucide-react';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';

export function AgentActivityWidget() {
  const { callTasks, textTasks } = useSphereSyncTasks();

  // Get today's priority tasks
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysCallTasks = callTasks.filter(t =>
    !t.completed &&
    new Date(t.created_at).toDateString() === today.toDateString()
  ).slice(0, 5); // Increased from 3 to 5

  const todaysTextTasks = textTasks.filter(t =>
    !t.completed &&
    new Date(t.created_at).toDateString() === today.toDateString()
  ).slice(0, 3);

  // Function to handle phone call
  const handleCall = (phoneNumber: string) => {
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    }
  };

  // Function to handle text message
  const handleText = (phoneNumber: string) => {
    if (phoneNumber) {
      window.open(`sms:${phoneNumber}`, '_self');
    }
  };

  // Function to open contact details
  const handleViewContact = (contactId: string) => {
    // Navigate to database with contact filter
    window.location.href = `/database?contact=${contactId}`;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Today's Focus - Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Today's Call Tasks
          </CardTitle>
          <CardDescription>Priority contacts to call today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaysCallTasks.length > 0 ? (
            <>
              {todaysCallTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {task.lead?.first_name} {task.lead?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.lead?.phone || 'No phone'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {task.lead?.phone && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCall(task.lead.phone!)}
                          className="h-8 w-8 p-0"
                        >
                          <Phone className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleText(task.lead.phone!)}
                          className="h-8 w-8 p-0"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewContact(task.lead_id)}
                      className="h-8 w-8 p-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <Link to="/spheresync-tasks">
                <Button variant="outline" size="sm" className="w-full">
                  View All Call Tasks <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No call tasks for today</p>
              <Link to="/spheresync-tasks">
                <Button variant="outline" size="sm" className="mt-2">
                  Generate Tasks
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Focus - Texts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Today's Text Tasks
          </CardTitle>
          <CardDescription>Contacts to follow up with via text</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaysTextTasks.length > 0 ? (
            <>
              {todaysTextTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {task.lead?.first_name} {task.lead?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {task.lead?.phone || 'No phone'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {task.lead?.phone && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCall(task.lead.phone!)}
                          className="h-8 w-8 p-0"
                        >
                          <Phone className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleText(task.lead.phone!)}
                          className="h-8 w-8 p-0"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewContact(task.lead_id)}
                      className="h-8 w-8 p-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              <Link to="/spheresync-tasks">
                <Button variant="outline" size="sm" className="w-full">
                  View All Text Tasks <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No text tasks for today</p>
              <Link to="/spheresync-tasks">
                <Button variant="outline" size="sm" className="mt-2">
                  Generate Tasks
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}