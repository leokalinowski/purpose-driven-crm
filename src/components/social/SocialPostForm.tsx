import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Upload, X, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

const CONTENT_TEMPLATES = [
  {
    id: 'market-update',
    name: 'Market Update',
    category: 'Market Insights',
    template: '🏡 MARKET UPDATE: {property_type} prices in {area} {direction} by {percentage}% this month! {trend_emoji}\n\nKey insights:\n• Average price: ${price}\n• Days on market: {days}\n• Inventory level: {inventory}\n\nDM me for a personalized market analysis! 📈',
    variables: ['property_type', 'area', 'direction', 'percentage', 'price', 'days', 'inventory', 'trend_emoji']
  },
  {
    id: 'new-listing',
    name: 'New Listing',
    category: 'Listings',
    template: '✨ JUST LISTED! ✨\n\n{bedrooms} bed, {bathrooms} bath {property_type} in {area}\n\n🏠 {sqft} sq ft\n💰 ${price}\n📍 {address}\n\nFeatures: {features}\n\nSchedule a showing today! 📞',
    variables: ['bedrooms', 'bathrooms', 'property_type', 'area', 'sqft', 'price', 'address', 'features']
  },
  {
    id: 'open-house',
    name: 'Open House',
    category: 'Events',
    template: '🚪 OPEN HOUSE THIS WEEKEND!\n\n{bedrooms} bed, {bathrooms} bath {property_type}\n📍 {address}\n🕐 {date} from {start_time} - {end_time}\n💰 ${price}\n\nTour this beautiful home with me! Light refreshments provided. RSVP required. 📝',
    variables: ['bedrooms', 'bathrooms', 'property_type', 'address', 'date', 'start_time', 'end_time', 'price']
  },
  {
    id: 'client-success',
    name: 'Client Success Story',
    category: 'Testimonials',
    template: '🎉 SUCCESS STORY! 🎉\n\n"{testimonial}" - {client_name}\n\nI helped {client_name} find their dream {property_type} in just {days} days! 🏡✨\n\nFrom {start_location} to {end_location}, their journey was amazing.\n\nReady for your success story? Let\'s connect! 📞',
    variables: ['testimonial', 'client_name', 'property_type', 'days', 'start_location', 'end_location']
  },
  {
    id: 'market-tip',
    name: 'Market Tip',
    category: 'Education',
    template: '💡 REAL ESTATE TIP: {tip_title}\n\n{tip_content}\n\nPro tip: {pro_tip}\n\nWhat\'s your biggest real estate question? Ask me below! 👇\n\n#RealEstate #HomeBuying #RealEstateTips',
    variables: ['tip_title', 'tip_content', 'pro_tip']
  },
  {
    id: 'weekend-preview',
    name: 'Weekend Preview',
    category: 'Content',
    template: '🌅 TGIF! Here\'s what I have planned this weekend:\n\n🏠 Open Houses:\n• {address1} - {time1}\n• {address2} - {time2}\n\n📞 Client meetings and showings\n\n💼 Market research and analysis\n\nWhat are your weekend plans? Any real estate questions I can help with? 🤝',
    variables: ['address1', 'time1', 'address2', 'time2']
  }
];

export function SocialPostForm({ agentId, onSuccess }: SocialPostFormProps) {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

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

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setContent(template.template);
    setTemplateVariables({});
    setIsTemplateDialogOpen(false);
  };

  const handleVariableChange = (variable: string, value: string) => {
    const newVariables = { ...templateVariables, [variable]: value };
    setTemplateVariables(newVariables);

    if (selectedTemplate) {
      let filledTemplate = selectedTemplate.template;
      Object.entries(newVariables).forEach(([key, val]) => {
        filledTemplate = filledTemplate.replace(new RegExp(`{${key}}`, 'g'), val || `{${key}}`);
      });
      setContent(filledTemplate);
    }
  };

  const resetTemplate = () => {
    setSelectedTemplate(null);
    setTemplateVariables({});
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
      setSelectedTemplate(null);
      setTemplateVariables({});

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
          {/* Template Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Content Template</Label>
              <div className="flex items-center space-x-2">
                <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Use Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Choose a Content Template</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {CONTENT_TEMPLATES.map((template) => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm">{template.name}</CardTitle>
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {template.category}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              {template.template.substring(0, 100)}...
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.variables.slice(0, 3).map((variable) => (
                                <span key={variable} className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                  {variable}
                                </span>
                              ))}
                              {template.variables.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{template.variables.length - 3} more
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
                {selectedTemplate && (
                  <Button variant="ghost" size="sm" onClick={resetTemplate}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {selectedTemplate && (
              <div className="bg-muted p-3 rounded-md">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{selectedTemplate.name}</span>
                  <span className="text-xs text-muted-foreground">({selectedTemplate.category})</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedTemplate.variables.map((variable: string) => (
                    <div key={variable} className="space-y-1">
                      <Label htmlFor={variable} className="text-xs capitalize">
                        {variable.replace('_', ' ')}
                      </Label>
                      <Input
                        id={variable}
                        placeholder={`Enter ${variable}`}
                        value={templateVariables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        className="h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                resetTemplate(); // Reset template when manually editing
              }}
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