import { useState, useRef } from 'react';
import { useResources, RESOURCE_CATEGORIES, type Resource } from '@/hooks/useResources';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Upload, FileText, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResourcesManager() {
  const { resources, isLoading, uploadResource, deleteResource } = useResources();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(RESOURCE_CATEGORIES[0]);
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = () => {
    if (!title || !category || !file) return;
    uploadResource.mutate(
      { title, description, category, file },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          setFile(null);
          if (fileRef.current) fileRef.current.value = '';
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Upload New Resource
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="res-title">Title *</Label>
              <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Buyer Consultation Checklist" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="res-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-desc">Description</Label>
            <Textarea id="res-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional summary of this resource" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="res-file">File *</Label>
            <Input id="res-file" type="file" ref={fileRef} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={handleUpload} disabled={!title || !file || uploadResource.isPending}>
            {uploadResource.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload Resource
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Resources ({resources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2" />
              <p>No resources uploaded yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {resources.map((resource) => (
                <div key={resource.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{resource.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {resource.file_name} {resource.file_size ? `· ${formatFileSize(resource.file_size)}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{resource.category}</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{resource.title}" and its file. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteResource.mutate(resource)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
