import { useState, useEffect } from "react";
import { format } from 'date-fns';
import { CalendarIcon, Plus, CheckCircle, Clock, MessageSquare, Target, User, Phone, Mail, MapPin, Tag, Shield, ShieldCheck, Edit, Trash2 } from 'lucide-react';
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


interface EditOpportunityDialogProps {
  opportunity: Opportunity | null;
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
  const { toast } = useToast();
  
  // Always call hooks - use empty string as fallback for opportunity ID
  const opportunityId = opportunity?.id || '';
  const { notes, addNote, updateNote, deleteNote } = useOpportunityNotes(opportunityId);
  const { activities } = useOpportunityActivities(opportunityId);
  
  
  // Opportunity form state
  const [formData, setFormData] = useState({
    stage: 'lead' as 'lead' | 'qualified' | 'appointment' | 'contract' | 'closed',
    deal_value: 0,
    expected_close_date: ''
  });

  // Contact form state
  const [contactData, setContactData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    zip_code: '',
    tags: [] as string[],
    notes: ''
  });

  // Note form state
  const [newNote, setNewNote] = useState({ text: '', type: 'general' });
  

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [contactEdited, setContactEdited] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setFormData({
        stage: opportunity.stage,
        deal_value: opportunity.deal_value || 0,
        expected_close_date: opportunity.expected_close_date || ''
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
    }
  }, [opportunity]);

  // Early return AFTER all hooks have been called
  if (!opportunity) {
    return null;
  }

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



  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'lead': return 'bg-muted text-muted-foreground';
      case 'qualified': return 'bg-primary text-primary-foreground';
      case 'appointment': return 'bg-secondary text-secondary-foreground';
      case 'contract': return 'bg-accent text-accent-foreground';
      case 'closed': return 'bg-primary text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getDNCStatus = () => {
    if (!opportunity.contact?.dnc_last_checked) {
      return { icon: Shield, color: 'text-muted-foreground', bg: 'bg-muted', text: 'Not Checked' };
    }
    if (opportunity.contact?.dnc) {
      return { icon: Shield, color: 'text-destructive', bg: 'bg-destructive/10', text: 'Do Not Call' };
    }
    return { icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10', text: 'Safe to Call' };
  };

  const dncStatus = getDNCStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <User className="h-6 w-6 text-primary" />
            <span>{opportunity.contact?.first_name} {opportunity.contact?.last_name}</span>
            <Badge variant="outline" className={`${getStageColor(opportunity.stage)} capitalize ml-auto`}>
              {opportunity.stage}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="opportunity" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="opportunity" className="text-sm">Opportunity</TabsTrigger>
            <TabsTrigger value="contact" className="text-sm">Contact Details</TabsTrigger>
            <TabsTrigger value="activity" className="text-sm">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunity" className="flex-1 overflow-y-auto">
            <form onSubmit={handleOpportunitySubmit} className="space-y-6">
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

          <TabsContent value="contact" className="flex-1 overflow-y-auto">
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <div className="flex items-center gap-2">
                  <dncStatus.icon className={`h-4 w-4 ${dncStatus.color}`} />
                  <Badge variant={opportunity.contact?.dnc ? "destructive" : "secondary"} className={dncStatus.color}>
                    {dncStatus.text}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="address_1">Address Line 1</Label>
                <Input
                  id="address_1"
                  value={contactData.address_1}
                  onChange={(e) => {
                    setContactData({ ...contactData, address_1: e.target.value });
                    setContactEdited(true);
                  }}
                  placeholder="Street address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_2">Address Line 2</Label>
                <Input
                  id="address_2"
                  value={contactData.address_2}
                  onChange={(e) => {
                    setContactData({ ...contactData, address_2: e.target.value });
                    setContactEdited(true);
                  }}
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={contactData.city}
                    onChange={(e) => {
                      setContactData({ ...contactData, city: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={contactData.state}
                    onChange={(e) => {
                      setContactData({ ...contactData, state: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={contactData.zip_code}
                    onChange={(e) => {
                      setContactData({ ...contactData, zip_code: e.target.value });
                      setContactEdited(true);
                    }}
                    placeholder="Zip code"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {contactData.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Enter tags separated by commas"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const value = e.currentTarget.value.trim();
                      if (value && !contactData.tags.includes(value)) {
                        setContactData({ ...contactData, tags: [...contactData.tags, value] });
                        setContactEdited(true);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_notes">Contact Notes</Label>
                <Textarea
                  id="contact_notes"
                  value={contactData.notes}
                  onChange={(e) => {
                    setContactData({ ...contactData, notes: e.target.value });
                    setContactEdited(true);
                  }}
                  placeholder="Notes about this contact..."
                  rows={3}
                />
              </div>

              {opportunity.contact?.dnc_last_checked && (
                <div className="text-xs text-muted-foreground">
                  DNC last checked: {format(new Date(opportunity.contact.dnc_last_checked), 'MMM dd, yyyy HH:mm')}
                </div>
              )}

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

          <TabsContent value="activity" className="flex-1 overflow-y-auto space-y-6">
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Add Note
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={newNote.text}
                  onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                  placeholder="Add a note about this opportunity..."
                  rows={3}
                  className="resize-none"
                />
                <div className="flex gap-3">
                  <Select value={newNote.type} onValueChange={(value) => setNewNote({ ...newNote, type: value })}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddNote} size="default" className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes & Activity History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {notes.length === 0 && activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                    ) : (
                      <>
                        {notes.map((note) => (
                          <div key={`note-${note.id}`} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                            <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {note.note_type}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(note.created_at)}
                                </p>
                              </div>
                              <p className="text-sm break-words">{note.note_text}</p>
                            </div>
                          </div>
                        ))}
                        {activities.map((activity) => (
                          <div key={`activity-${activity.id}`} className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {getActivityIcon(activity.activity_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(activity.activity_date)}
                              </p>
                              <p className="text-sm font-medium">{activity.activity_type.replace('_', ' ')}</p>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground">{activity.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
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
