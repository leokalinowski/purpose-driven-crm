import { useState, useEffect } from "react";
import { format } from 'date-fns';
import { CalendarIcon, Plus, CheckCircle, Clock, MessageSquare, Target, User, Phone, Mail, MapPin, Tag, Shield, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { usePipeline, type Opportunity } from '@/hooks/usePipeline';
import { useOpportunityNotes } from '@/hooks/useOpportunityNotes';
import { useOpportunityActivities } from '@/hooks/useOpportunityActivities';
import { useOpportunityTasks } from '@/hooks/useOpportunityTasks';

interface EditOpportunityDialogProps {
  opportunity: Opportunity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpportunityUpdated: () => void;
}

export function EditOpportunityDialog({
  opportunity,
  open,
  onOpenChange,
  onOpportunityUpdated
}: EditOpportunityDialogProps) {
  const { updateOpportunity, updateContact } = usePipeline();
  const { notes, addNote, updateNote, deleteNote } = useOpportunityNotes(opportunity.id);
  const { activities } = useOpportunityActivities(opportunity.id);
  const { tasks, addTask, updateTask, completeTask } = useOpportunityTasks(opportunity.id);
  const { toast } = useToast();
  
  // Opportunity form state
  const [formData, setFormData] = useState({
    stage: opportunity.stage,
    deal_value: opportunity.deal_value || 0,
    expected_close_date: opportunity.expected_close_date || '',
    notes: opportunity.notes || ''
  });

  // Contact form state
  const [contactData, setContactData] = useState({
    first_name: opportunity.contact?.first_name || '',
    last_name: opportunity.contact?.last_name || '',
    email: opportunity.contact?.email || '',
    phone: opportunity.contact?.phone || '',
    address_1: opportunity.contact?.address_1 || '',
    address_2: opportunity.contact?.address_2 || '',
    city: opportunity.contact?.city || '',
    state: opportunity.contact?.state || '',
    zip_code: opportunity.contact?.zip_code || '',
    tags: opportunity.contact?.tags || [],
    notes: opportunity.contact?.notes || ''
  });

  // Note form state
  const [newNote, setNewNote] = useState({ text: '', type: 'general' });
  
  // Task form state
  const [newTask, setNewTask] = useState({
    task_name: '',
    description: '',
    due_date: '',
    priority: 'medium'
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [contactEdited, setContactEdited] = useState(false);

  useEffect(() => {
    setFormData({
      stage: opportunity.stage,
      deal_value: opportunity.deal_value || 0,
      expected_close_date: opportunity.expected_close_date || '',
      notes: opportunity.notes || ''
    });
    
    setContactData({
      first_name: opportunity.contact?.first_name || '',
      last_name: opportunity.contact?.last_name || '',
      email: opportunity.contact?.email || '',
      phone: opportunity.contact?.phone || '',
      address_1: opportunity.contact?.address_1 || '',
      address_2: opportunity.contact?.address_2 || '',
      city: opportunity.contact?.city || '',
      state: opportunity.contact?.state || '',
      zip_code: opportunity.contact?.zip_code || '',
      tags: opportunity.contact?.tags || [],
      notes: opportunity.contact?.notes || ''
    });
  }, [opportunity]);

  const handleOpportunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await updateOpportunity(opportunity.id, formData);
    if (success) {
      setHasUnsavedChanges(false);
      onOpportunityUpdated();
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity.contact_id) return;
    
    const success = await updateContact(opportunity.contact_id, contactData);
    if (success) {
      setContactEdited(false);
      onOpportunityUpdated();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.text.trim()) return;
    
    const success = await addNote(newNote.text, newNote.type);
    if (success) {
      setNewNote({ text: '', type: 'general' });
    }
  };

  const handleAddTask = async () => {
    if (!newTask.task_name.trim()) return;
    
    const success = await addTask(newTask);
    if (success) {
      setNewTask({ task_name: '', description: '', due_date: '', priority: 'medium' });
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'created': return <Plus className="h-4 w-4" />;
      case 'stage_change': return <Target className="h-4 w-4" />;
      case 'note_added': return <MessageSquare className="h-4 w-4" />;
      case 'task_completed': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const allActivities = [
    ...activities.map(a => ({ ...a, type: 'activity' })),
    ...notes.map(n => ({ ...n, type: 'note', activity_date: n.created_at })),
    ...tasks.map(t => ({ ...t, type: 'task', activity_date: t.created_at }))
  ].sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime());

  const getDNCStatus = () => {
    if (!opportunity.contact?.dnc_last_checked) {
      return { icon: Shield, color: 'text-yellow-500', bg: 'bg-yellow-100', text: 'Not Checked' };
    }
    if (opportunity.contact?.dnc) {
      return { icon: Shield, color: 'text-red-500', bg: 'bg-red-100', text: 'Do Not Call' };
    }
    return { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-100', text: 'Safe to Call' };
  };

  const dncStatus = getDNCStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {opportunity.contact?.first_name} {opportunity.contact?.last_name}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="opportunity" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="opportunity">Opportunity</TabsTrigger>
            <TabsTrigger value="contact">Contact Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunity" className="space-y-4">
            <form onSubmit={handleOpportunitySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(value) => {
                    setFormData({ ...formData, stage: value as any });
                    setHasUnsavedChanges(true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deal_value">Deal Value ($)</Label>
                <Input
                  id="deal_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.deal_value}
                  onChange={(e) => {
                    setFormData({ ...formData, deal_value: parseFloat(e.target.value) || 0 });
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_close_date">Expected Close Date</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Opportunity Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about discussions, follow-ups, or important details..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Update Opportunity
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                {opportunity.contact?.dnc && <Badge variant="destructive">Do Not Call</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={contactData.first_name}
                    onChange={(e) => {
                      setContactData({ ...contactData, first_name: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={contactData.last_name}
                    onChange={(e) => {
                      setContactData({ ...contactData, last_name: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactData.email}
                    onChange={(e) => {
                      setContactData({ ...contactData, email: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="Email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={contactData.phone}
                    onChange={(e) => {
                      setContactData({ ...contactData, phone: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={!contactEdited}>
                  Save Contact Changes
                </Button>
                <Button type="button" variant="outline" onClick={() => setContactEdited(false)} disabled={!contactEdited}>
                  Cancel Changes
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={newTask.task_name}
                  onChange={(e) => setNewTask({ ...newTask, task_name: e.target.value })}
                  placeholder="Task name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddTask} size="sm" className="w-full">
                  Add Task
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {allActivities.slice(0, 10).map((item, index) => (
                      <div key={`${item.type}-${item.id}-${index}`} className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          {item.type === 'activity' && getActivityIcon(item.activity_type)}
                          {item.type === 'note' && <MessageSquare className="h-4 w-4" />}
                          {item.type === 'task' && <CheckCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(item.activity_date)}
                          </p>
                          <p className="text-sm">
                            {item.type === 'activity' && item.description}
                            {item.type === 'note' && `Note: ${item.note_text?.substring(0, 50)}...`}
                            {item.type === 'task' && `Task: ${item.task_name}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}