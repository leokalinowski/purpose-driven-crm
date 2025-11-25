import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SphereSyncTaskCard } from '@/components/spheresync/SphereSyncTaskCard';
import { UpcomingTasksPreview } from '@/components/spheresync/UpcomingTasksPreview';
import { ContactForm } from '@/components/database/ContactForm';
import { useSphereSyncTasks, SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { useContacts } from '@/hooks/useContacts';
import { useConfetti } from '@/hooks/useConfetti';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { Phone, MessageSquare, Calendar, BarChart3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function SphereSyncTasks() {
  const { user } = useAuth();
  const { triggerConfetti, triggerCelebration } = useConfetti();
  const {
    callTasks,
    textTasks,
    contacts,
    loading,
    currentWeek,
    historicalStats,
    updateTask,
    refreshTasks
  } = useSphereSyncTasks();
  
  const { updateContact, deleteContact } = useContacts();
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);

  const previousCompletionRate = useRef<number>(0);
  const hasTriggeredConfetti = useRef<boolean>(false);

  const totalTasks = callTasks.length + textTasks.length;
  const completedTasks = [...callTasks, ...textTasks].filter(task => task.completed).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const handleEditContact = (task: SphereSyncTask) => {
    const contactForEdit = {
      id: task.lead_id,
      first_name: task.lead.first_name,
      last_name: task.lead.last_name,
      phone: task.lead.phone,
      email: '',
      category: task.lead.category,
      dnc: task.lead.dnc,
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      zip_code: '',
      notes: '',
      tags: [],
      agent_id: user?.id
    };
    
    setEditingContact(contactForEdit);
    setContactFormOpen(true);
  };

  const handleContactUpdate = async (contactData: any) => {
    try {
      await updateContact(editingContact.id, contactData);
      toast.success('Contact updated successfully');
      setContactFormOpen(false);
      setEditingContact(null);
      await refreshTasks();
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Failed to update contact');
    }
  };

  const handleContactDelete = async () => {
    if (!editingContact) return;

    try {
      await deleteContact(editingContact.id);
      toast.success('Contact deleted successfully');
      setContactFormOpen(false);
      setEditingContact(null);
      await refreshTasks();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
      throw error; // Re-throw to prevent dialog from closing
    }
  };

  // Trigger confetti when completion reaches 100%
  useEffect(() => {
    if (totalTasks > 0 && completionRate >= 100 && previousCompletionRate.current < 100) {
      // Only trigger if we haven't already triggered confetti for this week
      if (!hasTriggeredConfetti.current) {
        triggerCelebration();
        hasTriggeredConfetti.current = true;
        
        // Show a celebration message
        setTimeout(() => {
          // You could add a toast notification here if desired
          console.log('🎉 Congratulations! All weekly tasks completed! 🎉');
        }, 1000);
      }
    }
    
    // Reset confetti trigger when starting a new week or when tasks are regenerated
    if (completionRate === 0 && previousCompletionRate.current > 0) {
      hasTriggeredConfetti.current = false;
    }
    
    previousCompletionRate.current = completionRate;
  }, [completionRate, totalTasks, triggerCelebration]);

  if (!user) {
    return (
      <Layout>
        <Card>
          <CardContent className="p-6">
            <p>Please sign in to access SphereSync tasks.</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">SphereSync</h1>
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
              <div className="text-2xl font-bold flex items-center gap-2">
                {Math.round(completionRate)}%
                {completionRate >= 100 && (
                  <span className="text-primary text-lg">
                    Complete!
                  </span>
                )}
              </div>
              <Progress 
                value={completionRate} 
                className="mt-2"
              />
              {completionRate >= 100 && (
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  Congratulations! All weekly tasks completed!
                </p>
              )}
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
                <div className="space-y-3">
                  <p className="font-medium">No call tasks this week</p>
                  <p className="text-sm text-muted-foreground">
                    Your contacts don't match this week's call categories ({currentWeek.callCategories.join(', ')}). 
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tasks are assigned based on the first letter of your contacts' last names. Add more contacts or wait for the next week's rotation to see tasks here.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {callTasks.map((task) => (
                <SphereSyncTaskCard
                  key={task.id}
                  task={task}
                  onUpdate={updateTask}
                  onEditContact={() => handleEditContact(task)}
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
                <div className="space-y-3">
                  <p className="font-medium">No text tasks this week</p>
                  <p className="text-sm text-muted-foreground">
                    Your contacts don't match this week's text category ({currentWeek.textCategory}). 
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tasks are assigned based on the first letter of your contacts' last names. Add more contacts or wait for the next week's rotation to see tasks here.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {textTasks.map((task) => (
                <SphereSyncTaskCard
                  key={task.id}
                  task={task}
                  onUpdate={updateTask}
                  onEditContact={() => handleEditContact(task)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upcoming Tasks Preview */}
      <UpcomingTasksPreview contacts={contacts} />

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
      
      <ContactForm
        open={contactFormOpen}
        onOpenChange={setContactFormOpen}
        contact={editingContact}
        onSubmit={handleContactUpdate}
        onDelete={handleContactDelete}
        title="Edit Contact"
      />
    </Layout>
  );
}