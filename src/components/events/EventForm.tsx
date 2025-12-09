import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEvents, Event } from '@/hooks/useEvents';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAgents } from '@/hooks/useAgents';
import { supabase } from '@/integrations/supabase/client';

interface EventFormProps {
  event?: Event;
  onClose: () => void;
  isAdminMode?: boolean;
  adminAgentId?: string;
}

export const EventForm = ({ event, onClose, isAdminMode = false, adminAgentId }: EventFormProps) => {
  const isEditing = !!event;
  const { user } = useAuth();
  const { agents, fetchAgents, getAgentDisplayName } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(adminAgentId || event?.agent_id || user?.id || '');
  const [title, setTitle] = useState(event?.title || '');

  // Initialize date and time properly
  const [eventDate, setEventDate] = useState(() => {
    if (event?.event_date) {
      // Extract date part directly from ISO string
      const dateStr = event.event_date.split('T')[0];
      console.log('Initializing eventDate with:', dateStr);
      return dateStr;
    }
    console.log('Initializing eventDate as empty');
    return '';
  });

  const [eventTime, setEventTime] = useState(() => {
    if (event?.event_date) {
      // Extract time part from ISO string
      const timeStr = event.event_date.split('T')[1];
      if (timeStr) {
        const time = timeStr.substring(0, 5); // HH:mm
        console.log('Initializing eventTime with:', time);
        return time;
      }
    }
    console.log('Initializing eventTime as 09:00');
    return '09:00'; // Default to 9 AM
  });
  const [location, setLocation] = useState(event?.location || '');
  const [description, setDescription] = useState(event?.description || '');
  const [theme, setTheme] = useState(event?.theme || '');
  const [invitedCount, setInvitedCount] = useState<number>(event?.invited_count || 0);
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(event?.max_capacity);
  const [isPublished, setIsPublished] = useState(event?.is_published || false);
  const [headerImageUrl, setHeaderImageUrl] = useState(event?.header_image_url || '');
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [brandColor, setBrandColor] = useState(event?.brand_color || '#2563eb');
  
  const [loading, setLoading] = useState(false);
  const [loadingBranding, setLoadingBranding] = useState(false);
  
  const { addEvent, updateEvent, addEventAsAdmin, updateEventAsAdmin } = useEvents();
  const { toast } = useToast();

  // Fetch agents list if in admin mode
  useEffect(() => {
    if (isAdminMode) {
      fetchAgents();
    }
  }, [isAdminMode]);

  // Update selected agent when adminAgentId prop changes
  useEffect(() => {
    if (isAdminMode) {
      // In admin mode, only set from props or event, not from user
      if (adminAgentId) {
        setSelectedAgentId(adminAgentId);
      } else if (event?.agent_id) {
        setSelectedAgentId(event.agent_id);
      } else {
        // For new events, leave empty so user must select
        setSelectedAgentId('');
      }
    } else {
      // In regular mode, use user's ID
      if (event?.agent_id) {
        setSelectedAgentId(event.agent_id);
      } else if (user?.id) {
        setSelectedAgentId(user.id);
      }
    }
  }, [adminAgentId, event?.agent_id, user?.id, isAdminMode]);

  // Load agent branding when form opens (for new events) or when agent changes
  useEffect(() => {
    const targetAgentId = isAdminMode ? selectedAgentId : user?.id;
    if (!isEditing && targetAgentId) {
      loadAgentBranding(targetAgentId);
    }
  }, [isEditing, user, selectedAgentId, isAdminMode]);

  const loadAgentBranding = async (agentId: string) => {
    if (!agentId) return;
    
    try {
      setLoadingBranding(true);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('headshot_url')
        .eq('user_id', agentId)
        .single();

      // Note: primary_color and logo_colored_url columns don't exist in profiles table
      // Using default brand color and no default header image
      if (profileData) {
        // Could set headshot as header image if desired
        // For now, just log that branding was loaded
        console.log('Agent branding loaded for:', agentId);
      }
    } catch (error) {
      console.warn('Could not load agent branding:', error);
    } finally {
      setLoadingBranding(false);
    }
  };

  useEffect(() => {
    if (event) {
      console.log('Event data received:', event);
      setTitle(event.title || '');

      if (event.event_date) {
        const dateStr = event.event_date.split('T')[0];
        const timeStr = event.event_date.split('T')[1];
        console.log('Setting eventDate to:', dateStr);
        console.log('Setting eventTime to:', timeStr ? timeStr.substring(0, 5) : '09:00');
        setEventDate(dateStr);
        setEventTime(timeStr ? timeStr.substring(0, 5) : '09:00');
      }
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

  // File upload helper function
  const uploadHeaderImage = async (file: File): Promise<string> => {
    const targetAgentId = isAdminMode ? selectedAgentId : user?.id;
    if (!targetAgentId) {
      throw new Error('Agent ID is required for file upload');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `event-header-${Date.now()}.${fileExt}`;
    const filePath = `${targetAgentId}/events/${fileName}`;

    const { data, error } = await supabase.storage
      .from('agent-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('agent-assets')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }

    return urlData.publicUrl;
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // No file size restriction - user will manage costs in Supabase
    setUploadingImage(true);
    setHeaderImageFile(file);

    try {
      const uploadedUrl = await uploadHeaderImage(file);
      setHeaderImageUrl(uploadedUrl);
      toast({
        title: "Image uploaded",
        description: "Header image uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      setHeaderImageFile(null);
    } finally {
      setUploadingImage(false);
    }
  };

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

    if (isAdminMode && !selectedAgentId) {
      toast({
        title: "Validation Error",
        description: "Please select an agent for this event.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Combine date and time into a single datetime string
      if (!eventDate || !eventTime) {
        toast({
          title: "Validation Error",
          description: "Please fill in both event date and time.",
          variant: "destructive",
        });
        return;
      }

      const [hours, minutes] = eventTime.split(':');
      // Create ISO datetime string
      const eventDateTime = `${eventDate}T${hours}:${minutes}:00.000Z`;

      console.log('SAVING EVENT WITH:', {
        title: title.trim(),
        eventDate,
        eventTime,
        eventDateTime,
        isEditing
      });
      
      console.log('Updating event with date/time:', {
        eventDate,
        eventTime,
        eventDateTime,
        isEditing
      });

      // When editing, only include fields that should be updated
      // Don't reset attendance_count and leads_generated
      const eventData = isEditing ? {
        title: title.trim(),
        event_date: eventDateTime,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        theme: theme.trim() || undefined,
        invited_count: invitedCount || 0,
        max_capacity: maxCapacity || undefined,
        is_published: isPublished,
        header_image_url: headerImageUrl.trim() || undefined,
        brand_color: brandColor.trim() || undefined,
        // Don't include attendance_count and leads_generated when editing
        // to preserve existing values
      } : {
        title: title.trim(),
        event_date: eventDateTime,
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
      };

      if (isEditing && event) {
        if (isAdminMode) {
          await updateEventAsAdmin(event.id, eventData, selectedAgentId);
        } else {
          await updateEvent(event.id, eventData);
        }

        toast({
          title: "Event updated",
          description: "Event has been updated successfully.",
        });
      } else {
        if (isAdminMode) {
          await addEventAsAdmin(eventData, selectedAgentId);
        } else {
          await addEvent(eventData);
        }

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
          {/* Debug info */}
          <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded space-y-1">
            <div>Debug Info:</div>
            <div>Date: {eventDate || 'empty'}</div>
            <div>Time: {eventTime || 'empty'}</div>
            <div>Editing: {isEditing ? 'Yes' : 'No'}</div>
            <div>Event exists: {event ? 'Yes' : 'No'}</div>
            {event?.event_date && <div>Original: {event.event_date}</div>}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isAdminMode && (
            <div className="space-y-2">
              <Label htmlFor="agent">Agent *</Label>
              <Select value={selectedAgentId} onValueChange={(value) => {
                setSelectedAgentId(value);
                loadAgentBranding(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(agent => (
                    <SelectItem key={agent.user_id} value={agent.user_id}>
                      {getAgentDisplayName(agent)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the agent this event belongs to
              </p>
            </div>
          )}

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
                onChange={(e) => {
                  console.log('Date changed to:', e.target.value);
                  setEventDate(e.target.value);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventTime">Event Time *</Label>
              <Input
                id="eventTime"
                type="time"
                value={eventTime}
                onChange={(e) => {
                  console.log('Time changed to:', e.target.value);
                  setEventTime(e.target.value);
                }}
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
            <Label htmlFor="headerImage">Header Image</Label>
            <div className="space-y-2">
              <Input
                id="headerImage"
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                disabled={uploadingImage}
                className="cursor-pointer"
              />
              {headerImageUrl && (
                <div className="mt-2">
                  <img
                    src={headerImageUrl}
                    alt="Header preview"
                    className="h-32 w-full object-cover rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setHeaderImageUrl('');
                      setHeaderImageFile(null);
                    }}
                    className="mt-2"
                  >
                    Remove Image
                  </Button>
                </div>
              )}
              {uploadingImage && (
                <p className="text-xs text-muted-foreground">Uploading image...</p>
              )}
              <p className="text-xs text-muted-foreground">
                Optional: Upload an image for the public event page header
              </p>
            </div>
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