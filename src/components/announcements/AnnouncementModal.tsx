import { useState } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Sparkles, Info, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const typeConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  feature: { label: 'New Feature', icon: Sparkles, variant: 'default' },
  update: { label: 'Update', icon: Zap, variant: 'secondary' },
  tip: { label: 'Tip', icon: Info, variant: 'outline' },
};

export function AnnouncementModal() {
  const { announcements, dismissAnnouncement } = useAnnouncements();
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];
  const config = typeConfig[current.type] || typeConfig.feature;
  const TypeIcon = config.icon;
  const total = announcements.length;

  const handleDismiss = async () => {
    await dismissAnnouncement.mutateAsync(current.id);
    if (currentIndex >= announcements.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleDismissAll = async () => {
    for (const a of announcements) {
      await dismissAnnouncement.mutateAsync(a.id);
    }
  };

  const handleAction = () => {
    if (current.action_url) {
      if (current.action_url.startsWith('/')) {
        navigate(current.action_url);
        handleDismiss();
      } else {
        window.open(current.action_url, '_blank');
      }
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => handleDismissAll()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={config.variant} className="gap-1">
              <TypeIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            {total > 1 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {currentIndex + 1} of {total}
              </span>
            )}
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
        </DialogHeader>

        {current.image_url && (
          <div className="rounded-lg overflow-hidden border bg-muted">
            <img
              src={current.image_url}
              alt={current.title}
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
        )}

        <DialogDescription className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
          {current.content}
        </DialogDescription>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-1 mr-auto">
            {total > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-1">
                  {announcements.map((_, i) => (
                    <button
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                      onClick={() => setCurrentIndex(i)}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentIndex(Math.min(total - 1, currentIndex + 1))}
                  disabled={currentIndex === total - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {current.action_url && (
              <Button onClick={handleAction}>
                {current.action_label || 'Try it now'}
              </Button>
            )}
            <Button variant="secondary" onClick={handleDismiss}>
              Got it
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
