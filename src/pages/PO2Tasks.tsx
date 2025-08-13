import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, MessageSquare, RefreshCw, Calendar, Users } from 'lucide-react';
import { usePO2Tasks } from '@/hooks/usePO2Tasks';
import { PO2TaskCard } from '@/components/po2/PO2TaskCard';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';

export default function PO2Tasks() {
  const { user } = useAuth();
  const {
    callTasks,
    textTasks,
    loading,
    generatingTasks,
    currentWeek,
    generateWeeklyTasks,
    updateTask,
    refreshTasks
  } = usePO2Tasks();

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please log in to view your PO2 tasks.</p>
        </div>
      </Layout>
    );
  }

  // Auto-generate if no tasks
  useEffect(() => {
    if (!loading && callTasks.length === 0 && textTasks.length === 0 && !generatingTasks) {
      generateWeeklyTasks();
    }
  }, [loading, callTasks.length, textTasks.length, generatingTasks]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PO2 Tasks</h1>
            <p className="text-muted-foreground">
              Weekly call and text assignments based on lead categories
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={refreshTasks}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={generateWeeklyTasks}
              disabled={generatingTasks || loading}
            >
              {generatingTasks ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Generate Week {currentWeek.weekNumber} Tasks
            </Button>
          </div>
        </div>

        {/* Week Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Week {currentWeek.weekNumber} - {new Date().getFullYear()}
            </CardTitle>
            <CardDescription>
              Current week's categories and assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Call Categories
                </h3>
                <div className="flex gap-2">
                  {currentWeek.callCategories.map(category => (
                    <Badge key={category} variant="outline">
                      {category}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {callTasks.length} leads to call
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Text Category
                </h3>
                <Badge variant="outline">
                  {currentWeek.textCategory}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {textTasks.length} leads to text
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Tabs */}
        <Tabs defaultValue="calls" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calls" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Calls ({callTasks.length})
            </TabsTrigger>
            <TabsTrigger value="texts" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Texts ({textTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calls" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Call Tasks</CardTitle>
                <CardDescription>
                  Leads to call for week {currentWeek.weekNumber} (Categories: {currentWeek.callCategories.join(', ')})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading tasks...
                  </div>
                ) : callTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No call tasks for this week.</p>
                    <p className="text-sm">
                      Try generating weekly tasks or check if you have leads in categories {currentWeek.callCategories.join(', ')}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callTasks.map(task => (
                      <PO2TaskCard
                        key={task.id}
                        task={task}
                        onUpdate={updateTask}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="texts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Text Tasks</CardTitle>
                <CardDescription>
                  Leads to text for week {currentWeek.weekNumber} (Category: {currentWeek.textCategory})
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading tasks...
                  </div>
                ) : textTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No text tasks for this week.</p>
                    <p className="text-sm">
                      Try generating weekly tasks or check if you have leads in category {currentWeek.textCategory}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {textTasks.map(task => (
                      <PO2TaskCard
                        key={task.id}
                        task={task}
                        onUpdate={updateTask}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}