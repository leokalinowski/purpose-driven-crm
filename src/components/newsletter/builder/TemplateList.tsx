import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Copy, Trash2, FileText, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNewsletterTemplates } from '@/hooks/useNewsletterTemplates';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { renderBlocksToHtml } from './renderBlocksToHtml';
import { SendSchedulePanel } from './SendSchedulePanel';
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
          transform: 'scale(0.35)',
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

export function TemplateList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { templates, isLoading, saveTemplate, deleteTemplate, isSaving } = useNewsletterTemplates();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sendTemplate, setSendTemplate] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You need to be signed in to create templates.', variant: 'destructive' });
      return;
    }
    try {
      const result = await saveTemplate({
        agent_id: user.id,
        name: 'Untitled Template',
        blocks_json: [],
        global_styles: {} as any,
      });
      if (result?.id) {
        navigate(`/newsletter-builder/${result.id}`);
      }
    } catch (err: any) {
      navigate('/newsletter-builder');
    }
  };

  const handleDuplicate = async (template: typeof templates[0]) => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You need to be signed in to duplicate templates.', variant: 'destructive' });
      return;
    }
    await saveTemplate({
      agent_id: user.id,
      name: `${template.name} (Copy)`,
      blocks_json: template.blocks_json,
      global_styles: template.global_styles,
    });
  };

  const handleDelete = (id: string) => {
    deleteTemplate(id);
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>Create and manage your newsletter templates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 h-40" />
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>Create and manage your newsletter templates</CardDescription>
        </div>
        <Button onClick={handleCreate} disabled={isSaving}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </CardHeader>

      <CardContent>
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first newsletter template to get started.</p>
            <Button onClick={handleCreate} disabled={isSaving}>
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(t => (
              <Card key={t.id} className="group hover:shadow-md transition-shadow overflow-hidden">
                <TemplateThumbnail blocks={t.blocks_json} globalStyles={t.global_styles} />
                <div className="px-4 py-3 flex items-start justify-between">
                  <div>
                    <h3 className="font-medium truncate">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Updated {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                    {(t as any).ai_generated && (
                      <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700 dark:text-purple-300">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                      </Badge>
                    )}
                    {(t as any).review_status === 'pending_review' ? (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Pending Review</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Active</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 px-4 py-3 border-t border-border">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/newsletter-builder/${t.id}`)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button size="sm" variant="default" className="flex-1" onClick={() => setSendTemplate({ id: t.id, name: t.name })}>
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Send
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(t)} disabled={isSaving}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) handleDelete(deleteId); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sendTemplate && (
        <SendSchedulePanel
          open={!!sendTemplate}
          onClose={() => setSendTemplate(null)}
          templateId={sendTemplate.id}
          templateName={sendTemplate.name}
        />
      )}
    </Card>
  );
}
