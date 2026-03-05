import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, TestTube, Loader2, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SendSchedulePanelProps {
  open: boolean;
  onClose: () => void;
  templateId?: string;
  templateName: string;
  agentId?: string;
}

export function SendSchedulePanel({ open, onClose, templateId, templateName, agentId }: SendSchedulePanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [senderName, setSenderName] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'tag'>('all');
  const [selectedTag, setSelectedTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduling, setScheduling] = useState(false);

  const effectiveAgentId = agentId || user?.id;

  // Load agent profile for sender name
  useEffect(() => {
    if (!effectiveAgentId) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', effectiveAgentId)
        .single();
      if (data) {
        setSenderName(`${data.first_name || ''} ${data.last_name || ''}`.trim());
      }
    })();
  }, [effectiveAgentId]);

  // Load available tags from agent's contacts
  useEffect(() => {
    if (!effectiveAgentId) return;
    (async () => {
      const { data } = await supabase
        .from('contacts')
        .select('tags')
        .eq('agent_id', effectiveAgentId)
        .not('tags', 'is', null);
      if (data) {
        const allTags = new Set<string>();
        data.forEach(c => (c.tags || []).forEach((t: string) => allTags.add(t)));
        setAvailableTags(Array.from(allTags).sort());
      }
    })();
  }, [effectiveAgentId]);

  // Load recipient count based on filter
  useEffect(() => {
    if (!effectiveAgentId || !open) return;
    setRecipientCount(null);
    (async () => {
      let query = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', effectiveAgentId)
        .not('email', 'is', null)
        .neq('email', '');

      if (recipientFilter === 'tag' && selectedTag) {
        query = query.contains('tags', [selectedTag]);
      }

      const { count } = await query;
      setRecipientCount(count ?? 0);
    })();
  }, [effectiveAgentId, recipientFilter, selectedTag, open]);

  const handleSendTest = async () => {
    if (!user || !templateId || !effectiveAgentId) {
      toast({ title: 'Please save the template first', variant: 'destructive' });
      return;
    }
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('newsletter-template-send', {
        body: {
          template_id: templateId,
          agent_id: effectiveAgentId,
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

  const handleSendNow = async () => {
    if (!user || !templateId || !effectiveAgentId) {
      toast({ title: 'Please save the template first', variant: 'destructive' });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Subject line is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const filter = recipientFilter === 'tag' && selectedTag
        ? { type: 'tag', tag: selectedTag }
        : { type: 'all' };

      await supabase.functions.invoke('newsletter-template-send', {
        body: {
          template_id: templateId,
          agent_id: effectiveAgentId,
          subject,
          sender_name: senderName,
          recipient_filter: filter,
        },
      });
      toast({ title: 'Newsletter sending!', description: 'Your newsletter is being sent to recipients.' });
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!user || !templateId || !effectiveAgentId) {
      toast({ title: 'Please save the template first', variant: 'destructive' });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Subject line is required', variant: 'destructive' });
      return;
    }
    if (!scheduleDate) {
      toast({ title: 'Please select a date', variant: 'destructive' });
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      toast({ title: 'Schedule time must be in the future', variant: 'destructive' });
      return;
    }

    setScheduling(true);
    try {
      const filter = recipientFilter === 'tag' && selectedTag
        ? { type: 'tag', tag: selectedTag }
        : { type: 'all' };

      const { error } = await supabase.from('newsletter_campaigns').insert({
        campaign_name: `Scheduled: ${subject}`,
        created_by: effectiveAgentId,
        status: 'scheduled',
        scheduled_at: scheduledAt.toISOString(),
        template_id: templateId,
        subject,
        metadata: {
          agent_id: effectiveAgentId,
          subject,
          sender_name: senderName,
          recipient_filter: filter,
        },
      } as any);

      if (error) throw error;
      toast({ title: 'Newsletter scheduled!', description: `Will be sent on ${scheduledAt.toLocaleString()}` });
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to schedule', description: err.message, variant: 'destructive' });
    } finally {
      setScheduling(false);
    }
  };

  const isBusy = saving || scheduling;

  // Shared fields component
  const SharedFields = () => (
    <div className="space-y-4">
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
            <SelectItem value="all">All contacts (with email)</SelectItem>
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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
          <Users className="h-3 w-3" />
          {recipientCount === null ? (
            <span>Counting recipients…</span>
          ) : (
            <span>{recipientCount.toLocaleString()} recipient{recipientCount !== 1 ? 's' : ''} will receive this email</span>
          )}
        </div>
      </div>

      {/* Test send */}
      <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest || !templateId} className="w-full">
        {sendingTest ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TestTube className="h-4 w-4 mr-1" />}
        Send Test to {user?.email}
      </Button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Newsletter
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="now" className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="now"><Send className="h-3.5 w-3.5 mr-1.5" /> Send Now</TabsTrigger>
              <TabsTrigger value="schedule"><Clock className="h-3.5 w-3.5 mr-1.5" /> Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="now" className="space-y-4 mt-4">
              <SharedFields />
              <Button
                className="w-full"
                onClick={() => setShowConfirm(true)}
                disabled={isBusy || !subject.trim() || recipientCount === 0}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send Now
              </Button>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-4">
              <SharedFields />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date *</Label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Time *</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSchedule}
                disabled={isBusy || !subject.trim() || !scheduleDate || recipientCount === 0}
              >
                {scheduling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Clock className="h-4 w-4 mr-1" />}
                Schedule Send
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm && !saving} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Newsletter Send</AlertDialogTitle>
            <AlertDialogDescription>
              This will send "{subject}" to{' '}
              <strong>{recipientCount?.toLocaleString() ?? '…'} recipient{recipientCount !== 1 ? 's' : ''}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowConfirm(false); handleSendNow(); }}>
              Yes, Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
