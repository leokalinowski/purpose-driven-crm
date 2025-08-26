import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SphereSyncTaskCard } from '@/components/spheresync/SphereSyncTaskCard';
import { useSphereSyncTasks } from '@/hooks/useSphereSyncTasks';
import { useAuth } from '@/hooks/useAuth';
import { Phone, MessageSquare, Calendar, BarChart3 } from 'lucide-react';

export default function SphereSyncTasks() {
  const { user } = useAuth();
  const {
    callTasks,
    textTasks,
    loading,
    currentWeek,
    historicalStats,
    updateTask
  } = useSphereSyncTasks();

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Please sign in to access SphereSync tasks.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTasks = callTasks.length + textTasks.length;
  const completedTasks = [...callTasks, ...textTasks].filter(task => task.completed).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">SphereSync Tasks</h1>
          <p className="text-muted-foreground">
            Balanced contact assignment system based on surname frequency analysis
          </p>
        </div>

        {/* Current Week Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Current Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Week {currentWeek.weekNumber}</div>
              <p className="text-xs text-muted-foreground">
                Calls: {currentWeek.callCategories.join(', ')} | Text: {currentWeek.textCategory}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Call Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{callTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                {callTasks.filter(task => task.completed).length} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Text Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{textTasks.length}</div>
              <p className="text-xs text-muted-foreground">
                {textTasks.filter(task => task.completed).length} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(completionRate)}%</div>
              <Progress value={completionRate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tasks Tabs */}
      <Tabs defaultValue="calls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Calls ({callTasks.length})
          </TabsTrigger>
          <TabsTrigger value="texts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Texts ({textTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <p>Loading call tasks...</p>
              </CardContent>
            </Card>
          ) : callTasks.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p>No call tasks for this week. Tasks are automatically generated every Monday.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {callTasks.map((task) => (
                <SphereSyncTaskCard
                  key={task.id}
                  task={task}
                  onUpdate={updateTask}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="texts">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <p>Loading text tasks...</p>
              </CardContent>
            </Card>
          ) : textTasks.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p>No text tasks for this week. Tasks are automatically generated every Monday.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {textTasks.map((task) => (
                <SphereSyncTaskCard
                  key={task.id}
                  task={task}
                  onUpdate={updateTask}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Historical Performance */}
      {historicalStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Performance</CardTitle>
            <CardDescription>Your SphereSync completion rates over the past weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="historical-stats">
                <AccordionTrigger>View Past Performance</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {historicalStats.map((stat) => (
                      <div key={`${stat.year}-${stat.week}`} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">
                            Week {stat.week}, {stat.year}
                          </Badge>
                          <div className="text-sm text-muted-foreground">
                            {stat.completedTasks}/{stat.totalTasks} tasks completed
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-medium">{Math.round(stat.completionRate)}%</div>
                            <Progress value={stat.completionRate} className="w-20 h-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}