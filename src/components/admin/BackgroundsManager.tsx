import { useState, useEffect, useRef } from 'react';
import { useBackgrounds, Background, BackgroundAgentLink } from '@/hooks/useBackgrounds';
import { useAgents, Agent } from '@/hooks/useAgents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Trash2, Loader2, Plus, Edit, Users } from 'lucide-react';

export const BackgroundsManager = () => {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [allLinks, setAllLinks] = useState<BackgroundAgentLink[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
    category: '',
    notes: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { loading, fetchBackgrounds, fetchAllLinks, uploadBackground, deleteBackground } = useBackgrounds();
  const { agents, fetchAgents } = useAgents();

  useEffect(() => {
    loadData();
    fetchAgents();
  }, []);

  const loadData = async () => {
    const [bgData, links] = await Promise.all([
      fetchBackgrounds(),
      fetchAllLinks(),
    ]);
    setBackgrounds(bgData);
    setAllLinks(links);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !formData.name) return;

    setUploading(true);
    const result = await uploadBackground(selectedFile, formData);
    if (result) {
      setBackgrounds(prev => [result, ...prev]);
      setFormData({ name: '', prompt: '', category: '', notes: '' });
      setSelectedFile(null);
      setIsAddDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    setUploading(false);
  };

  const handleDelete = async (bg: Background) => {
    const success = await deleteBackground(bg.id, bg.background_url);
    if (success) {
      setBackgrounds(prev => prev.filter(b => b.id !== bg.id));
      setAllLinks(prev => prev.filter(l => l.background_id !== bg.id));
    }
  };

  const getLinkedAgentCount = (backgroundId: string) => {
    return allLinks.filter(l => l.background_id === backgroundId).length;
  };

  const getAgentName = (agent: Agent) => {
    if (agent.first_name || agent.last_name) {
      return `${agent.first_name || ''} ${agent.last_name || ''}`.trim();
    }
    return agent.email || 'Unknown';
  };

  const getLinkedAgentNames = (backgroundId: string) => {
    const linkedUserIds = allLinks
      .filter(l => l.background_id === backgroundId)
      .map(l => l.user_id);
    
    return agents
      .filter(a => linkedUserIds.includes(a.id))
      .map(a => getAgentName(a))
      .join(', ');
  };

  if (loading && backgrounds.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">AI Backgrounds</h3>
          <p className="text-sm text-muted-foreground">
            Manage backgrounds and assign them to agents
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Background
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Background</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Modern Office"
                />
              </div>
              <div className="space-y-2">
                <Label>Image *</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>AI Prompt</Label>
                <Textarea
                  value={formData.prompt}
                  onChange={e => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="The prompt used to generate this image"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., real-estate, lifestyle"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes"
                  rows={2}
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={uploading || !selectedFile || !formData.name}
                className="w-full"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Upload Background
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Backgrounds Table */}
      {backgrounds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No backgrounds yet</p>
            <p className="text-sm text-muted-foreground">Add your first background to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Preview</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Linked Agents</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backgrounds.map(bg => (
                <TableRow key={bg.id}>
                  <TableCell>
                    <div className="w-20 rounded overflow-hidden">
                      <AspectRatio ratio={16 / 9}>
                        <img
                          src={bg.background_url}
                          alt={bg.name}
                          className="object-cover w-full h-full"
                        />
                      </AspectRatio>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{bg.name}</TableCell>
                  <TableCell>
                    {bg.category ? (
                      <Badge variant="secondary">{bg.category}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm text-muted-foreground">
                      {bg.prompt || '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{getLinkedAgentCount(bg.id)}</span>
                    </div>
                    {getLinkedAgentCount(bg.id) > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-32">
                        {getLinkedAgentNames(bg.id)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(bg)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
