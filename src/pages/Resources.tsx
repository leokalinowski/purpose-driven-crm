import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText, Search, Download, Upload, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { useResources, RESOURCE_CATEGORIES, type Resource } from '@/hooks/useResources';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type CategoryFilter = 'all' | (typeof RESOURCE_CATEGORIES)[number];

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(file_type: string | null, file_name: string): string {
  const ext = (file_name.split('.').pop() || '').toUpperCase();
  if (ext) return ext;
  if (!file_type) return 'File';
  if (file_type.includes('pdf')) return 'PDF';
  if (file_type.includes('image')) return 'Image';
  if (file_type.includes('video')) return 'Video';
  if (file_type.includes('word') || file_type.includes('document')) return 'DOC';
  if (file_type.includes('sheet') || file_type.includes('excel')) return 'XLS';
  return 'File';
}

export default function Resources() {
  const { resources, isLoading, getPublicUrl } = useResources();
  const { isAdmin } = useUserRole();

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: resources.length };
    for (const cat of RESOURCE_CATEGORIES) base[cat] = 0;
    for (const r of resources) {
      if (base[r.category] !== undefined) base[r.category] += 1;
    }
    return base;
  }, [resources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources
      .filter((r) => category === 'all' || r.category === category)
      .filter((r) => {
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          r.file_name.toLowerCase().includes(q)
        );
      });
  }, [resources, category, search]);

  const filterOptions: { id: CategoryFilter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    ...RESOURCE_CATEGORIES.map((cat) => ({ id: cat, label: `${cat} (${counts[cat] || 0})` })),
  ];

  const handleDownload = (resource: Resource) => {
    const url = getPublicUrl(resource.file_path);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Layout>
      <Helmet>
        <title>Resources — Real Estate on Purpose</title>
      </Helmet>

      <div className="flex justify-between items-start gap-4 mb-7 flex-wrap">
        <div>
          <span className="eye-label">Resources</span>
          <h1 className="font-display text-[clamp(2rem,2.6vw+0.6rem,2.5rem)] font-medium tracking-tighter leading-[1.1] text-reop-dark-blue mt-1.5">
            Templates, training, and ready-to-go scripts.
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2 max-w-[640px] leading-relaxed">
            Everything you need to run your business — without reinventing the wheel. Curated by the REOP team.
          </p>
        </div>
        {isAdmin && (
          <a
            href="/admin?tab=resources"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-reop-teal-hover transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Manage resources
          </a>
        )}
      </div>

      <div className="flex gap-3 items-center flex-wrap mb-5 px-4 py-3 bg-card border border-border rounded-xl">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="w-full h-[38px] pl-10 pr-3 rounded-lg border border-border text-sm bg-[hsl(210_20%_98%)] focus:outline-none focus:border-primary"
          />
        </div>

        <div className="inline-flex gap-0.5 rounded-[9px] bg-[hsl(210_20%_94%)] p-[3px] flex-wrap">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setCategory(f.id)}
              className={cn(
                'px-3 py-[6px] rounded-[7px] text-[12.5px] transition-all',
                category === f.id
                  ? 'bg-card text-reop-dark-blue font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-muted-foreground hover:text-reop-dark-blue font-medium',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading resources…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-[12px] px-6 py-16 text-center">
          <FileText className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-reop-dark-blue mb-1">
            {resources.length === 0 ? 'No resources yet' : 'No resources match your filters'}
          </p>
          <p className="text-[13px] text-muted-foreground max-w-[420px] mx-auto">
            {resources.length === 0
              ? 'The REOP team will publish templates, scripts, and guides here. Check back soon.'
              : 'Try a different category or clear your search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((resource) => (
            <div
              key={resource.id}
              className="bg-card border border-border rounded-[12px] overflow-hidden flex flex-col transition-all hover:border-primary hover:shadow-[0_4px_12px_hsl(184_100%_34%/0.08)]"
            >
              <div className="aspect-[16/9] relative flex items-center justify-center bg-gradient-to-br from-reop-dark-blue to-[hsl(210_47%_18%)]">
                <FileText className="w-10 h-10 text-white opacity-80" />
                <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/90 text-reop-dark-blue">
                  {fileTypeLabel(resource.file_type, resource.file_name)}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <span className="text-[10.5px] text-primary font-semibold uppercase tracking-[0.05em]">
                  {resource.category}
                </span>
                <b className="text-[14px] font-semibold leading-[1.35] text-reop-dark-blue line-clamp-2">
                  {resource.title}
                </b>
                {resource.description && (
                  <p className="text-[12.5px] text-muted-foreground leading-[1.5] line-clamp-2 m-0">
                    {resource.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-2">
                  <span>
                    {formatBytes(resource.file_size)} · {format(new Date(resource.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <button
                  onClick={() => handleDownload(resource)}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-reop-teal-hover transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
