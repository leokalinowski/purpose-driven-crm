import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Loader2 } from 'lucide-react';
import { useNewsletterTaskSettings, type NewsletterFrequency } from '@/hooks/useNewsletterTaskSettings';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function NewsletterScheduleSettings() {
  const { settings, defaults, loading, save } = useNewsletterTaskSettings();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<NewsletterFrequency>(defaults.frequency);
  const [dayOfMonth, setDayOfMonth] = useState(defaults.day_of_month);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFrequency(settings.frequency);
      setDayOfMonth(settings.day_of_month);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await save({ frequency, day_of_month: dayOfMonth });
    setSaving(false);
  };

  if (loading) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Schedule Settings
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Newsletter Task Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">
              Set how often you want a reminder to write &amp; send your newsletter. This shows up in your Dashboard tasks.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as NewsletterFrequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {frequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                />
                <p className="text-xs text-muted-foreground">
                  Your newsletter task will appear on the dashboard during the week that includes this day.
                </p>
              </div>
            )}

            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Schedule
            </Button>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
