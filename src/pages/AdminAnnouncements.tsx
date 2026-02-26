import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useAdminAnnouncements, Announcement } from '@/hooks/useAnnouncements';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Sparkles, Info, Zap, Eye, Megaphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const typeConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  feature: { label: 'New Feature', icon: Sparkles, variant: 'default' },
  update: { label: 'Update', icon: Zap, variant: 'secondary' },
  tip: { label: 'Tip', icon: Info, variant: 'outline' },
};

const emptyForm = {
  title: '',
  content: '',
  type: 'feature',
  image_url: '',
  action_url: '',
  action_label: '',
  target_role: '',
  expires_at: '',
  priority: 0,
  is_active: true,
};

export default function AdminAnnouncements() {
  const { announcements, isLoading, createAnnouncement, updateAnnouncement, deleteAnnouncement } = useAdminAnnouncements();
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [previewItem, setPreviewItem] = useState<Announcement | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      type: a.type,
      image_url: a.image_url || '',
      action_url: a.action_url || '',
      action_label: a.action_label || '',
      target_role: a.target_role || '',
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
      priority: a.priority,
      is_active: a.is_active,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.content) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        title: form.title,
        content: form.content,
        type: form.type,
        image_url: form.image_url || null,
        action_url: form.action_url || null,
        action_label: form.action_label || null,
        target_role: form.target_role || null,
        expires_at: form.expires_at || null,
        priority: form.priority,
        is_active: form.is_active,
        created_by: user!.id,
      };

      if (editingId) {
        await updateAnnouncement.mutateAsync({ id: editingId, ...payload });
        toast({ title: 'Announcement updated' });
      } else {
        await createAnnouncement.mutateAsync(payload);
        toast({ title: 'Announcement created' });
      }
      setFormOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement.mutateAsync(id);
      toast({ title: 'Announcement deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (a: Announcement) => {
    await updateAnnouncement.mutateAsync({ id: a.id, is_active: !a.is_active });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" />
              Announcements
            </h1>
            <p className="text-muted-foreground">Create announcements that agents see when they log in.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Announcement
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No announcements yet. Create one to get started!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {announcements.map(a => {
              const config = typeConfig[a.type] || typeConfig.feature;
              const TypeIcon = config.icon;
              const isExpired = a.expires_at && new Date(a.expires_at) < new Date();
              return (
                <Card key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={config.variant} className="gap-1">
                          <TypeIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {a.target_role && (
                          <Badge variant="outline" className="text-xs">{a.target_role}</Badge>
                        )}
                        {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={a.is_active} onCheckedChange={() => handleToggleActive(a)} />
                        <Button variant="ghost" size="icon" onClick={() => setPreviewItem(a)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Priority: {a.priority}</span>
                      {a.expires_at && <span>Expires: {new Date(a.expires_at).toLocaleDateString()}</span>}
                      <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit' : 'New'} Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What's new?" />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Describe the feature or update..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">New Feature</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="tip">Tip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Role</Label>
                <Select value={form.target_role || 'all'} onValueChange={v => setForm({ ...form, target_role: v === 'all' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="agent">Agents only</SelectItem>
                    <SelectItem value="admin">Admins only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Image URL (screenshot or GIF)</Label>
              <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Action URL</Label>
                <Input value={form.action_url} onChange={e => setForm({ ...form, action_url: e.target.value })} placeholder="/events or https://..." />
              </div>
              <div>
                <Label>Button Label</Label>
                <Input value={form.action_label} onChange={e => setForm({ ...form, action_label: e.target.value })} placeholder="Try it now" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority (higher = shown first)</Label>
                <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Expires at</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createAnnouncement.isPending || updateAnnouncement.isPending}>
              {editingId ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewItem && (
        <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={typeConfig[previewItem.type]?.variant || 'default'} className="gap-1">
                  {typeConfig[previewItem.type]?.label || 'Feature'}
                </Badge>
              </div>
              <DialogTitle className="text-xl">{previewItem.title}</DialogTitle>
            </DialogHeader>
            {previewItem.image_url && (
              <div className="rounded-lg overflow-hidden border bg-muted">
                <img src={previewItem.image_url} alt={previewItem.title} className="w-full h-auto max-h-64 object-contain" />
              </div>
            )}
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{previewItem.content}</p>
            <DialogFooter>
              {previewItem.action_url && (
                <Button>{previewItem.action_label || 'Try it now'}</Button>
              )}
              <Button variant="secondary" onClick={() => setPreviewItem(null)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
