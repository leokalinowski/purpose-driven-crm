import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Eye, Send, FileText, User, Plus, Copy, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AdminTemplate, AgentProfile } from '@/hooks/useAdminNewsletter';
import { SendSchedulePanel } from '@/components/newsletter/builder/SendSchedulePanel';
import { renderBlocksToHtml } from '@/components/newsletter/builder/renderBlocksToHtml';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  templates: AdminTemplate[];
  agents: AgentProfile[];
  onDelete: (templateId: string) => void;
  onDuplicate: (params: { templateId: string; targetAgentId: string }) => void;
}

function TemplateThumbnail({ blocks, globalStyles }: { blocks: any[]; globalStyles: any }) {
  const html = useMemo(() => renderBlocksToHtml(blocks || [], globalStyles), [blocks, globalStyles]);
  return (
    <div className="relative w-full h-40 overflow-hidden bg-muted flex items-center justify-center">
      <iframe
        srcDoc={html}
        title="Preview"
        className="border-0 pointer-events-none absolute"
        style={{
          width: '640px',
          height: '900px',
          transform: 'scale(0.3)',
          transformOrigin: 'top center',
          left: '50%',
          marginLeft: '-320px',
          top: 0,
        }}
        sandbox="allow-same-origin"
        tabIndex={-1}
      />
    </div>
  );
}

export function AdminNewsletterTemplates({ templates, agents, onDelete, onDuplicate }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [sendTemplate, setSendTemplate] = useState<AdminTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copyTemplate, setCopyTemplate] = useState<AdminTemplate | null>(null);
  const [copyTargetAgent, setCopyTargetAgent] = useState<string>('');
  const [createAgentId, setCreateAgentId] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filtered = filterAgentId === 'all'
    ? templates
    : templates.filter(t => t.agent_id === filterAgentId);

  const handleCreateTemplate = async () => {
    if (!createAgentId) return;
    const { data, error } = await supabase.from('newsletter_templates').insert({
      agent_id: createAgentId,
      name: 'New Newsletter',
      blocks_json: [] as any,
      global_styles: {} as any,
      is_active: true,
    }).select('id').single();
    if (error) {
      toast({ title: 'Error creating template', description: error.message, variant: 'destructive' });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-all-templates'] });
    setShowCreateDialog(false);
    setCreateAgentId('');
    navigate(`/newsletter-builder/${data.id}`);
  };

  const handleCopy = () => {
    if (!copyTemplate || !copyTargetAgent) return;
    onDuplicate({ templateId: copyTemplate.id, targetAgentId: copyTargetAgent });
    setCopyTemplate(null);
    setCopyTargetAgent('');
  };

  const agentName = (id: string) => {
    const a = agents.find(a => a.user_id === id);
    return a ? `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown' : 'Unknown';
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Templates</CardTitle>
              <CardDescription>Cross-agent view of newsletter templates</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Template
              </Button>
              <Select value={filterAgentId} onValueChange={setFilterAgentId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Filter by agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {`${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No templates found</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map(t => (
                <Card key={t.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                  <TemplateThumbnail blocks={t.blocks_json} globalStyles={t.global_styles} />
                  <CardContent className="p-4 space-y-2">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {t.agent_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDistanceToNow(new Date(t.updated_at))} ago
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant={t.is_active ? 'default' : 'secondary'} className="text-xs">
                        {t.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5 pt-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/newsletter-builder/${t.id}`)}>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => setSendTemplate(t)}>
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Send
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCopyTemplate(t)} title="Copy to agent">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send panel — pass template's agent_id */}
      {sendTemplate && (
        <SendSchedulePanel
          open={!!sendTemplate}
          onClose={() => setSendTemplate(null)}
          templateId={sendTemplate.id}
          templateName={sendTemplate.name}
          agentId={sendTemplate.agent_id}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy to agent dialog */}
      <Dialog open={!!copyTemplate} onOpenChange={(open) => !open && setCopyTemplate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Copy Template to Agent</DialogTitle>
          </DialogHeader>
          <Select value={copyTargetAgent} onValueChange={setCopyTargetAgent}>
            <SelectTrigger>
              <SelectValue placeholder="Select target agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.user_id} value={a.user_id}>{agentName(a.user_id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyTemplate(null)}>Cancel</Button>
            <Button onClick={handleCopy} disabled={!copyTargetAgent}>Copy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create template for agent dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Template for Agent</DialogTitle>
          </DialogHeader>
          <Select value={createAgentId} onValueChange={setCreateAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select agent..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.user_id} value={a.user_id}>{agentName(a.user_id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={!createAgentId}>Create & Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
