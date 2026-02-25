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
import { Send, TestTube, Loader2, Users } from 'lucide-react';
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
              {/* Recipient count preview */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Users className="h-3 w-3" />
                {recipientCount === null ? (
                  <span>Counting recipients…</span>
                ) : (
                  <span>{recipientCount.toLocaleString()} recipient{recipientCount !== 1 ? 's' : ''} will receive this email</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleSendTest} disabled={sendingTest || !templateId} className="flex-1">
                {sendingTest ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TestTube className="h-4 w-4 mr-1" />}
                Send Test
              </Button>
              <Button
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={saving || !subject.trim() || recipientCount === 0}
                className="flex-1"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Send Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
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
