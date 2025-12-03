import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRSVP, RSVPFormData } from '@/hooks/useRSVP';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RSVPFormProps {
  eventId: string;
  maxCapacity?: number;
  currentCount?: number;
  onSuccess: () => void;
}

export const RSVPForm = ({ eventId, maxCapacity, currentCount, onSuccess }: RSVPFormProps) => {
  const { submitRSVP, loading, error } = useRSVP();
  const [formData, setFormData] = useState<RSVPFormData>({
    name: '',
    email: '',
    phone: '',
    guest_count: 1,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const isAtCapacity = maxCapacity !== undefined && maxCapacity !== null && currentCount !== undefined && currentCount >= maxCapacity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name.trim()) {
      setFormError('Please enter your name');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }

    if (formData.guest_count < 1) {
      setFormError('Guest count must be at least 1');
      return;
    }

    try {
      await submitRSVP(eventId, formData);
      onSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit RSVP. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || formError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || formError}</AlertDescription>
        </Alert>
      )}

      {isAtCapacity && (
        <Alert>
          <AlertDescription>
            This event is at capacity. You will be added to the waitlist.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="rsvp-name">Full Name *</Label>
        <Input
          id="rsvp-name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="John Doe"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-email">Email Address *</Label>
        <Input
          id="rsvp-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="john@example.com"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-phone">Phone Number</Label>
        <Input
          id="rsvp-phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="(555) 123-4567"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rsvp-guests">Number of Guests (including yourself)</Label>
        <Input
          id="rsvp-guests"
          type="number"
          min="1"
          max="10"
          value={formData.guest_count}
          onChange={(e) => setFormData({ ...formData, guest_count: parseInt(e.target.value) || 1 })}
          disabled={loading}
        />
        <p className="text-sm text-muted-foreground">
          Total attendees: {formData.guest_count}
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading || isAtCapacity}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : isAtCapacity ? (
          'Join Waitlist'
        ) : (
          'RSVP Now'
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By RSVPing, you agree to receive event updates via email.
      </p>
    </form>
  );
};

