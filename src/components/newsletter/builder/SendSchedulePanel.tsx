import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Clock, TestTube, CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SendSchedulePanelProps {
  open: boolean;
  onClose: () => void;
  templateId?: string;
  templateName: string;
}

export function SendSchedulePanel({ open, onClose, templateId, templateName }: SendSchedulePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [senderName, setSenderName] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'tag'>('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Load agent profile for sender name
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setSenderName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
      }
    })();
  }, [user]);

  // Load available tags from contacts
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('tags')
        .eq('agent_id', user.id)
        .not('tags', 'is', null);
      if (data) {
        const allTags = new Set<string>();
        data.forEach(c => (c.tags || []).forEach((t: string) => allTags.add(t)));
        setAvailableTags(Array.from(allTags).sort());
      }
    })();
  }, [user]);

  const handleSendTest = async () => {
    if (!user || !templateId) {
      toast({ title: 'Please save the template first', variant: 'destructive' });
      return;
    }
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('newsletter-template-send', {
        body: {
          template_id: templateId,
          agent_id: user.id,
          subject: subject || templateName,
          sender_name: senderName,
          test_mode: true,
          test_email: user.email,
        },
      });
      if (error) throw error;
      toast({ title: 'Test email sent!', description: `Check ${user.email}` });
    } catch (err: any) {
      toast({ title: 'Test send failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSchedule = async () => {
    if (!user || !templateId) {
      toast({ title: 'Please save the template first', variant: 'destructive' });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Subject line is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let scheduledAt: string | null = null;
      if (sendMode === 'scheduled' && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const dt = new Date(scheduledDate);
        dt.setHours(hours, minutes, 0, 0);
        scheduledAt = dt.toISOString();
      }

      const filter = recipientFilter === 'tag' && selectedTag
        ? { type: 'tag', tag: selectedTag }
        : { type: 'all' };

      const { error } = await supabase.from('newsletter_schedules').insert({
        template_id: templateId,
        agent_id: user.id,
        subject,
        sender_name: senderName,
        recipient_filter: filter,
        scheduled_at: scheduledAt,
        status: sendMode === 'now' ? 'sending' : 'scheduled',
      });
      if (error) throw error;

      if (sendMode === 'now') {
        // Trigger the send edge function
        await supabase.functions.invoke('newsletter-template-send', {
          body: {
            template_id: templateId,
            agent_id: user.id,
            subject,
            sender_name: senderName,
            recipient_filter: filter,
          },
        });
        toast({ title: 'Newsletter sending!', description: 'Your newsletter is being sent to recipients.' });
      } else {
        toast({ title: 'Newsletter scheduled!', description: `Scheduled for ${scheduledAt ? format(new Date(scheduledAt), 'PPP p') : 'later'}` });
      }
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to schedule', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Newsletter
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subject Line *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your monthly market update" />
          </div>

          {/* Sender */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Sender Name</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your Name" />
            <p className="text-xs text-muted-foreground">Sent from news.realestateonpurpose.com</p>
          </div>

          {/* Recipients */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Recipients</Label>
            <Select value={recipientFilter} onValueChange={(v: 'all' | 'tag') => setRecipientFilter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All my contacts (with email)</SelectItem>
                <SelectItem value="tag">Filter by tag</SelectItem>
              </SelectContent>
            </Select>
            {recipientFilter === 'tag' && (
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger><SelectValue placeholder="Select a tag..." /></SelectTrigger>
                <SelectContent>
                  {availableTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">When to Send</Label>
            <Select value={sendMode} onValueChange={(v: 'now' | 'scheduled') => setSendMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Send Now</SelectItem>
                <SelectItem value="scheduled">Schedule for Later</SelectItem>
              </SelectContent>
            </Select>
            {sendMode === 'scheduled' && (
              <div className="flex gap-2 mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} initialFocus />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-[120px]"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest || !templateId} className="flex-1">
              {sendingTest ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TestTube className="h-4 w-4 mr-1" />}
              Send Test
            </Button>
            <Button size="sm" onClick={handleSchedule} disabled={saving || !subject.trim()} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : sendMode === 'now' ? <Send className="h-4 w-4 mr-1" /> : <Clock className="h-4 w-4 mr-1" />}
              {sendMode === 'now' ? 'Send Now' : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
