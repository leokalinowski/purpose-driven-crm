import { useState, useEffect } from 'react';
import { useBackgrounds, Background, BackgroundAgentLink } from '@/hooks/useBackgrounds';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Image as ImageIcon } from 'lucide-react';

interface AgentBackgroundsSelectorProps {
  userId: string;
}

export const AgentBackgroundsSelector = ({ userId }: AgentBackgroundsSelectorProps) => {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { loading, fetchBackgrounds, fetchAgentLinks, linkBackground, unlinkBackground } = useBackgrounds();

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    const [bgData, links] = await Promise.all([
      fetchBackgrounds(),
      fetchAgentLinks(userId),
    ]);
    setBackgrounds(bgData);
    setLinkedIds(new Set(links.map(l => l.background_id)));
  };

  const handleToggle = async (backgroundId: string, isLinked: boolean) => {
    setLoadingId(backgroundId);
    
    if (isLinked) {
      const success = await unlinkBackground(backgroundId, userId);
      if (success) {
        setLinkedIds(prev => {
          const next = new Set(prev);
          next.delete(backgroundId);
          return next;
        });
      }
    } else {
      const success = await linkBackground(backgroundId, userId);
      if (success) {
        setLinkedIds(prev => new Set(prev).add(backgroundId));
      }
    }
    
    setLoadingId(null);
  };

  const categories = ['all', ...new Set(backgrounds.map(b => b.category).filter(Boolean))] as string[];

  const filteredBackgrounds = categoryFilter === 'all'
    ? backgrounds
    : backgrounds.filter(b => b.category === categoryFilter);

  if (loading && backgrounds.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="space-y-2">
          <Label>Filter by Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground pt-6">
          {linkedIds.size} background{linkedIds.size !== 1 ? 's' : ''} selected
        </div>
      </div>

      {/* Backgrounds Grid */}
      {filteredBackgrounds.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No backgrounds available</p>
          <p className="text-sm text-muted-foreground">Ask an admin to add backgrounds</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBackgrounds.map(bg => {
            const isLinked = linkedIds.has(bg.id);
            const isLoading = loadingId === bg.id;

            return (
              <Card
                key={bg.id}
                className={`overflow-hidden cursor-pointer transition-all ${
                  isLinked ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-muted-foreground'
                }`}
                onClick={() => !isLoading && handleToggle(bg.id, isLinked)}
              >
                <CardContent className="p-0">
                  <AspectRatio ratio={16 / 9}>
                    <img
                      src={bg.background_url}
                      alt={bg.name}
                      className="object-cover w-full h-full"
                    />
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </AspectRatio>
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{bg.name}</p>
                        {bg.category && (
                          <Badge variant="secondary" className="mt-1">
                            {bg.category}
                          </Badge>
                        )}
                      </div>
                      <Checkbox
                        checked={isLinked}
                        disabled={isLoading}
                        onClick={e => e.stopPropagation()}
                        onCheckedChange={() => handleToggle(bg.id, isLinked)}
                      />
                    </div>
                    {bg.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{bg.notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
