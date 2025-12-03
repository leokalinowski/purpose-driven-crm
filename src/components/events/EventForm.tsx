import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useEvents } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';

interface EventFormProps {
  onClose: () => void;
}

export const EventForm = ({ onClose }: EventFormProps) => {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState('');
  const [invitedCount, setInvitedCount] = useState<number>(0);
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined);
  const [isPublished, setIsPublished] = useState(false);
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [brandColor, setBrandColor] = useState('');
  
  const [loading, setLoading] = useState(false);
  
  const { addEvent } = useEvents();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in the event title and date.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await addEvent({
        title: title.trim(),
        event_date: eventDate,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        theme: theme.trim() || undefined,
        invited_count: invitedCount || 0,
        max_capacity: maxCapacity || undefined,
        is_published: isPublished,
        header_image_url: headerImageUrl.trim() || undefined,
        brand_color: brandColor.trim() || undefined,
        attendance_count: 0,
        leads_generated: 0
      });

      toast({
        title: "Event created",
        description: "Event and preparation tasks have been created successfully.",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Safe & Warm: Winter Ready Homes"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventDate">Event Date *</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Venue/Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Community Center, Fire Station"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Event Theme</Label>
            <Input
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g., Home Safety & Winter Preparation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the event..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invitedCount">Expected Attendees</Label>
              <Input
                id="invitedCount"
                type="number"
                value={invitedCount || ''}
                onChange={(e) => setInvitedCount(parseInt(e.target.value) || 0)}
                placeholder="0"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Max Capacity (RSVP Limit)</Label>
              <Input
                id="maxCapacity"
                type="number"
                value={maxCapacity || ''}
                onChange={(e) => setMaxCapacity(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Unlimited"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for unlimited RSVPs
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headerImageUrl">Header Image URL</Label>
            <Input
              id="headerImageUrl"
              type="url"
              value={headerImageUrl}
              onChange={(e) => setHeaderImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            <p className="text-xs text-muted-foreground">
              Optional: URL to an image for the public event page header
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandColor">Brand Color</Label>
            <div className="flex gap-2">
              <Input
                id="brandColor"
                type="color"
                value={brandColor || '#2563eb'}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#2563eb"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Primary color for the public event page
            </p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="isPublished">Publish Public RSVP Page</Label>
              <p className="text-sm text-muted-foreground">
                Allow public RSVPs via a shareable link
              </p>
            </div>
            <Switch
              id="isPublished"
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Event & Tasks'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};