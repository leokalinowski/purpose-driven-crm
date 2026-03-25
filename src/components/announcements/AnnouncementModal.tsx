import { useState } from 'react';
import { useAnnouncements, AnnouncementSlide, Announcement } from '@/hooks/useAnnouncements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { typeConfig } from './announcementConstants';

interface SlideView {
  title: string;
  content: string;
  image_url?: string | null;
}

const positionClasses: Record<string, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'center': 'top-4 right-4',
};

function ToastAnnouncement({ announcement, onDismiss, onAction }: {
  announcement: Announcement;
  onDismiss: () => void;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[announcement.type] || typeConfig.feature;
  const TypeIcon = config.icon;
  const pos = positionClasses[announcement.display_position] || positionClasses['top-right'];

  return (
    <div className={`fixed z-50 ${pos} w-80 animate-in slide-in-from-right-5 fade-in-0 duration-300`}>
      <div className="rounded-lg border bg-card text-card-foreground shadow-lg overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant={config.variant} className="gap-1 shrink-0 text-xs">
                <TypeIcon className="h-3 w-3" />
                {config.label}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDismiss}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {announcement.image_url && (
            <div className="mt-2 rounded border overflow-hidden bg-muted">
              <img src={announcement.image_url} alt={announcement.title} className={`w-full h-auto object-contain ${expanded ? 'max-h-40' : 'max-h-24'}`} />
            </div>
          )}
          <h4 className="font-semibold text-sm mt-2 leading-tight">{announcement.title}</h4>
          <p className={`text-xs text-muted-foreground mt-1 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {announcement.content}
          </p>
          {!expanded && announcement.content.length > 100 && (
            <button className="text-xs text-primary mt-1 hover:underline" onClick={() => setExpanded(true)}>
              Read more
            </button>
          )}
          <div className="flex gap-2 mt-3">
            {announcement.action_url && (
              <Button size="sm" className="h-7 text-xs" onClick={onAction}>
                {announcement.action_label || 'View'}
              </Button>
            )}
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerAnnouncement({ announcement, onDismiss, onAction }: {
  announcement: Announcement;
  onDismiss: () => void;
  onAction: () => void;
}) {
  const config = typeConfig[announcement.type] || typeConfig.feature;
  const TypeIcon = config.icon;
  const isTop = !announcement.display_position?.includes('bottom');

  return (
    <div className={`fixed z-50 left-0 right-0 ${isTop ? 'top-0' : 'bottom-0'} animate-in ${isTop ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'} fade-in-0 duration-300`}>
      <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TypeIcon className="h-4 w-4 shrink-0 opacity-80" />
          {announcement.image_url && (
            <img src={announcement.image_url} alt={announcement.title} className="h-6 w-6 rounded object-cover shrink-0" />
          )}
          <span className="font-medium text-sm truncate">{announcement.title}</span>
          <span className="text-xs opacity-80 hidden sm:inline truncate">{announcement.content}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {announcement.action_url && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onAction}>
              {announcement.action_label || 'View'}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/10" onClick={onDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModalAnnouncement({ announcement, onDismiss, onAction, onClose }: {
  announcement: Announcement;
  onDismiss: () => void;
  onAction: () => void;
  onClose: () => void;
}) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const config = typeConfig[announcement.type] || typeConfig.feature;
  const TypeIcon = config.icon;

  const allSlides: SlideView[] = [
    { title: announcement.title, content: announcement.content, image_url: announcement.image_url },
    ...((announcement.slides as AnnouncementSlide[]) || []),
  ];

  const totalSlides = allSlides.length;
  const safeSlideIndex = Math.min(currentSlideIndex, totalSlides - 1);
  const slide = allSlides[safeSlideIndex];
  const isLastSlide = safeSlideIndex === totalSlides - 1;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0">
        {/* Gradient header banner */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-accent/10 px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={config.variant} className="gap-1 text-xs font-bold">
                <TypeIcon className="h-3.5 w-3.5" />
                {config.label}
              </Badge>
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight">{slide.title}</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-4 animate-fade-in" key={safeSlideIndex}>
          {slide.image_url && (
            <div className="rounded-lg overflow-hidden border bg-muted">
              <img src={slide.image_url} alt={slide.title} className="w-full h-auto max-h-64 object-contain" />
            </div>
          )}

          <DialogDescription className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {slide.content}
          </DialogDescription>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <div className="flex items-center gap-1 mr-auto">
              {totalSlides > 1 && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentSlideIndex(Math.max(0, safeSlideIndex - 1))} disabled={safeSlideIndex === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex gap-1">
                    {allSlides.map((_, i) => (
                      <button key={i} className={`h-1.5 rounded-full transition-all ${i === safeSlideIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} onClick={() => setCurrentSlideIndex(i)} />
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentSlideIndex(Math.min(totalSlides - 1, safeSlideIndex + 1))} disabled={isLastSlide}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isLastSlide && announcement.action_url && (
                <Button onClick={onAction} className="font-semibold">{announcement.action_label || 'Try it now'}</Button>
              )}
              {isLastSlide ? (
                <Button variant="secondary" onClick={onDismiss}>Got it</Button>
              ) : (
                <Button onClick={() => setCurrentSlideIndex(safeSlideIndex + 1)}>Next</Button>
              )}
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementModal() {
  const { announcements, dismissAnnouncement } = useAnnouncements();
  const [isOpen, setIsOpen] = useState(true);
  const [dismissedLocally, setDismissedLocally] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  if (!isOpen || announcements.length === 0) return null;

  const visibleAnnouncements = announcements.filter(a => !dismissedLocally.has(a.id));
  if (visibleAnnouncements.length === 0) return null;

  const handleDismiss = async (announcement: Announcement) => {
    setDismissedLocally(prev => new Set(prev).add(announcement.id));
    await dismissAnnouncement.mutateAsync(announcement.id);
  };

  const handleAction = (announcement: Announcement) => {
    if (announcement.action_url) {
      if (announcement.action_url.startsWith('/')) {
        navigate(announcement.action_url);
        handleDismiss(announcement);
      } else {
        window.open(announcement.action_url, '_blank');
      }
    }
  };

  const modals = visibleAnnouncements.filter(a => (a.display_style || 'modal') === 'modal');
  const toasts = visibleAnnouncements.filter(a => a.display_style === 'toast');
  const banners = visibleAnnouncements.filter(a => a.display_style === 'banner');

  const currentModal = modals[0];

  return (
    <>
      {currentModal && (
        <ModalAnnouncement
          announcement={currentModal}
          onDismiss={() => handleDismiss(currentModal)}
          onAction={() => handleAction(currentModal)}
          onClose={() => setIsOpen(false)}
        />
      )}
      {toasts.map(a => (
        <ToastAnnouncement
          key={a.id}
          announcement={a}
          onDismiss={() => handleDismiss(a)}
          onAction={() => handleAction(a)}
        />
      ))}
      {banners.map(a => (
        <BannerAnnouncement
          key={a.id}
          announcement={a}
          onDismiss={() => handleDismiss(a)}
          onAction={() => handleAction(a)}
        />
      ))}
    </>
  );
}
