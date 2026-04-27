import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useUserRole } from '@/hooks/useUserRole';
import { useResources, RESOURCE_CATEGORIES } from '@/hooks/useResources';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Search, FolderOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const categoryColors: Record<string, string> = {
  'Contracts & Forms': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'Marketing Templates': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'Scripts & Guides': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function Resources() {
  const { isAdmin, loading } = useUserRole();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const { resources, isLoading, getPublicUrl } = useResources(
    activeCategory === 'all' ? undefined : activeCategory
  );

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const filtered = resources.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.09em] text-primary">Resources</span>
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight">Everything you need to execute.</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Templates, forms, scripts, and guides for your day-to-day.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">All</TabsTrigger>
            {RESOURCE_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No resources found</p>
              <p className="text-sm">
                {search ? 'Try a different search term' : 'Resources will appear here once uploaded by an admin'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((resource) => (
              <Card key={resource.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{resource.title}</CardTitle>
                    <Badge variant="secondary" className={categoryColors[resource.category] ?? ''}>
                      {resource.category}
                    </Badge>
                  </div>
                  {resource.description && (
                    <CardDescription className="line-clamp-2">{resource.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between pt-0">
                  <span className="text-xs text-muted-foreground">
                    {resource.file_name} {resource.file_size ? `· ${formatFileSize(resource.file_size)}` : ''}
                  </span>
                  <Button size="sm" variant="outline" asChild>
                    <a href={getPublicUrl(resource.file_path)} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
