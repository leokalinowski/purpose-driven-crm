import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useSchedulePost, type NewPost } from '@/hooks/useSocialScheduler';

interface SocialPostFormProps {
  agentId?: string;
  onSuccess?: () => void;
}

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', color: 'bg-blue-600' },
  { id: 'instagram', name: 'Instagram', color: 'bg-pink-600' },
  { id: 'linkedin', name: 'LinkedIn', color: 'bg-blue-700' },
  { id: 'twitter', name: 'X (Twitter)', color: 'bg-slate-900' },
  { id: 'tiktok', name: 'TikTok', color: 'bg-slate-900' },
];

export function SocialPostForm({ agentId, onSuccess }: SocialPostFormProps) {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const schedulePost = useSchedulePost();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || selectedPlatforms.length === 0 || !scheduleDate || !scheduleTime) {
      return;
    }

    const scheduleDateTime = new Date(scheduleDate);
    const [hours, minutes] = scheduleTime.split(':');
    scheduleDateTime.setHours(parseInt(hours), parseInt(minutes));

    const newPost: NewPost = {
      content: content.trim(),
      platforms: selectedPlatforms,
      schedule_time: scheduleDateTime.toISOString(),
      media_file: mediaFile || undefined,
      agent_id: agentId,
    };

    try {
      await schedulePost.mutateAsync(newPost);
      
      // Reset form
      setContent('');
      setSelectedPlatforms([]);
      setScheduleDate(undefined);
      setScheduleTime('');
      setMediaFile(null);
      setMediaPreview(null);
      
      onSuccess?.();
    } catch (error) {
      console.error('Failed to schedule post:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule New Post</CardTitle>
        <CardDescription>
          Create and schedule a post across multiple social media platforms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={2000}
              className="resize-none"
            />
            <div className="text-sm text-muted-foreground text-right">
              {content.length}/2000
            </div>
          </div>

          <div className="space-y-3">
            <Label>Platforms</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PLATFORMS.map((platform) => (
                <div key={platform.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={platform.id}
                    checked={selectedPlatforms.includes(platform.id)}
                    onCheckedChange={() => handlePlatformToggle(platform.id)}
                  />
                  <div className="flex items-center space-x-2">
                    <div className={cn("w-3 h-3 rounded", platform.color)} />
                    <Label htmlFor={platform.id} className="text-sm font-normal">
                      {platform.name}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Schedule Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Schedule Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Media (Optional)</Label>
            {mediaPreview ? (
              <div className="relative">
                <img
                  src={mediaPreview}
                  alt="Media preview"
                  className="w-full h-48 object-cover rounded-md border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveMedia}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <div className="mt-2">
                    <Label htmlFor="media" className="cursor-pointer text-primary hover:text-primary/80">
                      Upload an image or video
                    </Label>
                    <Input
                      id="media"
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, MP4 up to 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={!content.trim() || selectedPlatforms.length === 0 || !scheduleDate || !scheduleTime || schedulePost.isPending}
            className="w-full"
          >
            {schedulePost.isPending ? 'Scheduling...' : 'Schedule Post'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}