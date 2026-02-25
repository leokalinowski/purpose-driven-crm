import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Copy, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNewsletterTemplates } from '@/hooks/useNewsletterTemplates';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { renderBlocksToHtml } from './renderBlocksToHtml';
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
    <div className="relative w-full h-36 overflow-hidden rounded border bg-muted mb-3">
      <iframe
        srcDoc={html}
        title="Preview"
        className="absolute top-0 left-0 border-0 pointer-events-none"
        style={{
          width: '640px',
          height: '900px',
          transform: 'scale(0.28)',
          transformOrigin: 'top left',
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
    toast({ title: 'Template deleted' });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-40" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Templates</h2>
          <p className="text-sm text-muted-foreground">Create and manage your newsletter templates</p>
        </div>
        <Button onClick={handleCreate} disabled={isSaving}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first newsletter template to get started.</p>
            <Button onClick={handleCreate} disabled={isSaving}>
              <Plus className="h-4 w-4 mr-2" /> Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Updated {format(new Date(t.updated_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <TemplateThumbnail blocks={t.blocks_json} globalStyles={t.global_styles} />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="default" className="flex-1" onClick={() => navigate(`/newsletter-builder/${t.id}`)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(t)} disabled={isSaving}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
