import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, MessageSquare, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { SphereSyncTaskCard } from '@/components/spheresync/SphereSyncTaskCard';
import { UpcomingTasksPreview } from '@/components/spheresync/UpcomingTasksPreview';
import { ContactForm } from '@/components/database/ContactForm';
import { useSphereSyncTasks, SphereSyncTask } from '@/hooks/useSphereSyncTasks';
import { useContacts } from '@/hooks/useContacts';
import { useConfetti } from '@/hooks/useConfetti';
import { useAuth } from '@/hooks/useAuth';
import { getWeekRange, getCallCategoriesForWeek, getTextCategoryForWeek } from '@/utils/sphereSyncLogic';

export function SphereCadenceTab() {
  const { user } = useAuth();
  const { triggerCelebration } = useConfetti();
  const {
    callTasks,
    textTasks,
    contacts,
    loading,
    currentWeek,
    historicalStats,
    selectedWeek,
    loadTasksForWeek,
    updateTask,
    refreshTasks,
  } = useSphereSyncTasks();

  const { updateContact, deleteContact } = useContacts();
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);

  const previousCompletionRate = useRef<number>(0);
  const hasTriggeredConfetti = useRef<boolean>(false);

  const totalTasks = callTasks.length + textTasks.length;
  const completedTasks = [...callTasks, ...textTasks].filter(task => task.completed).length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const weekRange = getWeekRange(2);
  const selectedWeekInfo =
    weekRange.find(w => w.weekNumber === selectedWeek?.weekNumber && w.year === selectedWeek?.year) ||
    weekRange[0];

  const selectedWeekCategories = selectedWeek
    ? {
        callCategories: getCallCategoriesForWeek(selectedWeek.weekNumber),
        textCategory: getTextCategoryForWeek(selectedWeek.weekNumber),
      }
    : currentWeek;

  const handleWeekChange = (value: string) => {
    const [weekNum, year] = value.split('-').map(Number);
    loadTasksForWeek(weekNum, year);
  };

  const handleEditContact = (task: SphereSyncTask) => {
    setEditingContact({
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
      agent_id: user?.id,
    });
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
      throw error;
    }
  };

  useEffect(() => {
    if (totalTasks > 0 && completionRate >= 100 && previousCompletionRate.current < 100) {
      if (!hasTriggeredConfetti.current) {
        triggerCelebration();
        hasTriggeredConfetti.current = true;
      }
    }
    if (completionRate === 0 && previousCompletionRate.current > 0) {
      hasTriggeredConfetti.current = false;
    }
    previousCompletionRate.current = completionRate;
  }, [completionRate, totalTasks, triggerCelebration]);

  return (
    <>
      <div className="space-y-6">
        {/* Week selector */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
            Weekly calls and texts — balanced by the first letter of each contact's last name.
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">Week:</label>
            <Select
              value={selectedWeek ? `${selectedWeek.weekNumber}-${selectedWeek.year}` : undefined}
              onValueChange={handleWeekChange}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {weekRange.map((week) => (
                  <SelectItem key={`${week.weekNumber}-${week.year}`} value={`${week.weekNumber}-${week.year}`}>
                    {week.label} - {week.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: <Calendar className="h-4 w-4 text-primary" />,
              label: selectedWeekInfo.label.split('(')[0].trim(),
              value: `Week ${selectedWeek?.weekNumber}`,
              sub: `Calls: ${selectedWeekCategories.callCategories.join(', ')} · Text: ${selectedWeekCategories.textCategory}`,
            },
            {
              icon: <Phone className="h-4 w-4 text-primary" />,
              label: 'Call Tasks',
              value: String(callTasks.length),
              sub: `${callTasks.filter(t => t.completed).length} completed`,
            },
            {
              icon: <MessageSquare className="h-4 w-4 text-primary" />,
              label: 'Text Tasks',
              value: String(textTasks.length),
              sub: `${textTasks.filter(t => t.completed).length} completed`,
            },
            {
              icon: <BarChart3 className="h-4 w-4 text-primary" />,
              label: 'Progress',
              value: `${Math.round(completionRate)}%`,
              sub: completionRate >= 100 ? 'All done — great week!' : `${completedTasks} of ${totalTasks} tasks`,
              accent: completionRate >= 100,
            },
          ].map(({ icon, label, value, sub, accent }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">
                {icon}{label}
              </div>
              <div className={`text-2xl font-semibold leading-none mb-1 ${accent ? 'text-reop-green' : 'text-foreground'}`}>{value}</div>
              <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p>
              {label === 'Progress' && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, completionRate)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Calls / Texts */}
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
                <CardContent className="p-6"><p>Loading call tasks...</p></CardContent>
              </Card>
            ) : callTasks.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <p className="font-medium">No call tasks for this week</p>
                    <p className="text-sm text-muted-foreground">
                      Your contacts don't match this week's call categories ({selectedWeekCategories.callCategories.join(', ')}).
                    </p>
                    {selectedWeek?.weekNumber !== currentWeek.weekNumber && (
                      <p className="text-sm text-muted-foreground">
                        This is a past week. You can still complete tasks here if you need to follow up.
                      </p>
                    )}
                    {selectedWeek?.weekNumber === currentWeek.weekNumber && (
                      <p className="text-sm text-muted-foreground">
                        Tasks are assigned based on the first letter of your contacts' last names. Add more contacts or wait for the next week's rotation to see tasks here.
                      </p>
                    )}
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
                <CardContent className="p-6"><p>Loading text tasks...</p></CardContent>
              </Card>
            ) : textTasks.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <p className="font-medium">No text tasks for this week</p>
                    <p className="text-sm text-muted-foreground">
                      Your contacts don't match this week's text category ({selectedWeekCategories.textCategory}).
                    </p>
                    {selectedWeek?.weekNumber !== currentWeek.weekNumber && (
                      <p className="text-sm text-muted-foreground">
                        This is a past week. You can still complete tasks here if you need to follow up.
                      </p>
                    )}
                    {selectedWeek?.weekNumber === currentWeek.weekNumber && (
                      <p className="text-sm text-muted-foreground">
                        Tasks are assigned based on the first letter of your contacts' last names. Add more contacts or wait for the next week's rotation to see tasks here.
                      </p>
                    )}
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

        {/* Upcoming */}
        <UpcomingTasksPreview contacts={contacts} />

        {/* Historical */}
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
                            <Badge variant="outline">Week {stat.week}, {stat.year}</Badge>
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
    </>
  );
}
