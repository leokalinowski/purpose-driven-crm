import { useState } from 'react';
import { useAnnouncements, AnnouncementSlide } from '@/hooks/useAnnouncements';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { typeConfig } from './announcementConstants';

interface SlideView {
  title: string;
  content: string;
  image_url?: string | null;
}

export function AnnouncementModal() {
  const { announcements, dismissAnnouncement } = useAnnouncements();
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();

  if (!isOpen || announcements.length === 0) return null;

  const safeAnnouncementIndex = Math.min(currentAnnouncementIndex, announcements.length - 1);
  const current = announcements[safeAnnouncementIndex];
  if (!current) return null;

  const config = typeConfig[current.type] || typeConfig.feature;
  const TypeIcon = config.icon;

  // Build slides array: main content as slide 0, then extra slides
  const allSlides: SlideView[] = [
    { title: current.title, content: current.content, image_url: current.image_url },
    ...((current.slides as AnnouncementSlide[]) || []),
  ];

  const totalSlides = allSlides.length;
  const safeSlideIndex = Math.min(currentSlideIndex, totalSlides - 1);
  const slide = allSlides[safeSlideIndex];
  const totalAnnouncements = announcements.length;
  const isLastSlide = safeSlideIndex === totalSlides - 1;

  const handleDismiss = async () => {
    await dismissAnnouncement.mutateAsync(current.id);
    setCurrentSlideIndex(0);
    if (safeAnnouncementIndex >= announcements.length - 1) {
      setCurrentAnnouncementIndex(Math.max(0, safeAnnouncementIndex - 1));
    }
  };

  const handleClose = () => {
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

  const handleNext = () => {
    if (safeSlideIndex < totalSlides - 1) {
      setCurrentSlideIndex(safeSlideIndex + 1);
    }
  };

  const handlePrev = () => {
    if (safeSlideIndex > 0) {
      setCurrentSlideIndex(safeSlideIndex - 1);
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
            {totalAnnouncements > 1 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {safeAnnouncementIndex + 1} of {totalAnnouncements}
              </span>
            )}
          </div>
          <DialogTitle className="text-xl">{slide.title}</DialogTitle>
        </DialogHeader>

        {slide.image_url && (
          <div className="rounded-lg overflow-hidden border bg-muted">
            <img
              src={slide.image_url}
              alt={slide.title}
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
        )}

        <DialogDescription className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
          {slide.content}
        </DialogDescription>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-1 mr-auto">
            {totalSlides > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrev}
                  disabled={safeSlideIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-1">
                  {allSlides.map((_, i) => (
                    <button
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === safeSlideIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`}
                      onClick={() => setCurrentSlideIndex(i)}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                  disabled={safeSlideIndex === totalSlides - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {isLastSlide && current.action_url && (
              <Button onClick={handleAction}>
                {current.action_label || 'Try it now'}
              </Button>
            )}
            {isLastSlide ? (
              <Button variant="secondary" onClick={handleDismiss}>
                Got it
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
