import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useEvents, Event } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface EventFormProps {
  event?: Event;
  onClose: () => void;
}

export const EventForm = ({ event, onClose }: EventFormProps) => {
  const isEditing = !!event;
  const { user } = useAuth();
  const [title, setTitle] = useState(event?.title || '');
  const [eventDate, setEventDate] = useState(event?.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '');
  const [location, setLocation] = useState(event?.location || '');
  const [description, setDescription] = useState(event?.description || '');
  const [theme, setTheme] = useState(event?.theme || '');
  const [invitedCount, setInvitedCount] = useState<number>(event?.invited_count || 0);
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(event?.max_capacity);
  const [isPublished, setIsPublished] = useState(event?.is_published || false);
  const [headerImageUrl, setHeaderImageUrl] = useState(event?.header_image_url || '');
  const [brandColor, setBrandColor] = useState(event?.brand_color || '#2563eb');
  
  const [loading, setLoading] = useState(false);
  const [loadingBranding, setLoadingBranding] = useState(false);
  
  const { addEvent, updateEvent } = useEvents();
  const { toast } = useToast();

  // Load agent branding when form opens (for new events)
  useEffect(() => {
    if (!isEditing && user) {
      loadAgentBranding();
    }
  }, [isEditing, user]);

  const loadAgentBranding = async () => {
    if (!user) return;
    
    try {
      setLoadingBranding(true);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('primary_color, logo_colored_url, headshot_url')
        .eq('user_id', user.id)
        .single();

      if (profileData) {
        if (profileData.primary_color && !event?.brand_color) {
          setBrandColor(profileData.primary_color);
        }
        if (profileData.logo_colored_url && !event?.header_image_url) {
          setHeaderImageUrl(profileData.logo_colored_url);
        }
      }
    } catch (error) {
      console.warn('Could not load agent branding:', error);
    } finally {
      setLoadingBranding(false);
    }
  };

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setEventDate(event.event_date ? new Date(event.event_date).toISOString().split('T')[0] : '');
      setLocation(event.location || '');
      setDescription(event.description || '');
      setTheme(event.theme || '');
      setInvitedCount(event.invited_count || 0);
      setMaxCapacity(event.max_capacity);
      setIsPublished(event.is_published || false);
      setHeaderImageUrl(event.header_image_url || '');
      setBrandColor(event.brand_color || '#2563eb');
    }
  }, [event]);

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
      if (isEditing && event) {
        await updateEvent(event.id, {
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
        });

        toast({
          title: "Event updated",
          description: "Event has been updated successfully.",
        });
      } else {
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
      }
      
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} event. Please try again.`,
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
          <DialogTitle>{isEditing ? 'Edit Event' : 'Create New Event'}</DialogTitle>
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
              {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Event' : 'Create Event & Tasks')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};