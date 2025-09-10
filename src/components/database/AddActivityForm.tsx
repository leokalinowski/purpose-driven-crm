import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActivityInput } from '@/hooks/useContactActivities';

interface AddActivityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ActivityInput) => Promise<void>;
  contactName: string;
}

export const AddActivityForm: React.FC<AddActivityFormProps> = ({
  open,
  onOpenChange,
  onSubmit,
  contactName,
}) => {
  const [formData, setFormData] = useState<ActivityInput>({
    activity_type: 'call',
    activity_date: new Date().toISOString().slice(0, 16),
    duration_minutes: undefined,
    outcome: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        ...formData,
        duration_minutes: formData.duration_minutes || undefined,
        outcome: formData.outcome?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });
      
      // Reset form
      setFormData({
        activity_type: 'call',
        activity_date: new Date().toISOString().slice(0, 16),
        duration_minutes: undefined,
        outcome: '',
        notes: '',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ActivityInput, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Activity - {contactName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activity_type">Activity Type</Label>
            <Select value={formData.activity_type} onValueChange={(value: any) => handleInputChange('activity_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select activity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="text">Text Message</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity_date">Date & Time</Label>
            <Input
              id="activity_date"
              type="datetime-local"
              value={formData.activity_date}
              onChange={(e) => handleInputChange('activity_date', e.target.value)}
              required
            />
          </div>

          {(formData.activity_type === 'call' || formData.activity_type === 'meeting') && (
            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                type="number"
                min="1"
                value={formData.duration_minutes || ''}
                onChange={(e) => handleInputChange('duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Enter duration"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="outcome">Outcome</Label>
            <Input
              id="outcome"
              value={formData.outcome}
              onChange={(e) => handleInputChange('outcome', e.target.value)}
              placeholder="e.g., Left voicemail, Scheduled appointment"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional details about this activity..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Activity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};