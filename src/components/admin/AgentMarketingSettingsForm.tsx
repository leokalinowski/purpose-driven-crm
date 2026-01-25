import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Palette, FileText, Link2 } from 'lucide-react';
import { useAgentMarketingSettings, AgentMarketingSettings, AgentMarketingSettingsInput } from '@/hooks/useAgentMarketingSettings';

interface AgentMarketingSettingsFormProps {
  userId: string;
  agentName: string;
  onClose?: () => void;
}

export const AgentMarketingSettingsForm = ({ userId, agentName, onClose }: AgentMarketingSettingsFormProps) => {
  const { loading, fetchSettings, upsertSettings } = useAgentMarketingSettings();
  const [settings, setSettings] = useState<AgentMarketingSettings | null>(null);
  const [formData, setFormData] = useState<AgentMarketingSettingsInput>({});
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      setInitialLoading(true);
      const data = await fetchSettings(userId);
      if (data) {
        setSettings(data);
        setFormData({
          primary_color: data.primary_color,
          secondary_color: data.secondary_color,
          headshot_url: data.headshot_url,
          logo_colored_url: data.logo_colored_url,
          logo_white_url: data.logo_white_url,
          gpt_prompt: data.gpt_prompt,
          brand_guidelines: data.brand_guidelines,
          example_copy: data.example_copy,
          target_audience: data.target_audience,
          tone_guidelines: data.tone_guidelines,
          what_not_to_say: data.what_not_to_say,
          thumbnail_guidelines: data.thumbnail_guidelines,
          clickup_editing_task_list_id: data.clickup_editing_task_list_id,
          clickup_video_deliverables_list_id: data.clickup_video_deliverables_list_id,
          shade_folder_id: data.shade_folder_id,
          editors: data.editors,
        });
      }
      setInitialLoading(false);
    };
    loadSettings();
  }, [userId, fetchSettings]);

  const handleChange = (field: keyof AgentMarketingSettingsInput, value: string | string[] | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditorsChange = (value: string) => {
    const editors = value.split(',').map(e => e.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, editors: editors.length > 0 ? editors : null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsertSettings(userId, formData);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Marketing Settings for {agentName}</h3>
        <p className="text-sm text-muted-foreground">
          Configure branding, content guidelines, and integration IDs
        </p>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Colors</CardTitle>
              <CardDescription>Brand colors for marketing materials</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color || '#000000'}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color || ''}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color || '#000000'}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color || ''}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assets</CardTitle>
              <CardDescription>Logo and headshot URLs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headshot_url">Headshot URL</Label>
                <Input
                  id="headshot_url"
                  value={formData.headshot_url || ''}
                  onChange={(e) => handleChange('headshot_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_colored_url">Colored Logo URL</Label>
                <Input
                  id="logo_colored_url"
                  value={formData.logo_colored_url || ''}
                  onChange={(e) => handleChange('logo_colored_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo_white_url">White Logo URL</Label>
                <Input
                  id="logo_white_url"
                  value={formData.logo_white_url || ''}
                  onChange={(e) => handleChange('logo_white_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">AI & Content Guidelines</CardTitle>
              <CardDescription>Guidelines for AI-generated content and copywriting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gpt_prompt">GPT Prompt / Instructions</Label>
                <Textarea
                  id="gpt_prompt"
                  value={formData.gpt_prompt || ''}
                  onChange={(e) => handleChange('gpt_prompt', e.target.value)}
                  placeholder="Custom instructions for AI content generation..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand_guidelines">Brand Guidelines</Label>
                <Textarea
                  id="brand_guidelines"
                  value={formData.brand_guidelines || ''}
                  onChange={(e) => handleChange('brand_guidelines', e.target.value)}
                  placeholder="Brand voice, style, and messaging guidelines..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_audience">Target Audience</Label>
                <Textarea
                  id="target_audience"
                  value={formData.target_audience || ''}
                  onChange={(e) => handleChange('target_audience', e.target.value)}
                  placeholder="Description of target audience demographics and psychographics..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone_guidelines">Tone Guidelines</Label>
                <Textarea
                  id="tone_guidelines"
                  value={formData.tone_guidelines || ''}
                  onChange={(e) => handleChange('tone_guidelines', e.target.value)}
                  placeholder="Tone of voice and communication style..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="example_copy">Example Copy</Label>
                <Textarea
                  id="example_copy"
                  value={formData.example_copy || ''}
                  onChange={(e) => handleChange('example_copy', e.target.value)}
                  placeholder="Examples of approved copy and messaging..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="what_not_to_say">What NOT to Say</Label>
                <Textarea
                  id="what_not_to_say"
                  value={formData.what_not_to_say || ''}
                  onChange={(e) => handleChange('what_not_to_say', e.target.value)}
                  placeholder="Words, phrases, or topics to avoid..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thumbnail_guidelines">Thumbnail Guidelines</Label>
                <Textarea
                  id="thumbnail_guidelines"
                  value={formData.thumbnail_guidelines || ''}
                  onChange={(e) => handleChange('thumbnail_guidelines', e.target.value)}
                  placeholder="Guidelines for video thumbnails and imagery..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ClickUp Integration</CardTitle>
              <CardDescription>ClickUp list IDs for task automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clickup_editing_task_list_id">Editing Task List ID</Label>
                <Input
                  id="clickup_editing_task_list_id"
                  value={formData.clickup_editing_task_list_id || ''}
                  onChange={(e) => handleChange('clickup_editing_task_list_id', e.target.value)}
                  placeholder="ClickUp list ID..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clickup_video_deliverables_list_id">Video Deliverables List ID</Label>
                <Input
                  id="clickup_video_deliverables_list_id"
                  value={formData.clickup_video_deliverables_list_id || ''}
                  onChange={(e) => handleChange('clickup_video_deliverables_list_id', e.target.value)}
                  placeholder="ClickUp list ID..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Other Integrations</CardTitle>
              <CardDescription>External service IDs and configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shade_folder_id">Shade Folder ID</Label>
                <Input
                  id="shade_folder_id"
                  value={formData.shade_folder_id || ''}
                  onChange={(e) => handleChange('shade_folder_id', e.target.value)}
                  placeholder="Shade folder ID..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editors">Editors (comma-separated)</Label>
                <Input
                  id="editors"
                  value={formData.editors?.join(', ') || ''}
                  onChange={(e) => handleEditorsChange(e.target.value)}
                  placeholder="editor1@email.com, editor2@email.com"
                />
                <p className="text-xs text-muted-foreground">
                  Enter editor emails or names separated by commas
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </form>
  );
};
