import { useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CreateTicketInput, TicketCategory, TicketPriority } from '@/hooks/useSupportTickets';

interface TicketFormProps {
  onSubmit: (data: CreateTicketInput) => void;
  isSubmitting: boolean;
}

const categories: { value: TicketCategory; label: string }[] = [
  { value: 'database', label: 'Database / CRM' },
  { value: 'social', label: 'Social Media' },
  { value: 'events', label: 'Events' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'spheresync', label: 'SphereSync' },
  { value: 'coaching', label: 'Success Scoreboard / Coaching' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'general', label: 'General Question' },
];

export function TicketForm({ onSubmit, isSubmitting }: TicketFormProps) {
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !subject.trim()) return;

    onSubmit({
      category,
      subject: subject.trim(),
      description: description.trim() || undefined,
      priority,
    });

    // Reset form
    setCategory('');
    setSubject('');
    setDescription('');
    setPriority('medium');
  };

  const isValid = category && subject.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Submit a Request
        </CardTitle>
        <CardDescription>
          Need help with something? Submit a request and our team will get back to you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as TicketCategory)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <ToggleGroup
                type="single"
                value={priority}
                onValueChange={(value) => value && setPriority(value as TicketPriority)}
                className="justify-start"
              >
                <ToggleGroupItem value="low" aria-label="Low priority">
                  Low
                </ToggleGroupItem>
                <ToggleGroupItem value="medium" aria-label="Medium priority">
                  Medium
                </ToggleGroupItem>
                <ToggleGroupItem value="high" aria-label="High priority">
                  High
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Brief description of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide more details about your request..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <Button type="submit" disabled={!isValid || isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
