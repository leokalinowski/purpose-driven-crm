import { useState } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { typeConfig } from './announcementConstants';

export function AnnouncementModal() {
  const { announcements, dismissAnnouncement, dismissAllAnnouncements } = useAnnouncements();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();

  if (!isOpen || announcements.length === 0) return null;

  const safeIndex = Math.min(currentIndex, announcements.length - 1);
  const current = announcements[safeIndex];
  if (!current) return null;

  const config = typeConfig[current.type] || typeConfig.feature;
  const TypeIcon = config.icon;
  const total = announcements.length;

  const handleDismiss = async () => {
    await dismissAnnouncement.mutateAsync(current.id);
    // If that was the last one, the array will become empty and we'll return null above
    if (safeIndex >= announcements.length - 1) {
      setCurrentIndex(Math.max(0, safeIndex - 1));
    }
  };

  const handleClose = () => {
    // Just hide for this session — don't dismiss anything
    setIsOpen(false);
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
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={config.variant} className="gap-1">
              <TypeIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            {total > 1 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {safeIndex + 1} of {total}
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
                  onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
                  disabled={safeIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-1">
                  {announcements.map((_, i) => (
                    <button
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                      onClick={() => setCurrentIndex(i)}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentIndex(Math.min(total - 1, safeIndex + 1))}
                  disabled={safeIndex === total - 1}
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
